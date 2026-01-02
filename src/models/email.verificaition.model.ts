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
  verificationResult: any;
  username: string | null;
  domain: string | null;
  isSafeToSend: boolean | null;
  isValidSyntax: boolean | null;
  isDisposable: boolean | null;
  isRoleAccount: boolean | null;
  canConnectSmtp: boolean | null;
  hasInboxFull: boolean | null;
  isCatchAll: boolean | null;
  isDeliverable: boolean | null;
  isDisabled: boolean | null;
  isSpamtrap: boolean | null;
  mxAcceptsMail: boolean | null;
  mxRecords: string[];
  verificationMode: string | null;
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
  is_valid_syntax: boolean;
  is_disposable: boolean;
  is_role_account: boolean;
  can_connect_smtp: boolean;
  has_inbox_full: boolean;
  is_catch_all: boolean;
  is_deliverable: boolean;
  is_disabled: boolean;
  is_spamtrap: boolean | null;
  mx_accepts_mail: boolean;
  mx_records: string[];
  verification_mode: string;
}

export interface IBulkVerificationTaskResponse {
  status: string;
  task_id: string;
  name: string;
  count_total: number;
  count_checked: number;
  results?: IReoonVerificationResponse[];
}