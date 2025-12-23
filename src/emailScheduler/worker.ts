import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redis } from "./queue";
import { processAndSendEmail } from "./emailSender";

const prisma = new PrismaClient();

new Worker(
  "email-send",
  async (job) => {
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
      const providerMsgId = await processAndSendEmail(emailSendId);

      // Update status to SENT
      await prisma.emailSend.update({
        where: { id: emailSendId },
        data: { 
          status: "SENT", 
          providerMsgId: providerMsgId || undefined,
          threadId: providerMsgId || undefined,
          sentAt: new Date(),
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });

      console.log(`[Worker] ✅ Email sent successfully: ${emailSendId}`);

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

console.log("[Worker] Email worker started and listening for jobs...");
