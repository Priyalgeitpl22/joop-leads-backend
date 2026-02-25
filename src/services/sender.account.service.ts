import { EmailProvider, Prisma, PrismaClient, WarmupStatus } from "@prisma/client";
import { Account } from "../models/email.account.model";
import { CreateSenderAccount, UpdateSenderAccount, SenderAccount } from "../interfaces";

const prisma = new PrismaClient();

export class SenderAccountService {
    static async getSenderAccount(id: string, email: string): Promise<SenderAccount | null> {
        const senderAccount = await prisma.senderAccount.findFirst({ where: { accountId: id, email } });
        return senderAccount;
    }

    static async getSenderAccounts(orgId: string): Promise<SenderAccount[]> {
        const senderAccounts = await prisma.senderAccount.findMany({ where: { orgId } });
        return senderAccounts;
    }

    static async createSenderAccount(data: Account): Promise<SenderAccount | null> {
        if (!data._id) {
            throw new Error("Sender account ID is required");
        }

        const existingSenderAccount = await this.getSenderAccount(data._id, data.email);

        if (existingSenderAccount) {
            const updatedSenderAccount = await this.updateSenderAccount(existingSenderAccount.accountId, data);
            return updatedSenderAccount;
        }

        const accountData = await this.buildSenderCreateAccountData(data);
        try {
            const senderAccount = await prisma.senderAccount.create({ data: accountData as Prisma.SenderAccountCreateInput });
            prisma.organizationPlan.update({
                where: { orgId_isActive: { orgId: data.orgId, isActive: true } },
                data: { senderAccountsCount: { increment: 1 } },
            });
            return senderAccount;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    static async updateSenderAccount(accountId: string, data: Account) {
        try {
            const existingSenderAccount = await this.getSenderAccount(accountId, data.email);
            if (!existingSenderAccount) {
                throw new Error("Sender account not found");
            }

            const updatedAccount = {
                email: data?.email ? data.email : existingSenderAccount.email,
                name: data?.name ? data.name : existingSenderAccount.name,
                provider: data.type as EmailProvider,
                replyTo: data.replyTo || "",
                dailyLimit: data?.limit ? data.limit : existingSenderAccount.dailyLimit,
                minDelaySeconds: data.time_gap ? data.time_gap * 60 : existingSenderAccount.minDelaySeconds,
                smtpHost: data?.smtp?.host ? data.smtp?.host : existingSenderAccount.smtpHost,
                smtpPort: data?.smtp?.port ? data.smtp?.port : existingSenderAccount.smtpPort,
                smtpUser: data?.smtp?.auth?.user ? data.smtp?.auth?.user : existingSenderAccount.smtpUser,
                smtpPass: data?.smtp?.auth?.pass ? data.smtp?.auth?.pass : existingSenderAccount.smtpPass,
                smtpSecure: data?.smtp?.secure ? data.smtp?.secure : existingSenderAccount.smtpSecure,
                imapHost: data?.imap?.host ? data.imap?.host : existingSenderAccount.imapHost,
                imapPort: data?.imap?.port ? data.imap?.port : existingSenderAccount.imapPort,
                imapUser: data?.imap?.auth?.user ? data.imap?.auth?.user : existingSenderAccount.imapUser,
                imapPass: data?.imap?.auth?.pass ? data.imap?.auth?.pass : existingSenderAccount.imapPass,
                imapSecure: data?.imap?.secure ? data.imap?.secure : existingSenderAccount.imapSecure,
                accessToken: data?.oauth2?.tokens?.access_token ? data.oauth2?.tokens?.access_token : existingSenderAccount.accessToken,
                refreshToken: data?.oauth2?.tokens?.refresh_token ? data.oauth2?.tokens?.refresh_token : existingSenderAccount.refreshToken,
                tokenExpiry: data?.oauth2?.tokens?.expiry_date ? new Date(data?.oauth2?.tokens?.expiry_date) : existingSenderAccount.tokenExpiry,
                hourlyLimit: 10,
                isEnabled: true,
                isVerified: false,
                warmupStatus: WarmupStatus.NOT_STARTED,
                warmupStartedAt: null,
                warmupDailyIncrement: 2,
                signature: data?.signature ? data.signature : existingSenderAccount.signature,
            } as UpdateSenderAccount;

            const senderAccount = await prisma.senderAccount.update({ where: { accountId: accountId }, data: updatedAccount as Prisma.SenderAccountUpdateInput });
            return senderAccount;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    static async deleteSenderAccount(accountId: string) {
        try {
            const senderAccount = await prisma.senderAccount.delete({ where: { accountId: accountId } });
            return senderAccount;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    private static async buildSenderUpdateAccountData(data: Account): Promise<UpdateSenderAccount> {
        try {
            return {
                email: data?.email ? data.email : null,
                name: data?.name ? data.name : null,
                provider: data.type as EmailProvider,
                dailyLimit: data?.limit ? data.limit : null,
                minDelaySeconds: data.time_gap ? data.time_gap * 60 : 60, // Convert minutes to seconds

                // SMTP Config
                smtpHost: data?.smtp?.host ? data.smtp?.host : null,
                smtpPort: data?.smtp?.port ? data.smtp?.port : null,
                smtpUser: data?.smtp?.auth?.user ? data.smtp?.auth?.user : null,
                smtpPass: data?.smtp?.auth?.pass ? data.smtp?.auth?.pass : null,
                smtpSecure: data?.smtp?.secure ? data.smtp?.secure : null,

                // IMAP Config
                imapHost: data?.imap?.host ? data.imap?.host : null,
                imapPort: data?.imap?.port ? data.imap?.port : null,
                imapUser: data?.imap?.auth?.user ? data.imap?.auth?.user : null,
                imapPass: data?.imap?.auth?.pass ? data.imap?.auth?.pass : null,
                imapSecure: data?.imap?.secure ? data.imap?.secure : null,

                // OAuth Config (for Gmail/Outlook API)
                accessToken: data?.oauth2?.tokens?.access_token ? data.oauth2?.tokens?.access_token : null,
                refreshToken: data?.oauth2?.tokens?.refresh_token ? data.oauth2?.tokens?.refresh_token : null,
                tokenExpiry: data?.oauth2?.tokens?.expiry_date ? new Date(data?.oauth2?.tokens?.expiry_date) : null,

                hourlyLimit: 10,
                isEnabled: true,
                isVerified: false,
                warmupStatus: WarmupStatus.NOT_STARTED,
                warmupStartedAt: null,
                warmupDailyIncrement: 2,
                signature: null,
            } as UpdateSenderAccount;
        } catch (error) {
            console.error(error);
            throw new Error("Failed to build sender update account data");
        }
    }

    private static async buildSenderCreateAccountData(data: Account): Promise<CreateSenderAccount> {
        try {
            return {
                accountId: data._id || data.account,
                email: data.email,
                name: data.name,
                replyTo: data.replyTo ? data.replyTo : "",
                provider: data.type as EmailProvider,
                organization: {
                    connect: {
                        id: data.orgId,
                    },
                },
                smtpHost: data.smtp?.host ? data.smtp?.host : null,
                smtpPort: data.smtp?.port ? data.smtp?.port : null,
                smtpUser: data.smtp?.auth?.user ? data.smtp?.auth?.user : null,
                smtpPass: data.smtp?.auth?.pass ? data.smtp?.auth?.pass : null,
                smtpSecure: data.smtp?.secure ?? false,

                imapHost: data.imap?.host ? data.imap?.host : null,
                imapPort: data.imap?.port ? data.imap?.port : null,
                imapUser: data.imap?.auth?.user ? data.imap?.auth?.user : null,
                imapPass: data.imap?.auth?.pass ? data.imap?.auth?.pass : null,
                imapSecure: data.imap?.secure ?? false,

                isEnabled: true,
                accessToken: data?.oauth2?.tokens?.access_token ? data?.oauth2?.tokens?.access_token : null,
                refreshToken: data?.oauth2?.tokens?.refresh_token ? data?.oauth2?.tokens?.refresh_token : null,
                tokenExpiry: data?.oauth2?.tokens?.expiry_date ? new Date(data?.oauth2?.tokens?.expiry_date) : null,
                signature: data.signature ? data.signature : `
                    <div style="color: #034f84;">
                    <h6 style="margin: 0;">Best regards,</h6>
                    <p style="margin: 4px 0 0 0;">${data.name}</p>
                    </div>
                    `,
                dailyLimit: data?.limit ? data.limit : 0,
                warmupStatus: data?.warmup?.enabled ? WarmupStatus.IN_PROGRESS : WarmupStatus.NOT_STARTED,
                warmupStartedAt: data?.warmup?.startDate ?? null,
                warmupDailyIncrement: data?.warmup?.rampupIncrement ?? 2,
            } as CreateSenderAccount;
        } catch (error) {
            console.error(error);
            throw new Error("Failed to build sender create account data");
        }
    }
}