import { isAxiosError } from 'axios';
import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import { normalizeEnrollmentId } from '../utils/enrollmentId';
import { accountRevocationFor } from '../utils/sessionGuards';

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

export interface Role {
  value: string;
  label: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: string;
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

const humanize = (value: string): string =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const normalizeRole = (raw: unknown): Role | null => {
  if (typeof raw === 'string' && raw.trim()) {
    return { value: raw, label: humanize(raw) };
  }
  if (typeof raw === 'object' && raw !== null) {
    const record = raw as Record<string, unknown>;
    const value =
      typeof record.value === 'string'
        ? record.value
        : typeof record.name === 'string'
        ? record.name
        : typeof record.id === 'string'
        ? record.id
        : null;
    if (!value) {
      return null;
    }
    const label =
      typeof record.label === 'string'
        ? record.label
        : typeof record.displayName === 'string'
        ? record.displayName
        : humanize(value);
    return { value, label };
  }
  return null;
};

export const register = async (payload: RegisterPayload): Promise<RegisterData> => {
  const res = await http.post<Envelope<RegisterData>>(Endpoints.auth.register, {
    ...payload,
    enrollmentId: normalizeEnrollmentId(payload.enrollmentId ?? ''),
  });
  return res.data.data;
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

const asRoleArray = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    const roles = (value as Record<string, unknown>).roles;
    if (Array.isArray(roles)) {
      return roles;
    }
  }
  return null;
};

export const getRoles = async (): Promise<Role[]> => {
  const res = await http.get<unknown>(Endpoints.roles.list);
  const body = res.data;
  if (__DEV__) {
    console.log('[roles] raw response:', JSON.stringify(body));
  }
  const enveloped =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).data
      : undefined;

  const list = asRoleArray(enveloped) ?? asRoleArray(body) ?? [];
  const roles = list.map(normalizeRole).filter((role): role is Role => role !== null);
  if (__DEV__) {
    console.log(`[roles] parsed ${roles.length} role(s):`, roles);
  }
  return roles;
};

export const isUnverifiedEmailError = (error: unknown): boolean => {
  if (!isAxiosError(error)) {
    return false;
  }
  const status = error.response?.status ?? null;
  const message = error.message ?? '';
  if (accountRevocationFor(status, message)) {
    return false;
  }
  if (status === 403) {
    return true;
  }
  return message.toLowerCase().includes('verif');
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
