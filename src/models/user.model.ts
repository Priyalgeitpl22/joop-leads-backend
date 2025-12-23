// ============================================================================
// User Model
// ============================================================================

import { UserRole } from "./enums";
import type { IOrganization } from "./organization.model";
import type { ILead } from "./lead.model";
import type { ICampaign } from "./campaign.model";

export interface IUser {
  id: string;
  email: string;
  fullName: string;
  password: string;
  phone: string | null;
  role: UserRole;
  profilePicture: string | null;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  timezone: string | null;

  // Auth tokens
  otpCode: string | null;
  otpExpiresAt: Date | null;
  resetToken: string | null;
  resetTokenExpiresAt: Date | null;
  activationToken: string | null;
  activationTokenExpiresAt: Date | null;

  createdAt: Date;
  updatedAt: Date;

  // Relations
  orgId: string;
  organization?: IOrganization;
  leadsUploaded?: ILead[];
  campaigns?: ICampaign[];
}

// Input types for creating/updating
export interface ICreateUser {
  email: string;
  fullName: string;
  password?: string;
  phone?: string | null;
  role?: UserRole;
  profilePicture?: string | null;
  timezone?: string | null;
  orgId: string;
}

export interface IAddUser {
  email: string;
  fullName: string;
  phone?: string | null;
  role?: UserRole;
  orgId: string;
}

export interface IUpdateUser {
  email?: string;
  fullName?: string;
  password?: string;
  phone?: string | null;
  role?: UserRole;
  profilePicture?: string | null;
  isVerified?: boolean;
  isActive?: boolean;
  lastLoginAt?: Date | null;
  timezone?: string | null;
  otpCode?: string | null;
  otpExpiresAt?: Date | null;
  resetToken?: string | null;
  resetTokenExpiresAt?: Date | null;
  activationToken?: string | null;
  activationTokenExpiresAt?: Date | null;
}

// Response type (without sensitive fields)
export interface IUserResponse {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  profilePicture: string | null;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  timezone: string | null;
  createdAt: Date;
  updatedAt: Date;
  orgId: string;
}
