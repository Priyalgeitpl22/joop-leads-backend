// ============================================================================
// Campaign Analytics Model
// ============================================================================

import type { ICampaign } from "./campaign.model";

export interface ICampaignAnalytics {
  id: string;
  campaignId: string;

  totalLeads: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  repliedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  failedCount: number;

  // Rates (computed, stored for quick access)
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;

  createdAt: Date;
  updatedAt: Date;

  // Relations
  campaign?: ICampaign;
}

// Input types for creating/updating
export interface ICreateCampaignAnalytics {
  campaignId: string;
  totalLeads?: number;
}

export interface IUpdateCampaignAnalytics {
  totalLeads?: number;
  sentCount?: number;
  deliveredCount?: number;
  openedCount?: number;
  clickedCount?: number;
  repliedCount?: number;
  bouncedCount?: number;
  unsubscribedCount?: number;
  failedCount?: number;
  openRate?: number;
  clickRate?: number;
  replyRate?: number;
  bounceRate?: number;
}

