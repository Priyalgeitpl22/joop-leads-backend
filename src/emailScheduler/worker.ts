import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redis } from "./queue";
import { processAndSendEmail } from "./emailSender";
import { ReoonService } from "../services/reoon.service";
import { getPollingConfig } from "../utils/email.utils";
import { EmailVerificationService } from "../services/email.verification.service";
import { BatchStatus } from "../models/email.verificaition.model";

const prisma = new PrismaClient();
const reoonService = new ReoonService();
new Worker(
  "email-send",
  async (job) => {
    try {
    const { emailSendId } = job.data as { emailSendId: string };
    console.log(`[Worker] Processing job for EmailSend: ${emailSendId}`);

    const row = await prisma.emailSend.findUnique({ where: { id: emailSendId } });
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

      console.log(`[Worker] ✅ Email sent successfully: ${emailSendId}, threadId: ${result.threadId}`);

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
  'email-verification',
  async (job) => {
    if (job.name !== 'submit-batch') return;

    // batch already submitted earlier
    return true;
  },
  { connection: redis }
);



new Worker(
  "email-verification",
  async (job) => {
    if (job.name !== "poll-reoon") return;

    const { batchId } = job.data;

    const batch = await prisma.emailVerificationBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch?.reoonTaskId) {
      throw new Error("Missing Reoon taskId");
    }

    const { intervalMs, maxAttempts } = getPollingConfig(batch.totalEmails);

    const results = await reoonService.waitForBulkVerificationCompletion(
      batch.reoonTaskId,
      intervalMs,
      maxAttempts
    );

    // 🔐 STORE RESULT IN REDIS
    await redis.set(
      `reoon:result:${batchId}`,
      JSON.stringify(results),
      "EX",
      3600
    );

    return true;
  },
  { connection: redis }
);


new Worker(
  "email-verification",
  async (job) => {
    if (job.name !== "persist-results") return;

    const { batchId } = job.data;

    const raw = await redis.get(`reoon:result:${batchId}`);
    if (!raw) throw new Error("Missing Reoon results");

    const results = JSON.parse(raw);

    await prisma.$transaction(
      Object.values(results.results).map((r: any) =>
        prisma.verifiedEmail.updateMany({
          where: { batchId, email: r.email.toLowerCase() },
          data: {
            status: EmailVerificationService.mapReoonStatusToEnum(r.status),
            username: r.username,
            domain: r.domain,
            isSafeToSend: r.is_safe_to_send,
            isDeliverable: r.is_deliverable,
          },
        })
      )
    );

    await prisma.emailVerificationBatch.update({
      where: { id: batchId },
      data: {
        status: BatchStatus.COMPLETED,
        verifiedCount: results.count_checked,
      },
    });
  },
  { connection: redis }
);

console.log("[Worker] Email worker started and listening for jobs...");
