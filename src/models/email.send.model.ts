// ============================================================================
// Email Send Model (Tracking sent emails)
// ============================================================================

import { EmailSendStatus } from "./enums";
import type { ICampaign } from "./campaign.model";
import type { ISenderAccount } from "./sender.account.model";
import type { ILead } from "./lead.model";
import type { ISequence } from "./sequence.model";
import type { IEmailEvent } from "./email.event.model";

export interface IEmailSend {
  id: string;
  status: EmailSendStatus;

  // Which sequence step was used
  sequenceStep: number | null;

  // Provider response
  providerMsgId: string | null;
  threadId: string | null;

  // Error tracking
  errorMessage: string | null;
  errorCode: string | null;
  attempts: number;
  lastAttemptAt: Date | null;

  // Timestamps
  queuedAt: Date;
  sentAt: Date | null;

  createdAt: Date;
  updatedAt: Date;

  // Relations
  campaignId: string;
  campaign?: ICampaign;
  senderId: string;
  sender?: ISenderAccount;
  leadId: string;
  lead?: ILead;
  sequenceId: string | null;
  sequence?: ISequence | null;
  events?: IEmailEvent[];
}

// Input types for creating/updating
export interface ICreateEmailSend {
  status?: EmailSendStatus;
  sequenceStep?: number | null;
  campaignId: string;
  senderId: string;
  leadId: string;
  sequenceId?: string | null;
}

export interface IUpdateEmailSend {
  status?: EmailSendStatus;
  providerMsgId?: string | null;
  threadId?: string | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  attempts?: number;
  lastAttemptAt?: Date | null;
  sentAt?: Date | null;
}

