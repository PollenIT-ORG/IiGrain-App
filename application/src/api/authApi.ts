import { isAxiosError } from 'axios';
import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import { normalizeEnrollmentId } from '../utils/enrollmentId';
import { isEmailNotVerifiedError } from '../utils/sessionGuards';

interface Envelope<T> {
  data: T;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  emailVerified?: boolean;
  avatarUrl?: string | null;
}

export const FARMER_ROLE = 'farmer';

export interface RegisterPayload {
  fullName: string;
  email?: string;
  phone: string;
  password: string;
  enrollmentId: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface VerifyOtpPayload {
  email: string;
  code: string;
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  newPassword: string;
}

interface AuthData {
  token: string;
  refreshToken?: string;
  user?: AuthUser;
}

export interface RefreshData {
  token: string;
  refreshToken?: string;
}

interface RegisterData {
  email?: string;
  verificationRequired: boolean;
  code?: string;
}

export interface RequestOtpData {
  code?: string;
}

interface MeData {
  user: AuthUser;
}

interface RawAuthUser {
  id: string;
  full_name?: string;
  fullName?: string;
  email: string;
  phone?: string | null;
  role: string;
  is_email_verified?: boolean;
  emailVerified?: boolean;
  avatar_url?: string | null;
  avatarUrl?: string | null;
}

const cleanAvatarUrl = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed || null;
};

export const normalizeAuthUser = (raw: RawAuthUser): AuthUser => ({
  id: raw.id,
  fullName: raw.fullName ?? raw.full_name ?? '',
  email: raw.email,
  phone: raw.phone ?? undefined,
  role: raw.role,
  emailVerified: raw.emailVerified ?? raw.is_email_verified,
  avatarUrl: cleanAvatarUrl(raw.avatarUrl) ?? cleanAvatarUrl(raw.avatar_url),
});

export const register = async (payload: RegisterPayload): Promise<RegisterData> => {
  const { email, ...rest } = payload;
  const res = await http.post<Envelope<RegisterData>>(Endpoints.auth.register, {
    ...rest,
    ...(email ? { email } : {}),
    role: FARMER_ROLE,
    enrollmentId: normalizeEnrollmentId(payload.enrollmentId ?? ''),
  });
  return res.data.data;
};

export interface EnrollmentIdLookup {
  enrollmentId: string;
  fullName: string | null;
  maskedEmail: string;
  maskedPhone: string | null;
  programName: string | null;
}

interface RawEnrollmentIdLookup {
  enrollmentId?: string;
  fullName?: string | null;
  maskedEmail?: string;
  maskedPhone?: string | null;
  programName?: string | null;
}

export const lookupEnrollmentId = async (
  enrollmentId: string,
): Promise<EnrollmentIdLookup> => {
  const id = normalizeEnrollmentId(enrollmentId);
  const res = await http.post<Envelope<RawEnrollmentIdLookup>>(
    Endpoints.auth.enrollmentIdLookup,
    { enrollmentId: id },
  );
  const raw = res.data.data ?? {};
  return {
    enrollmentId: raw.enrollmentId ?? id,
    fullName: raw.fullName?.trim() || null,
    maskedEmail: raw.maskedEmail ?? '',
    maskedPhone: raw.maskedPhone ?? null,
    programName: raw.programName?.trim() || null,
  };
};

export const login = async (payload: LoginPayload): Promise<AuthData> => {
  const res = await http.post<Envelope<AuthData>>(Endpoints.auth.login, payload);
  const data = res.data.data;
  return data.user ? { ...data, user: normalizeAuthUser(data.user) } : data;
};

export const requestOtp = async (email: string): Promise<RequestOtpData> => {
  const res = await http.post<Envelope<RequestOtpData>>(Endpoints.auth.requestOtp, {
    email,
  });
  return res.data?.data ?? {};
};

export const verifyOtp = async (payload: VerifyOtpPayload): Promise<AuthData> => {
  const res = await http.post<Envelope<AuthData>>(Endpoints.auth.verifyOtp, payload);
  const data = res.data.data;
  return data.user ? { ...data, user: normalizeAuthUser(data.user) } : data;
};

export const forgotPassword = async (email: string): Promise<RequestOtpData> => {
  const res = await http.post<Envelope<RequestOtpData>>(Endpoints.auth.forgotPassword, {
    email,
  });
  return res.data?.data ?? {};
};

export const verifyResetCode = async (payload: VerifyOtpPayload): Promise<void> => {
  await http.post(Endpoints.auth.verifyResetCode, payload);
};

export const resetPassword = async (payload: ResetPasswordPayload): Promise<void> => {
  await http.post(Endpoints.auth.resetPassword, payload);
};

export const refreshAuthToken = async (refreshToken: string): Promise<RefreshData> => {
  const res = await http.post<Envelope<RefreshData>>(Endpoints.auth.refreshToken, {
    refreshToken,
  });
  return res.data.data;
};

export const logout = async (refreshToken: string): Promise<void> => {
  await http.post(Endpoints.auth.logout, { refreshToken });
};

export const me = async (): Promise<AuthUser> => {
  const res = await http.get<Envelope<MeData>>(Endpoints.auth.me);
  return normalizeAuthUser(res.data.data.user);
};

export const isUnverifiedEmailError = (error: unknown): boolean => {
  if (!isAxiosError(error)) {
    return false;
  }
  return isEmailNotVerifiedError(error);
};

export interface EmailAvailability {
  email: string;
  exists: boolean;
  available: boolean;
}

export const checkEmailAvailability = async (
  email: string,
): Promise<EmailAvailability> => {
  const res = await http.get<Envelope<EmailAvailability>>(Endpoints.auth.checkEmail, {
    params: { email },
    silent: true,
  });
  const data = res.data?.data;
  return {
    email: data?.email ?? email,
    exists: data?.exists ?? false,
    available: data?.available ?? true,
  };
};
