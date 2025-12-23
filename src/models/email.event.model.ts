// ============================================================================
// Email Event Model (Tracking email events: opens, clicks, etc.)
// ============================================================================

import { EventType } from "./enums";
import type { IEmailSend } from "./email.send.model";
import type { ILead } from "./lead.model";

export interface IEmailEvent {
  id: string;
  type: EventType;
  timestamp: Date;

  // Additional data
  ipAddress: string | null;
  userAgent: string | null;
  linkUrl: string | null; // For CLICKED events

  // Location (from IP)
  city: string | null;
  country: string | null;

  createdAt: Date;

  // Relations
  emailSendId: string;
  emailSend?: IEmailSend;
  leadId: string;
  lead?: ILead;
}

// Input types for creating
export interface ICreateEmailEvent {
  type: EventType;
  timestamp?: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  linkUrl?: string | null;
  city?: string | null;
  country?: string | null;
  emailSendId: string;
  leadId: string;
}

