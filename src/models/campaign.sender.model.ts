// ============================================================================
// Campaign Sender Model (Junction table: Campaign <-> SenderAccount)
// ============================================================================

import type { ICampaign } from "./campaign.model";
import type { ISenderAccount } from "./sender.account.model";

export interface ICampaignSender {
  id: string;
  campaignId: string;
  senderId: string;
  weight: number; // For weighted distribution
  isActive: boolean;

  createdAt: Date;

  // Relations
  campaign?: ICampaign;
  sender?: ISenderAccount;
}

// Input types for creating/updating
export interface ICreateCampaignSender {
  campaignId: string;
  senderId: string;
  weight?: number;
  isActive?: boolean;
}

export interface IUpdateCampaignSender {
  weight?: number;
  isActive?: boolean;
}

