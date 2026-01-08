import { Prisma, PrismaClient } from '@prisma/client';
import { ReoonService } from './reoon.service';
import { EmailStatus, BatchStatus, ICreateBatch } from '../models/email.verificaition.model';
import { flowProducer, verificationQueue } from "../emailScheduler/queue";
import { calculateDelayMs } from '../utils/email.utils';
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
  username: true,
  domain: true,
  isSafeToSend: true,
  isDeliverable: true,
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

  static async getBatchesByOrg(orgId: string): Promise<BatchResponse[]> {
    return prisma.emailVerificationBatch.findMany({
      where: { orgId },
      select: batchSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async submitBatchForVerification(batchId: string, orgId: string) {
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
}