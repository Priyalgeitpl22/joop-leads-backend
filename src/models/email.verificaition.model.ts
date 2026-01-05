// models/emailVerification.model.ts

export enum BatchStatus {
  PENDING = "PENDING",
  UPLOADING = "UPLOADING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum EmailStatus {
  SAFE = "SAFE",
  INVALID = "INVALID",
  DISABLED = "DISABLED",
  DISPOSABLE = "DISPOSABLE",
  INBOX_FULL = "INBOX_FULL",
  CATCH_ALL = "CATCH_ALL",
  ROLE_ACCOUNT = "ROLE_ACCOUNT",
  SPAMTRAP = "SPAMTRAP",
  UNKNOWN = "UNKNOWN",
}

export interface IEmailVerificationBatch {
  id: string;
  name: string;
  fileName: string;
  totalEmails: number;
  verifiedCount: number;
  status: BatchStatus;
  reoonTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
  orgId: string;
  uploadedById: string;
}

export interface IVerifiedEmail {
  id: string;
  batchId: string;
  email: string;
  status: EmailStatus | null;
  username: string | null;
  domain: string | null;
  isSafeToSend: boolean | null;
  isDeliverable: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateBatch {
  name: string;
  fileName: string;
  emails: string[];
  orgId: string;
  uploadedById: string;
}

export interface IReoonVerificationResponse {
  email: string;
  status: string;
  username: string;
  domain: string;
  is_safe_to_send: boolean;
  is_deliverable: boolean;
}

export interface IBulkVerificationTaskResponse {
  status: string;
  task_id: string;
  name: string;
  count_total: number;
  count_checked: number;
  results?: IReoonVerificationResponse[];
}