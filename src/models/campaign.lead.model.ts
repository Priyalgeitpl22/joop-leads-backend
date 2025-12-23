// ============================================================================
// Campaign Lead Model (Junction table: Campaign <-> Lead with status tracking)
// ============================================================================

import { LeadStatus } from "./enums";
import type { ICampaign } from "./campaign.model";
import type { ILead } from "./lead.model";

export interface ICampaignLead {
  id: string;
  campaignId: string;
  leadId: string;
  status: LeadStatus;

  // Track which sequence step we're at
  currentSequenceStep: number; // 0 = not started

  // Scheduling
  nextSendAt: Date | null;

  // Last activity
  lastSentAt: Date | null;
  lastOpenedAt: Date | null;
  lastClickedAt: Date | null;
  lastRepliedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;

  // Relations
  campaign?: ICampaign;
  lead?: ILead;
}

// Input types for creating/updating
export interface ICreateCampaignLead {
  campaignId: string;
  leadId: string;
  status?: LeadStatus;
  currentSequenceStep?: number;
  nextSendAt?: Date | null;
}

export interface IUpdateCampaignLead {
  status?: LeadStatus;
  currentSequenceStep?: number;
  nextSendAt?: Date | null;
  lastSentAt?: Date | null;
  lastOpenedAt?: Date | null;
  lastClickedAt?: Date | null;
  lastRepliedAt?: Date | null;
}

