import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import { normalizeAuthUser, type AuthUser } from './authApi';
import type { MediaFile } from '../types/media';

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
  avatar_url?: string | null;
  avatarUrl?: string | null;
}

type ProfilePayload = RawUser & { user?: RawUser };

const normalizeProfile = (raw: RawUser): UserProfile => ({
  ...normalizeAuthUser(raw),
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

interface RawFilePart {
  uri: string;
  name: string;
  type: string;
}

export const uploadMyAvatar = async (file: MediaFile): Promise<UserProfile> => {
  const form = new FormData();
  const part: RawFilePart = { uri: file.uri, name: file.name, type: file.mime };
  form.append('avatar', part as unknown as Blob);
  const res = await http.post<Envelope<ProfilePayload>>(Endpoints.profile.avatar, form, {
    silent: true,
  });
  return unwrapProfile(res.data.data);
};

export const removeMyAvatar = async (): Promise<UserProfile> => {
  const res = await http.delete<Envelope<ProfilePayload>>(Endpoints.profile.avatar, {
    silent: true,
  });
  return unwrapProfile(res.data.data);
};

export const deleteMyAccount = async (): Promise<void> => {
  await http.delete(Endpoints.profile.me, { silent: true });
};
