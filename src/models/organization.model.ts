// ============================================================================
// Organization Model
// ============================================================================

import type { IUser } from "./user.model";
import type { ISenderAccount } from "./sender.account.model";
import type { ICampaign } from "./campaign.model";
import type { ILead } from "./lead.model";
import type { IOrganizationPlan } from "./organisation.plan.model";
import type { IApiKey } from "./api.key.model";

export interface IOrganization {
  id: string;
  name: string;
  domain: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip: string | null;
  industry: string | null;
  description: string | null;
  logoUrl: string | null;
  timezone: string;

  createdAt: Date;
  updatedAt: Date;

  // Relations
  users?: IUser[];
  senderAccounts?: ISenderAccount[];
  campaigns?: ICampaign[];
  leads?: ILead[];
  plans?: IOrganizationPlan[];
  apiKeys?: IApiKey[];
}

// Input types for creating/updating
export interface ICreateOrganization {
  name: string;
  domain?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip?: string | null;
  industry?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  timezone?: string;
}

export interface IUpdateOrganization {
  name?: string;
  domain?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip?: string | null;
  industry?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  timezone?: string;
}
