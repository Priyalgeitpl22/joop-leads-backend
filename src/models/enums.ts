// ============================================================================
// ENUMS - All application enums matching Prisma schema
// ============================================================================

export enum UserRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
  VIEWER = "VIEWER",
}

export enum CampaignStatus {
  DRAFT = "DRAFT",
  SCHEDULED = "SCHEDULED",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  COMPLETED = "COMPLETED",
  ARCHIVED = "ARCHIVED",
}

export enum LeadStatus {
  PENDING = "PENDING",              // Not yet contacted
  QUEUED = "QUEUED",                // In queue to be sent
  SENT = "SENT",                    // Email sent successfully
  OPENED = "OPENED",                // Email was opened
  CLICKED = "CLICKED",              // Link was clicked
  REPLIED = "REPLIED",              // Lead replied
  POSITIVE_REPLY = "POSITIVE_REPLY", // Positive reply
  BOUNCED = "BOUNCED",                // Email bounced
  SENDER_BOUNCED = "SENDER_BOUNCED",  // Sender Bounced
  UNSUBSCRIBED = "UNSUBSCRIBED",      // Lead unsubscribed
  FAILED = "FAILED",                  // Failed to send
}

export enum EmailSendStatus {
  QUEUED = "QUEUED",
  SENDING = "SENDING",
  SENT = "SENT",
  FAILED = "FAILED",
  BOUNCED = "BOUNCED",
  SENDER_BOUNCED = "SENDER_BOUNCED",
  REPLIED = "REPLIED",
  OPENED = "OPENED",
  CLICKED = "CLICKED",
  STOPPED = "STOPPED",
}

export enum SequenceType {
  EMAIL = "EMAIL",
  WAIT = "WAIT",
  MANUAL_TASK = "MANUAL_TASK",
}

export enum EmailProvider {
  SMTP = "smtp",
  GMAIL = "gmail",
  OUTLOOK = "outlook",
  IMAP = "imap",
}

export enum WarmupStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  PAUSED = "PAUSED",
}

export enum PlanCode {
  FREE = "FREE",
  STARTER = "STARTER",
  PROFESSIONAL = "PROFESSIONAL",
  ENTERPRISE = "ENTERPRISE",
}

export enum BillingPeriod {
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}

export enum EventType {
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  OPENED = "OPENED",
  CLICKED = "CLICKED",
  REPLIED = "REPLIED",
  POSITIVE_REPLY = "POSITIVE_REPLY",
  BOUNCED = "BOUNCED",
  SENDER_BOUNCED = "SENDER_BOUNCED",
  UNSUBSCRIBED = "UNSUBSCRIBED",
  COMPLAINED = "COMPLAINED",
}

export enum SenderAccountState {
  INIT = "INIT",
  CONNECTED = "CONNECTED",
  ERROR = "ERROR",
}