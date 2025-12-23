// ============================================================================
// Lead Model (Recipients)
// ============================================================================

import type { IOrganization } from "./organization.model";
import type { IUser } from "./user.model";
import type { ICampaignLead } from "./campaign.lead.model";
import type { IEmailSend } from "./email.send.model";
import type { IEmailEvent } from "./email.event.model";

export interface ILead {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;

  // Company info
  company: string | null;
  designation: string | null;
  industry: string | null;
  linkedinUrl: string | null;
  website: string | null;
  phone: string | null;

  // Location
  city: string | null;
  state: string | null;
  country: string | null;

  // Status
  isVerified: boolean; // Email verified
  isBlocked: boolean;
  isUnsubscribed: boolean;
  unsubscribedAt: Date | null;

  // Source tracking
  source: string | null; // csv_upload, api, manual, etc.
  fileName: string | null; // Original CSV file name

  createdAt: Date;
  updatedAt: Date;

  // Relations
  orgId: string;
  organization?: IOrganization;
  uploadedById: string | null;
  uploadedBy?: IUser | null;
  campaigns?: ICampaignLead[];
  emailSends?: IEmailSend[];
  events?: IEmailEvent[];
}

// Input types for creating/updating
export interface ICreateLead {
    id?: string
    email: string
    orgId: string
    firstName?: string | null
    lastName?: string | null
    company?: string | null
    designation?: string | null
    industry?: string | null
    linkedinUrl?: string | null
    website?: string | null
    phone?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    isVerified?: boolean
    isBlocked?: boolean
    isUnsubscribed?: boolean
    unsubscribedAt?: Date | string | null
    source?: string | null
    fileName?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
}

export interface IUpdateLead {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  designation?: string | null;
  industry?: string | null;
  linkedinUrl?: string | null;
  website?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isVerified?: boolean;
  isBlocked?: boolean;
  isUnsubscribed?: boolean;
  unsubscribedAt?: Date | null;
  source?: string | null;
  fileName?: string | null;
}

// Bulk import type
export interface ILeadImportRow {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  designation?: string;
  industry?: string;
  linkedinUrl?: string;
  website?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  [key: string]: string | undefined; // Custom fields
}

