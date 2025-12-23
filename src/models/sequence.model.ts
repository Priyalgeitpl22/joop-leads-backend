// ============================================================================
// Sequence Model (Email steps in a campaign)
// ============================================================================

import { SequenceType } from "./enums";
import type { ICampaign } from "./campaign.model";
import type { IEmailSend } from "./email.send.model";

export interface ISequence {
  id: string;
  campaignId: string;
  seqNumber: number; // 1, 2, 3...
  type: SequenceType;

  // Delay before this step (from previous step or campaign start)
  delayDays: number;
  delayHours: number;
  delayMinutes: number;

  // For EMAIL type
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;

  // For MANUAL_TASK type
  taskTitle: string | null;
  taskDescription: string | null;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;

  // Relations
  campaign?: ICampaign;
  emailSends?: IEmailSend[];
}

// Input types for creating/updating
export interface ICreateSequence {
  campaignId: string;
  seqNumber: number;
  type?: SequenceType;
  delayDays?: number;
  delayHours?: number;
  delayMinutes?: number;
  subject?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  taskTitle?: string | null;
  taskDescription?: string | null;
  isActive?: boolean;
}

export interface IUpdateSequence {
  seqNumber?: number;
  type?: SequenceType;
  delayDays?: number;
  delayHours?: number;
  delayMinutes?: number;
  subject?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  taskTitle?: string | null;
  taskDescription?: string | null;
  isActive?: boolean;
}

