// ============================================================================
// Sender Runtime Model
// ============================================================================

import type { ISenderAccount } from "./sender.account.model";

export interface ISenderRuntime {
  id: string;
  senderId: string;
  dayKey: string; // YYYY-MM-DD
  sentToday: number;
  sentThisHour: number;
  hourKey: string | null; // YYYY-MM-DD-HH
  lastSentAt: Date | null;
  lockedAt: Date | null;
  lockedBy: string | null; // Instance ID for distributed locking

  createdAt: Date;
  updatedAt: Date;

  // Relations
  sender?: ISenderAccount;
}

// Input types for creating/updating
export interface ICreateSenderRuntime {
  senderId: string;
  dayKey: string;
  sentToday?: number;
  sentThisHour?: number;
  hourKey?: string | null;
  lastSentAt?: Date | null;
}

export interface IUpdateSenderRuntime {
  sentToday?: number;
  sentThisHour?: number;
  hourKey?: string | null;
  lastSentAt?: Date | null;
  lockedAt?: Date | null;
  lockedBy?: string | null;
}

