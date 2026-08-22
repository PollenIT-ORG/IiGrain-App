export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorOptions {
  code?: string;
  errors?: FieldError[];
  isOperational?: boolean;
}

export interface AppEnv {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  apiPrefix: string;

  databaseUrl: string;
  dbSync: boolean;
  dbSeed: boolean;

  saasEnabled: boolean;

  superAdmin: {
    email: string;
    password: string;
    fullName: string;
  };

  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };

  jwt: {
    secret: string;
    expiresIn: string;
  };

  refreshToken: {
    expiryDays: number;
  };

  otp: {
    length: number;
    expiryMinutes: number;
  };

  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromName: string;
    fromEmail: string;
  };

  appUrl: string;
  websiteUrl: string;
  surveyAppUrl: string;
  mobileAppUrl: string;

  rateLimit: {
    enabled: boolean;
    windowMs: number;
    max: number;
  };

  visitArrival: {
    enforce: boolean;
    boundaryToleranceM: number;
    pointToleranceM: number;
  };

  isProduction: boolean;
  isDevelopment: boolean;
}

export type RoleName =
  | "super_admin"
  | "admin"
  | "program_administrator"
  | "program_partner"
  | "assessor"
  | "farmer";

export interface Role {
  id: number;
  name: RoleName;
  description: string | null;
  created_at: Date;
  deleted_at: Date | null;
}

export interface User {
  id: string;
  role_id: number;
  org_id: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  password_hash: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type LoginStatus = "success" | "failed";

export type LoginMethod = "password" | "otp";

export interface LoginLog {
  id: string;
  user_id: string | null;
  email: string;
  method: LoginMethod;
  status: LoginStatus;
  ip_address: string | null;
  user_agent: string | null;
  reason: string | null;
  created_at: Date;
  deleted_at: Date | null;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface Farm {
  id: string;
  name: string;
  area_acres: string | null;
  location: string | null;
  owner_id: string;
  org_id: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type ResponseMeta = Record<string, unknown>;
