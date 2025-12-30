// services/emailVerification.service.ts

import { Prisma, PrismaClient } from '@prisma/client';
import { ReoonService } from './reoon.service';
import { EmailStatus, BatchStatus, ICreateBatch } from '../models/emailVerificaition.model';

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
  verificationResult: true,
  username: true,
  domain: true,
  isSafeToSend: true,
  isValidSyntax: true,
  isDisposable: true,
  isRoleAccount: true,
  canConnectSmtp: true,
  hasInboxFull: true,
  isCatchAll: true,
  isDeliverable: true,
  isDisabled: true,
  isSpamtrap: true,
  mxAcceptsMail: true,
  mxRecords: true,
  verificationMode: true,
  createdAt: true,
  updatedAt: true,
};

export type BatchResponse = Prisma.EmailVerificationBatchGetPayload<{
  select: typeof batchSelect;
}>;

export type EmailResponse = Prisma.VerifiedEmailGetPayload<{
  select: typeof emailSelect;
}>;

/* -------------------- Service -------------------- */
export class EmailVerificationService {
  /**
   * Create a new batch and save emails to database
   */
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

  /**
   * Get batch by ID
   */
  static async getBatchById(batchId: string, orgId: string) {
    return prisma.emailVerificationBatch.findFirst({
      where: { id: batchId, orgId },
      select: {
        ...batchSelect,
        emails: {
          select: emailSelect,
        },
      },
    });
  }

  /**
   * Get all batches for organization
   */
  static async getBatchesByOrg(orgId: string): Promise<BatchResponse[]> {
    return prisma.emailVerificationBatch.findMany({
      where: { orgId },
      select: batchSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Submit batch to Reoon for verification
   */
  static async submitBatchForVerification(batchId: string, orgId: string) {
    const batch = await prisma.emailVerificationBatch.findFirst({
      where: { id: batchId, orgId },
      include: { emails: true },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    const emails = batch.emails.map(e => e.email);

    // Update batch status
    await prisma.emailVerificationBatch.update({
      where: { id: batchId },
      data: { status: BatchStatus.UPLOADING },
    });

    try {
      // Submit to Reoon
      const taskId = await reoonService.submitBulkVerification(emails, batch.name);

      // Update batch with task ID
      return prisma.emailVerificationBatch.update({
        where: { id: batchId },
        data: {
          reoonTaskId: taskId,
          status: BatchStatus.PROCESSING,
        },
        select: batchSelect,
      });
    } catch (error) {
      // Revert status on failure
      await prisma.emailVerificationBatch.update({
        where: { id: batchId },
        data: { status: BatchStatus.FAILED },
      });
      throw error;
    }
  }

  /**
   * Process verification results and update database
   */
  static async processVerificationResults(batchId: string, orgId: string) {
    const batch = await prisma.emailVerificationBatch.findFirst({
      where: { id: batchId, orgId },
    });

    if (!batch || !batch.reoonTaskId) {
      throw new Error('Batch or task ID not found');
    }

    // Wait for completion and get results
    const results = await reoonService.waitForBulkVerificationCompletion(batch.reoonTaskId);

    if (!results.results) {
      throw new Error('No results returned from Reoon');
    }

    // Update each email with verification results
    await Promise.all(
      results.results.map(async (result) => {
        const emailRecord = await prisma.verifiedEmail.findFirst({
          where: {
            batchId,
            email: result.email.toLowerCase(),
          },
        });

        if (emailRecord) {
          await prisma.verifiedEmail.update({
            where: { id: emailRecord.id },
            data: {
              status: this.mapReoonStatusToEnum(result.status),
              verificationResult: result as any,
              username: result.username,
              domain: result.domain,
              isSafeToSend: result.is_safe_to_send,
              isValidSyntax: result.is_valid_syntax,
              isDisposable: result.is_disposable,
              isRoleAccount: result.is_role_account,
              canConnectSmtp: result.can_connect_smtp,
              hasInboxFull: result.has_inbox_full,
              isCatchAll: result.is_catch_all,
              isDeliverable: result.is_deliverable,
              isDisabled: result.is_disabled,
              isSpamtrap: result.is_spamtrap,
              mxAcceptsMail: result.mx_accepts_mail,
              mxRecords: result.mx_records,
              verificationMode: result.verification_mode,
            },
          });
        }
      })
    );

    // Update batch status
    return prisma.emailVerificationBatch.update({
      where: { id: batchId },
      data: {
        status: BatchStatus.COMPLETED,
        verifiedCount: results.count_checked,
      },
      select: batchSelect,
    });
  }

  /**
   * Get verified emails (safe to send)
   */
  static async getVerifiedEmails(batchId: string, orgId: string): Promise<EmailResponse[]> {
    // First verify the batch belongs to the org
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

  /**
   * Get unverified/invalid emails
   */
  static async getUnverifiedEmails(batchId: string, orgId: string): Promise<EmailResponse[]> {
    // First verify the batch belongs to the org
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

  /**
   * Get statistics for a batch
   */
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
      batchName: batch.name,
      totalEmails: batch.totalEmails,
      verifiedCount: batch.verifiedCount,
      status: batch.status,
      statusBreakdown: statusCounts,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    };
  }

  /**
   * Delete batch
   */
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

  /**
   * Map Reoon status to Prisma enum
   */
  private static mapReoonStatusToEnum(status: string): EmailStatus {
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
}