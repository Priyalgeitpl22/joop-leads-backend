import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redis } from "./queue";

const prisma = new PrismaClient();

async function actuallySendEmail(emailSendId: string) {
  // TODO: call your existing Gmail/Outlook/SMTP sender here
  // return providerMsgId
  return "provider-msg-id";
}

new Worker(
  "email-send",
  async (job) => {
    const { emailSendId } = job.data as { emailSendId: string };

    const row = await prisma.emailSend.findUnique({ where: { id: emailSendId } });
    if (!row) return;

    try {
      const providerMsgId = await actuallySendEmail(emailSendId);

      await prisma.emailSend.update({
        where: { id: emailSendId },
        data: { status: "SENT", providerMsgId },
      });

    } catch (err: any) {
      await prisma.emailSend.update({
        where: { id: emailSendId },
        data: { status: "FAILED", error: String(err?.message || err) },
      });
      throw err; // BullMQ retries
    }
  },
  { connection: redis, concurrency: 20 }
);