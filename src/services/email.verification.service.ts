import { AddOnCode, Prisma, PrismaClient } from '@prisma/client';
import { ReoonService } from './reoon.service';
import { EmailStatus, BatchStatus, ICreateBatch } from '../models/email.verificaition.model';
import { flowProducer, verificationQueue } from "../emailScheduler/queue";
import { calculateDelayMs } from '../utils/email.utils';
import { bucket_name, s3Conifg } from '../aws/s3';
import * as XLSX from 'xlsx';
import { getPresignedUrl } from '../aws/imageUtils';
import { enforceEmailVerificationLimits } from '../middlewares/enforceEmailVerificationLimits';

const prisma = new PrismaClient();
const reoonService = new ReoonService();

/* -------------------- Select -------------------- */
const batchSelect = {
  id: true,
  name: true,
  fileName: true,
  totalEmails: true,
  verifiedCount: true,
  status: true,
  reoonTaskId: true,
  csvResultFile: true,
  createdAt: true,
  updatedAt: true,
  orgId: true,
  uploadedById: true,
};

const emailSelect = {
  id: true,
  batchId: true,
  email: true,
  status: true,
  username: true,
  domain: true,
  verificationResult: true,
  isSafeToSend: true,
  isDeliverable: true,
  createdAt: true,
  updatedAt: true,
};

const singleEmailSelect = {
  id: true,
  email: true,
  status: true,
  username: true,
  domain: true,
  verificationResult: true,
  isSafeToSend: true,
  isDeliverable: true,
  createdAt: true,
  updatedAt: true,
  orgId: true,
  verifiedById: true,
};

export type BatchResponse = Prisma.EmailVerificationBatchGetPayload<{
  select: typeof batchSelect;
}>;

export type EmailResponse = Prisma.VerifiedEmailGetPayload<{
  select: typeof emailSelect;
}>;

export type SingleEmailResponse = Prisma.SingleEmailVerificationGetPayload<{
  select: typeof singleEmailSelect;
}>;
/* -------------------- Service -------------------- */
export class EmailVerificationService {

  static async createBatch(data: ICreateBatch): Promise<BatchResponse> {
    const uniqueEmails = [...new Set(data.emails.filter(e => e && e.trim()))];

    return prisma.emailVerificationBatch.create({
      data: {
        name: data.name,
        fileName: data.fileName,
        totalEmails: uniqueEmails.length,
        status: BatchStatus.PENDING,
        orgId: data.orgId,
        uploadedById: data.uploadedById,
        emails: {
          create: uniqueEmails.map(email => ({
            email: email.trim().toLowerCase(),
          })),
        },
      },
      select: batchSelect,
    });
  }

  static async getBatchById(batchId: string, orgId: string) {
    const result = await prisma.emailVerificationBatch.findFirst({
      where: { id: batchId, orgId },
      select: {
        ...batchSelect,
        emails: {
          select: emailSelect,
        },
      },
    });
    if (!result) {
      return null;
    }
    if (result.status === BatchStatus.COMPLETED && result.csvResultFile) {
      result.csvResultFile = await getPresignedUrl(result.csvResultFile!);
    } else {
      result.csvResultFile = null;
    }
    return result;
  }

  static async getBatchesByOrg(orgId: string, page: number, limit: number): Promise<any> {

    const offset = (page - 1) * limit;
    const totalBatches = await prisma.emailVerificationBatch.count({
      where: { orgId },
    });
    const result = await prisma.emailVerificationBatch.findMany({
      where: { orgId },
      select: batchSelect,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });
    for (const batch of result) {
      if (batch.status === BatchStatus.COMPLETED && batch.csvResultFile) {
        batch.csvResultFile = await getPresignedUrl(batch.csvResultFile!);
      } else {
        batch.csvResultFile = null;
      }
    }
    return {
      batches: result as BatchResponse[],
      page,
      limit,
      totalBatches,
      totalPages: Math.ceil(totalBatches / limit),
      hasNextPage: page < Math.ceil(totalBatches / limit),
      hasPreviousPage: page > 1
    };
  }

  static async submitBatchForVerification(batchId: string, orgId: string, csvUploaded: any) {
    const batch = await prisma.emailVerificationBatch.findFirst({
      where: { id: batchId, orgId },
      include: { emails: true },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }
    if (batch.status === BatchStatus.PROCESSING || batch.status === BatchStatus.COMPLETED) {
      return batch;
    }
    const taskId = await reoonService.submitBulkVerification(
      batch.emails.map(e => e.email),
      batch.name
    );

    const updatedBatch = await prisma.emailVerificationBatch.update({
      where: { id: batchId },
      data: {
        reoonTaskId: taskId,
        status: BatchStatus.PROCESSING,
        csvFile: csvUploaded,
      },
    });

    await verificationQueue.add(
      "submit-batch",
      { batchId },
      { jobId: `submit-${batchId}` }
    );

    return updatedBatch;
  }

  static async getVerifiedEmails(batchId: string, orgId: string): Promise<EmailResponse[]> {
    const batch = await prisma.emailVerificationBatch.findFirst({
      where: { id: batchId, orgId },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    return prisma.verifiedEmail.findMany({
      where: {
        batchId,
        OR: [
          { status: EmailStatus.SAFE },
          { status: EmailStatus.ROLE_ACCOUNT },
        ],
      },
      select: emailSelect,
    });
  }

  static async getBatchVerificationResultKey(batchId: string, orgId: string): Promise<any> {
    const batch = await prisma.emailVerificationBatch.findUnique({
      where: { id: batchId, orgId },
      select: { csvResultFile: true },
    });

    if (!batch || !batch.csvResultFile) {
      throw new Error("Result file not found");
    }
    return batch;
  }

  static async getUnverifiedEmails(batchId: string, orgId: string): Promise<EmailResponse[]> {
    const batch = await prisma.emailVerificationBatch.findFirst({
      where: { id: batchId, orgId },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    return prisma.verifiedEmail.findMany({
      where: {
        batchId,
        status: {
          notIn: [EmailStatus.SAFE, EmailStatus.ROLE_ACCOUNT],
        },
      },
      select: emailSelect,
    });
  }

  static async getBatchStatistics(batchId: string, orgId: string) {
    const batch = await prisma.emailVerificationBatch.findFirst({
      where: { id: batchId, orgId },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    const stats = await prisma.verifiedEmail.groupBy({
      by: ['status'],
      where: { batchId },
      _count: true,
    });

    const statusCounts = stats.reduce((acc, stat) => {
      if (stat.status) {
        acc[stat.status] = stat._count;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      batchId: batch.id,
      reoonTaskId: batch.reoonTaskId,
      batchName: batch.name,
      totalEmails: batch.totalEmails,
      verifiedCount: batch.verifiedCount,
      status: batch.status,
      statusBreakdown: statusCounts,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    };
  }

  static async deleteBatch(batchId: string, orgId: string) {
    const batch = await prisma.emailVerificationBatch.findFirst({
      where: { id: batchId, orgId },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    return prisma.emailVerificationBatch.delete({
      where: { id: batchId },
    });
  }

  static async checkReoonCredits(): Promise<any> {
    const data = await reoonService.checkAccountBalance();
    return data;
  }

  static mapReoonStatusToEnum(status: string): EmailStatus {
    const statusMap: Record<string, EmailStatus> = {
      safe: EmailStatus.SAFE,
      invalid: EmailStatus.INVALID,
      disabled: EmailStatus.DISABLED,
      disposable: EmailStatus.DISPOSABLE,
      inbox_full: EmailStatus.INBOX_FULL,
      catch_all: EmailStatus.CATCH_ALL,
      role_account: EmailStatus.ROLE_ACCOUNT,
      spamtrap: EmailStatus.SPAMTRAP,
      unknown: EmailStatus.UNKNOWN,
    };

    return statusMap[status.toLowerCase()] || EmailStatus.UNKNOWN;
  }

  static async verifyEmails(
    emailsString: string,
    orgId: string,
    userId: string,
    mode: 'quick' | 'power' = 'power'
  ): Promise<{
    verified: SingleEmailResponse[];
    failed: Array<{ email: string; error: string }>;
  }> {
    // Parse comma-separated emails
    const emailList = emailsString
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(e => e && this.isValidEmail(e));

    if (emailList.length === 0) {
      throw new Error('No valid emails provided');
    }

    // Remove duplicates
    const uniqueEmails = [...new Set(emailList)];

    const result = await enforceEmailVerificationLimits(uniqueEmails.length, orgId);
    if (!result.success) {
      const message = result.message ?? 'Email verification is not available. Please check your plan or add-on limits.';
      const err = new Error(message) as Error & { statusCode?: number };
      err.statusCode = result.code;
      throw err;
    }

    const verified: SingleEmailResponse[] = [];
    const failed: Array<{ email: string; error: string }> = [];

    // Verify each email
    for (const email of uniqueEmails) {
      try {
        // Check if already verified recently (within 24 hours)
        const existingVerification = await prisma.singleEmailVerification.findFirst({
          where: {
            email,
            orgId,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
          select: singleEmailSelect,
        });

        if (existingVerification) {
          // Return cached result
          verified.push(existingVerification);
          continue;
        }

        // Call Reoon API
        const result = await reoonService.verifySingleEmail(email, mode);

        // Save to database
        const savedVerification = await prisma.singleEmailVerification.create({
          data: {
            email,
            status: this.mapReoonStatusToEnum(result.status),
            username: result.username,
            domain: result.domain,
            verificationResult: result as any,
            overallScore: result.overall_score,
            isSafeToSend: result.is_safe_to_send,
            isDeliverable: result.is_deliverable,
            orgId,
            verifiedById: userId,
          },
          select: singleEmailSelect,
        });

        verified.push(savedVerification);
      } catch (error: any) {
        failed.push({
          email,
          error: error.message || 'Verification failed',
        });
      }
    }

    return { verified, failed };
  }

  static async getVerificationHistory(
    orgId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<SingleEmailResponse[]> {
    return prisma.singleEmailVerification.findMany({
      where: { orgId },
      select: singleEmailSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
  static async getEmailResult(
    id: string
  ): Promise<any | null> {
    return prisma.singleEmailVerification.findUnique({
      where: { id },
      select: { verificationResult: true },
    });
  }
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static async generateAndUploadExcel(
    batchId: string,
    results: any[],
  ): Promise<string> {

    const workbook = XLSX.utils.book_new();

    const worksheetData = results.map((r: any, index: number) => ({
      "S.No": index + 1,
      Email: r.email ?? "",
      Domain: r.domain ?? "",
      Status: r.status ?? "",
      Username: r.username ?? "",
      "MX Records": Array.isArray(r.mx_records)
        ? r.mx_records.join(", ")
        : "",
      "Is Disabled": r.is_disabled ? "Yes" : "No",
      "Is Spamtrap": r.is_spamtrap ? "Yes" : "No",
      "Is Catch All": r.is_catch_all ? "Yes" : "No",
      "Is Disposable": r.is_disposable ? "Yes" : "No",
      "Is Free Email": r.is_free_email ? "Yes" : "No",
      "Overall Score": r.overall_score ?? "",
      "Inbox Full": r.has_inbox_full ? "Yes" : "No",
      "Is Deliverable": r.is_deliverable ? "Yes" : "No",
      "Is Role Account": r.is_role_account ? "Yes" : "No",
      "Safe To Send": r.is_safe_to_send ? "Yes" : "No",
      "Valid Syntax": r.is_valid_syntax ? "Yes" : "No",
      "MX Accepts Mail": r.mx_accepts_mail ? "Yes" : "No",
      "Can Connect SMTP": r.can_connect_smtp ? "Yes" : "No",
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    worksheet["!cols"] = Object.keys(worksheetData[0] ?? {}).map(() => ({
      wch: 22,
    }));

    XLSX.utils.book_append_sheet(workbook, worksheet, "Verified Emails");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const s3Key = `csvFiles/verification-results/${batchId}.xlsx`;

    await s3Conifg.upload({
      Bucket: bucket_name,
      Key: s3Key,
      Body: buffer,
      ContentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }).promise();

    return s3Key;
  }
}