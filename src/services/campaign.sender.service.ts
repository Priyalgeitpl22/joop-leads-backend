import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export class CampaignSenderService {
    static async getAllCampaignsByAccountId(accountId: string) {
        const senderAccount = await prisma.senderAccount.findUnique({ where: { accountId: accountId } });
        if (!senderAccount) {
            throw new Error("Sender account not found");
        }
        return await prisma.campaignSender.findMany({
            where: { senderId: senderAccount.id },
            include: { campaign: true },
            orderBy: { createdAt: "desc" },
        });
    }
}