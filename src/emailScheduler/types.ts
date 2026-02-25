import { SequenceType } from "../interfaces";

/** Canonical skip reasons for sender ineligibility (stored in trigger log + campaign.stoppedDetails) */
export const SenderSkipReason = {
  SENDER_NOT_ACTIVE: "sender_not_active",
  COULD_NOT_ACQUIRE_LOCK: "could_not_acquire_lock",
  SENDER_DAILY_LIMIT_REACHED: "sender_daily_limit_reached",
  SEND_GAP_TOO_SHORT: "send_gap_too_short",
  NO_PENDING_LEADS: "no_pending_leads",
} as const;

export type SenderSkipReasonType = (typeof SenderSkipReason)[keyof typeof SenderSkipReason];

export const TriggerStatus = {
    SUCCESS: "SUCCESS",
    PARTIAL: "PARTIAL",
    SKIPPED: "SKIPPED",
    NO_PENDING: "NO_PENDING",
    OUTSIDE_SCHEDULE: "OUTSIDE_SCHEDULE",
    DAILY_LIMIT: "DAILY_LIMIT",
    ERROR: "ERROR",
} as const;

export type TriggerStatusType = typeof TriggerStatus[keyof typeof TriggerStatus];

export interface SenderDetail {
    email: string;
    sent: number;
    skipped: boolean;
    skipReason?: string;
}

export interface LeadDetail {
    leadId: string;
    email: string;
    sequenceStep: number;
    isNewLead: boolean;
    status: string;
}

export interface TriggerContext {
    startTime: Date;
    campaignId: string;
    timezone: string;
    nextTriggerAt: Date | null;
    totalEmailsSent: number;
    newLeadEmails: number;
    followUpEmails: number;
    status: TriggerStatusType;
    activityLog: string[];
    senderDetails: Record<string, SenderDetail>;
    leadDetails: LeadDetail[];
}

export interface SequenceAnalytics {
    emailType: SequenceType;
    seqNumber: number;
    subject: string | null;
    totalLeads: number;
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    positiveReplies: number;
    bounced: number;
    senderBounced: number;
    failed: number;
    unsubscribed: number;
}
