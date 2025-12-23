// ============================================================================
// Campaign Runtime Model
// ============================================================================

import type { ICampaign } from "./campaign.model";

export interface ICampaignRuntime {
  id: string;
  campaignId: string;
  dayKey: string; // YYYY-MM-DD in campaign TZ
  sentToday: number;
  nextRunAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null; // Instance ID

  createdAt: Date;
  updatedAt: Date;

  // Relations
  campaign?: ICampaign;
}

// Input types for creating/updating
export interface ICreateCampaignRuntime {
  campaignId: string;
  dayKey: string;
  sentToday?: number;
  nextRunAt: Date;
}

export interface IUpdateCampaignRuntime {
  dayKey?: string;
  sentToday?: number;
  nextRunAt?: Date;
  lockedAt?: Date | null;
  lockedBy?: string | null;
}

