import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import type { AuthUser } from './authApi';

interface Envelope<T> {
  data: T;
}

export interface UserProfile extends AuthUser {
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfilePayload {
  fullName: string;
  phone: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

interface RawUser {
  id: string;
  full_name?: string;
  fullName?: string;
  email: string;
  phone?: string | null;
  role: string;
  is_email_verified?: boolean;
  emailVerified?: boolean;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

type ProfilePayload = RawUser & { user?: RawUser };

const normalizeProfile = (raw: RawUser): UserProfile => ({
  id: raw.id,
  fullName: raw.fullName ?? raw.full_name ?? '',
  email: raw.email,
  phone: raw.phone ?? undefined,
  role: raw.role,
  emailVerified: raw.emailVerified ?? raw.is_email_verified,
  createdAt: raw.createdAt ?? raw.created_at,
  updatedAt: raw.updatedAt ?? raw.updated_at,
});

const unwrapProfile = (payload: ProfilePayload): UserProfile =>
  normalizeProfile(payload.user ?? payload);

export const getMyProfile = async (): Promise<UserProfile> => {
  const res = await http.get<Envelope<ProfilePayload>>(Endpoints.profile.me);
  return unwrapProfile(res.data.data);
};

export const updateMyProfile = async (
  payload: UpdateProfilePayload,
): Promise<UserProfile> => {
  const res = await http.patch<Envelope<ProfilePayload>>(Endpoints.profile.me, payload);
  return unwrapProfile(res.data.data);
};

export const changePassword = async (payload: ChangePasswordPayload): Promise<void> => {
  await http.post(Endpoints.profile.changePassword, payload);
};

export const deleteMyAccount = async (): Promise<void> => {
  await http.delete(Endpoints.profile.me, { silent: true });
};
