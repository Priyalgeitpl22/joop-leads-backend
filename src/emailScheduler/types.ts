import { SequenceType } from "../interfaces";

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
