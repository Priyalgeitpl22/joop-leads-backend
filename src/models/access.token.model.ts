// ============================================================================
// Access Token Model
// ============================================================================

export interface IAccessToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// Input types for creating/updating
export interface ICreateAccessToken {
  token: string;
  userId: string;
  expiresAt: Date;
  isActive?: boolean;
}

export interface IUpdateAccessToken {
  isActive?: boolean;
  expiresAt?: Date;
}

