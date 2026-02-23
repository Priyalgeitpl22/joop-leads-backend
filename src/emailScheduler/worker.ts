import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { verificationQueue, redis } from "./queue";
import { processAndSendEmail } from "./emailSender";
import { ReoonService } from "../services/reoon.service";
import { getPollingConfig } from "../utils/email.utils";
import { EmailVerificationService } from "../services/email.verification.service";
import { BatchStatus } from "../models/email.verificaition.model";
import { incrementEmailsSent } from "../services/organization.usage.service";

const prisma = new PrismaClient();
const reoonService = new ReoonService();
new Worker(
  "email-send",
  async (job) => {
    try {
      const { emailSendId } = job.data as { emailSendId: string };
      console.log(`[Worker] Processing job for EmailSend: ${emailSendId}`);

      const row = await prisma.emailSend.findUnique({
        where: { id: emailSendId },
        select: { id: true, status: true, campaign: { select: { orgId: true } } },
      });
      if (!row) {
        console.log(`[Worker] EmailSend not found: ${emailSendId}`);
        return;
      }

      // Skip if already sent
      if (row.status === "SENT") {
        console.log(`[Worker] EmailSend already sent: ${emailSendId}`);
        return;
      }

      try {
        // Send the email using the emailSender service
        const result = await processAndSendEmail(emailSendId);

        // Update status to SENT with proper threadId
        await prisma.emailSend.update({
          where: { id: emailSendId },
          data: {
            status: "SENT",
            providerMsgId: result.messageId || undefined,
            threadId: result.threadId || undefined,
            sentAt: new Date(),
            attempts: { increment: 1 },
            lastAttemptAt: new Date(),
          },
        });

        const orgId = row.campaign?.orgId;
        if (orgId) {
          incrementEmailsSent(orgId).catch((err) =>
            console.error(`[Worker] Failed to increment emails usage for org ${orgId}:`, err)
          );

          console.log(`[Worker] ✅ Email sent successfully: ${emailSendId}, threadId: ${result.threadId}`);
        }
      } catch (err: any) {
        console.error(`[Worker] ❌ Email failed: ${emailSendId}`, err.message);

        // Update status to FAILED
        await prisma.emailSend.update({
          where: { id: emailSendId },
          data: {
            status: "FAILED",
            errorMessage: String(err?.message || err),
            attempts: { increment: 1 },
            lastAttemptAt: new Date(),
          },
        });

        // Rethrow so BullMQ can retry
        throw err;
      }
    } catch (err: any) {
      console.error(`[Worker] ❌ Email failed: ${job.data.emailSendId}`, err.message);
      throw err;
    }
  },
  {
    connection: redis,
    concurrency: 10,
    limiter: {
      max: 100,      // Max 100 jobs
      duration: 60000, // Per minute
    },
  }
);

new Worker(
  "email-verification",
  async (job) => {
    const { batchId } = job.data;

    switch (job.name) {

      case "submit-batch": {
        const batch = await prisma.emailVerificationBatch.findUnique({
          where: { id: batchId },
        });

        if (!batch || batch.status !== BatchStatus.PROCESSING) return;
        const totalEmails = batch?.totalEmails || 0;
        const { intervalMs, maxAttempts } = getPollingConfig(totalEmails);
        await verificationQueue.add(
          "poll-reoon",
          { batchId },
          {
            jobId: `poll-${batchId}`,
            attempts: maxAttempts,
            backoff: { type: "fixed", delay: intervalMs },
          }
        );
        return;
      }

      case "poll-reoon": {
        const batch = await prisma.emailVerificationBatch.findUnique({
          where: { id: batchId },
        });
        if (!batch?.reoonTaskId) {
          throw new Error("Missing Reoon taskId");
        }
        if (batch.status === BatchStatus.COMPLETED) return;

        const { completed, result } =
          await reoonService.checkBulkStatusOnce(batch.reoonTaskId);

        if (!completed || !result) {
          throw new Error("Still processing"); // retry
        }

        // 👇 pass results forward instead of storing
        await verificationQueue.add(
          "persist-results",
          { batchId, results: result },
          { jobId: `persist-${batchId}` }
        );

        return;
      }

      case "persist-results": {
        const { batchId, results } = job.data;

        const batch = await prisma.emailVerificationBatch.findUnique({
          where: { id: batchId },
        });

        if (!batch || batch.status === BatchStatus.COMPLETED) return;

        const updates = Object.values(results.results).map(r =>
          prisma.verifiedEmail.updateMany({
            where: {
              batchId,
              email: (r as any).email.toLowerCase(),
            },
            data: {
              status: EmailVerificationService.mapReoonStatusToEnum((r as any).status),
              username: (r as any).username,
              domain: (r as any).domain,
              isSafeToSend: (r as any).is_safe_to_send,
              isDeliverable: (r as any).is_deliverable,
              verificationResult: r,
            },
          })
        );

        await prisma.$transaction(updates);

        const s3Key = await EmailVerificationService.generateAndUploadExcel(
          batchId,
          Object.values(results.results)
        );

        const verifiedEmailsCount = await prisma.verifiedEmail.count({
          where: {
            batchId,
            OR: [
              { status: EmailVerificationService.mapReoonStatusToEnum("safe") },
              { status: EmailVerificationService.mapReoonStatusToEnum("role_account") },
            ],
          },
        });

        await prisma.emailVerificationBatch.update({
          where: { id: batchId },
          data: {
            status: BatchStatus.COMPLETED,
            verifiedCount: verifiedEmailsCount,
            csvResultFile: s3Key,
          },
        });

        return;
      }


      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  },
  { connection: redis }
);

console.log("🚀 Email verification worker running");

console.log("[Worker] Email worker started and listening for jobs...");
