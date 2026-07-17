import { isAxiosError } from 'axios';
import http from '../services/http';
import { Endpoints } from '../config/endpoints';

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
  const res = await http.post<Envelope<RegisterData>>(Endpoints.auth.register, payload);
  return res.data.data;
};

export const login = async (payload: LoginPayload): Promise<AuthData> => {
  const res = await http.post<Envelope<AuthData>>(Endpoints.auth.login, payload);
  return res.data.data;
};

export const requestOtp = async (email: string): Promise<RequestOtpData> => {
  const res = await http.post<Envelope<RequestOtpData>>(Endpoints.auth.requestOtp, {
    email,
  });
  return res.data?.data ?? {};
};

export const verifyOtp = async (payload: VerifyOtpPayload): Promise<AuthData> => {
  const res = await http.post<Envelope<AuthData>>(Endpoints.auth.verifyOtp, payload);
  return res.data.data;
};

export const forgotPassword = async (email: string): Promise<RequestOtpData> => {
  const res = await http.post<Envelope<RequestOtpData>>(Endpoints.auth.forgotPassword, {
    email,
  });
  return res.data?.data ?? {};
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
  return res.data.data.user;
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
  if (status === 403) {
    return true;
  }
  const message = (error.message ?? '').toLowerCase();
  return message.includes('verif');
};
