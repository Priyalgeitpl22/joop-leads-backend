import { httpClient } from "./http.client.service";
import { Account } from "../models";
import { SenderAccountState } from "../models/enums";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const SenderErrorReason = {
  REAUTH_REQUIRED: "REAUTH_REQUIRED",
  SEND_FAILED: "SEND_FAILED",
  TOKEN_REFRESH_FAILED: "TOKEN_REFRESH_FAILED",
  AUTH_FAILED: "AUTH_FAILED",
  OTHER: "OTHER",
} as const;

function toPrismaSenderState(state: SenderAccountState): "active" | "inactive" | "verified" | "unverified" | "pending" | "disabled" | "deleted" | "reauth_required" {
  return String(state).toLowerCase() as "active" | "inactive" | "verified" | "unverified" | "pending" | "disabled" | "deleted" | "reauth_required";
}

const ERROR_STATES = new Set(["reauth_required", "disabled", "inactive"]);

export class InboxEngineApiService {
  /** GET example */
  static async getAccountByEmail(email: string): Promise<Account> {
    try {
      const { data } = await httpClient.get<Account>(
        `/accounts/email?email=${email}`
      );
      return data;
    } catch (error) {
      console.error(`Error getting account by email: ${email}`, error);
      throw error;
    }
  }

  static async updateAccountPartially(accountId: string, accountData: Partial<Account>): Promise<void> {
    try {
      await httpClient.patch(`/accounts/${accountId}`, accountData);
    } catch (error) {
      console.error(`Error updating account: ${accountId}`, error);
      throw error;
    }
  }

  static async updateSenderAccountState(
    accountId: string,
    state: SenderAccountState,
    errorReason?: string,
    errorDetails?: Record<string, unknown>
  ): Promise<void> {
    try {
      const prismaState = toPrismaSenderState(state);
      const isErrorState = ERROR_STATES.has(prismaState);
      const erroredAt = isErrorState ? new Date() : null;
      const errorReasonVal = isErrorState ? (errorReason ?? prismaState.toUpperCase()) : null;
      const errorDetailsVal = isErrorState && errorDetails ? (errorDetails as object) : null;
      const apiPayload = {
        state: prismaState,
        erroredAt: erroredAt?.toISOString() ?? null,
        errorReason: errorReasonVal,
        errorDetails: errorDetailsVal,
      };
      await httpClient.patch(`/accounts/${accountId}`, apiPayload);
      await prisma.senderAccount.update({
        where: { accountId },
        data: {
          state: prismaState,
          erroredAt,
          errorReason: errorReasonVal,
          errorDetails: errorDetailsVal,
        } as Prisma.SenderAccountUpdateInput,
      });
    } catch (error) {
      console.error(`Error updating sender account state: ${accountId}`, error);
      throw error;
    }
  }

  static async setSenderAccountError(
    by: { accountId: string } | { id: string },
    state: SenderAccountState,
    errorReason: string,
    errorDetails?: Record<string, unknown>
  ): Promise<void> {
    try {
      const where = "accountId" in by ? { accountId: by.accountId } : { id: by.id };
      const sender = await prisma.senderAccount.findFirst({ where, select: { accountId: true } });
      if (!sender) return;
      const prismaState = toPrismaSenderState(state);
      const erroredAt = new Date();
      const apiPayload = {
        state: prismaState,
        erroredAt: erroredAt.toISOString(),
        errorReason,
        errorDetails: errorDetails ?? null,
      };
      await httpClient.patch(`/accounts/${sender.accountId}`, apiPayload);
      await prisma.senderAccount.update({
        where,
        data: {
          state: prismaState,
          erroredAt,
          errorReason,
          errorDetails: errorDetails ?? null,
        } as Prisma.SenderAccountUpdateInput,
      });
    } catch (error) {
      console.error(`Error setting sender account error:`, error);
      throw error;
    }
  }

  static async clearSenderAccountError(by: { accountId: string } | { id: string }): Promise<void> {
    const where = "accountId" in by ? { accountId: by.accountId } : { id: by.id };
    const sender = await prisma.senderAccount.findFirst({ where, select: { accountId: true } });
    if (!sender) return;
    await httpClient.patch(`/accounts/${sender.accountId}`, {
      erroredAt: null,
      errorReason: null,
      errorDetails: null,
    });
    await prisma.senderAccount.update({
      where,
      data: { erroredAt: null, errorReason: null, errorDetails: null } as Prisma.SenderAccountUpdateInput,
    });
  }
}
