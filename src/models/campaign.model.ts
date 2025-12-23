// ============================================================================
// Campaign Model
// ============================================================================

import { CampaignStatus } from "./enums";
import type { IOrganization } from "./organization.model";
import type { IUser } from "./user.model";
import type { ISequence } from "./sequence.model";
import type { ICampaignLead } from "./campaign.lead.model";
import type { ICampaignSender } from "./campaign.sender.model";
import type { ICampaignRuntime } from "./campaign.runtime.model";
import type { ICampaignAnalytics } from "./campaign.analytics.model";
import type { IEmailSend } from "./email.send.model";

export interface ICampaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;

  // Schedule Settings
  timezone: string;
  sendDays: string[]; // ["Mon", "Tue", "Wed", "Thu", "Fri"]
  windowStart: string; // HH:mm
  windowEnd: string; // HH:mm
  intervalMinutes: number; // Gap between emails
  maxEmailsPerDay: number; // Campaign daily limit

  // Tracking Settings
  trackOpens: boolean;
  trackClicks: boolean;

  // Unsubscribe
  includeUnsubscribeLink: boolean;
  unsubscribeText: string | null;

  createdAt: Date;
  updatedAt: Date;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;

  // Relations
  orgId: string;
  organization?: IOrganization;
  createdById: string | null;
  createdBy?: IUser | null;
  sequences?: ISequence[];
  leads?: ICampaignLead[];
  senders?: ICampaignSender[];
  runtime?: ICampaignRuntime | null;
  analytics?: ICampaignAnalytics | null;
  emailSends?: IEmailSend[];
}

// Input types for creating/updating
export interface ICreateCampaign {
  name?: string;
  description?: string | null;
  status?: CampaignStatus;
  timezone?: string;
  sendDays?: string[];
  windowStart?: string;
  windowEnd?: string;
  intervalMinutes?: number;
  maxEmailsPerDay?: number;
  trackOpens?: boolean;
  trackClicks?: boolean;
  includeUnsubscribeLink?: boolean;
  unsubscribeText?: string | null;
  scheduledAt?: Date | null;
  orgId: string;
  createdById?: string | null;
}

export interface IUpdateCampaign {
  name?: string;
  description?: string | null;
  status?: CampaignStatus;
  timezone?: string;
  sendDays?: string[];
  windowStart?: string;
  windowEnd?: string;
  intervalMinutes?: number;
  maxEmailsPerDay?: number;
  trackOpens?: boolean;
  trackClicks?: boolean;
  includeUnsubscribeLink?: boolean;
  unsubscribeText?: string | null;
  scheduledAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

