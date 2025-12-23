// ============================================================================
// API Key Model
// ============================================================================

import type { IOrganization } from "./organization.model";

export interface IApiKey {
  id: string;
  name: string;
  key: string;
  lastUsedAt: Date | null;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;

  // Relations
  orgId: string;
  organization?: IOrganization;
}

// Input types for creating/updating
export interface ICreateApiKey {
  name: string;
  key: string;
  orgId: string;
  isActive?: boolean;
}

export interface IUpdateApiKey {
  name?: string;
  lastUsedAt?: Date | null;
  isActive?: boolean;
}

// Response type (key is partially masked)
export interface IApiKeyResponse {
  id: string;
  name: string;
  keyPreview: string; // e.g., "sk_***...abc"
  lastUsedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  orgId: string;
}

