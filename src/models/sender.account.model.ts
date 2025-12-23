// ============================================================================
// Sender Account Model
// ============================================================================

import { EmailProvider, WarmupStatus } from "./enums";
import type { IOrganization } from "./organization.model";
import type { ISenderRuntime } from "./sender.runtime.model";
import type { IEmailSend } from "./email.send.model";
import type { ICampaignSender } from "./campaign.sender.model";

export interface ISenderAccount {
  id: string;
  email: string;
  name: string | null; // Display name
  provider: EmailProvider;

  // SMTP Config
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null; // Encrypted

  // OAuth Config (for Gmail/Outlook API)
  accessToken: string | null; // Encrypted
  refreshToken: string | null; // Encrypted
  tokenExpiry: Date | null;

  // Limits & Settings
  dailyLimit: number;
  hourlyLimit: number;
  minDelaySeconds: number; // Min gap between emails
  isEnabled: boolean;
  isVerified: boolean;

  // Warmup
  warmupStatus: WarmupStatus;
  warmupStartedAt: Date | null;
  warmupDailyIncrement: number;

  // Signature
  signature: string | null;

  createdAt: Date;
  updatedAt: Date;

  // Relations
  orgId: string;
  organization?: IOrganization;
  runtime?: ISenderRuntime[];
  emailSends?: IEmailSend[];
  campaignSenders?: ICampaignSender[];
}

export type ICreateSenderAccount = {
  id?: string
  accountId: string
  email: string
  name?: string | null
  provider: EmailProvider

  // SMTP Config
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpSecure?: boolean | null
  
  // IMAP Config
  imapHost?: string | null
  imapPort?: number | null
  imapUser?: string | null
  imapPass?: string | null
  imapSecure?: boolean | null

  // OAuth Config (for Gmail/Outlook API)
  accessToken?: string | null
  refreshToken?: string | null
  tokenExpiry?: Date | string | null

  dailyLimit?: number
  hourlyLimit?: number
  minDelaySeconds?: number
  isEnabled?: boolean
  isVerified?: boolean

  // Warmup
  warmupStatus?: WarmupStatus
  warmupStartedAt?: Date | string | null
  warmupDailyIncrement?: number
  
  signature?: string | null
  createdAt?: Date | string
  updatedAt?: Date | string
  organization: IOrganization
  runtime?: ISenderRuntime[]
  emailSends?: IEmailSend[]
  campaignSenders?: ICampaignSender[]
}

export interface IUpdateSenderAccount {
  id?: string
  accountId?: string
  email?: string
  name?: string | null
  provider?: EmailProvider
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpSecure?: boolean | null
  imapHost?: string | null
  imapPort?: number | null
  imapUser?: string | null
  imapPass?: string | null
  imapSecure?: boolean | null
  accessToken?: string | null
  refreshToken?: string | null
  tokenExpiry?: Date | string | null
  dailyLimit?: number
  hourlyLimit?: number
  minDelaySeconds?: number
  isEnabled?: boolean
  isVerified?: boolean
  warmupStatus?: WarmupStatus
  warmupStartedAt?: Date | string | null
  warmupDailyIncrement?: number
  signature?: string | null
  createdAt?: Date | string
  updatedAt?: Date | string
  organization?: IOrganization
  runtime?: ISenderRuntime[]
  emailSends?: IEmailSend[]
  campaignSenders?: ICampaignSender[]
}

// Response type (without sensitive fields)
export interface ISenderAccountResponse {
  id: string;
  email: string;
  name: string | null;
  provider: EmailProvider;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  dailyLimit: number;
  hourlyLimit: number;
  minDelaySeconds: number;
  isEnabled: boolean;
  isVerified: boolean;
  warmupStatus: WarmupStatus;
  warmupStartedAt: Date | null;
  warmupDailyIncrement: number;
  signature: string | null;
  createdAt: Date;
  updatedAt: Date;
  orgId: string;
}

