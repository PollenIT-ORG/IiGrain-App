import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type { AuthUser } from '../../api/authApi';
import type { UserProfile } from '../../api/profileApi';
import { capitalize, getInitials } from '../../utils';

export const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

type IdentitySource = {
  avatarUrl?: string | null;
  avatar_url?: string | null;
} | null | undefined;

export interface ProfileIdentity {
  id?: string;
  displayName: string;
  email: string;
  phone?: string;
  role: string;
  roleLabel: string;
  initials: string;
  avatarUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
  hasProfile: boolean;
  isHydrating: boolean;
}

const nonEmpty = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

export const resolveAvatarUrl = (...sources: IdentitySource[]): string | null => {
  for (const source of sources) {
    const url = nonEmpty(source?.avatarUrl) ?? nonEmpty(source?.avatar_url);
    if (url) {
      return url;
    }
  }
  return null;
};

export const selectCurrentProfile = (state: RootState): UserProfile | null => {
  const profile = state.user.profile;
  const authUser = state.auth.user;
  if (!profile) {
    return null;
  }
  if (authUser?.id && profile.id !== authUser.id) {
    return null;
  }
  return profile;
};

export const selectIsProfileFresh = (state: RootState): boolean => {
  const profile = selectCurrentProfile(state);
  const fetchedAt = state.user.lastFetchedAt;
  return Boolean(
    profile &&
      fetchedAt &&
      Date.now() - fetchedAt < PROFILE_CACHE_TTL_MS,
  );
};

export const shouldHydrateProfile = (
  state: RootState,
  force = false,
): boolean => {
  if (state.auth.status !== 'authenticated' || !state.auth.user || state.user.loading) {
    return false;
  }
  if (force) {
    return true;
  }
  return !selectIsProfileFresh(state);
};

export const buildProfileIdentity = (
  profile: UserProfile | null,
  authUser: AuthUser | null,
  isHydrating: boolean,
  defaultName = 'Farmer',
): ProfileIdentity => {
  const displayName =
    nonEmpty(profile?.fullName) ?? nonEmpty(authUser?.fullName) ?? defaultName;
  const email = nonEmpty(profile?.email) ?? nonEmpty(authUser?.email) ?? '';
  const role = nonEmpty(profile?.role) ?? nonEmpty(authUser?.role) ?? '';
  return {
    id: profile?.id ?? authUser?.id,
    displayName,
    email,
    phone: nonEmpty(profile?.phone) ?? nonEmpty(authUser?.phone),
    role,
    roleLabel: role ? capitalize(role) : defaultName,
    initials: getInitials(displayName) || defaultName.charAt(0).toUpperCase(),
    avatarUrl: resolveAvatarUrl(profile, authUser),
    createdAt: profile?.createdAt,
    updatedAt: profile?.updatedAt,
    hasProfile: Boolean(profile),
    isHydrating,
  };
};

const selectAuthUser = (state: RootState): AuthUser | null => state.auth.user;
const selectProfileLoading = (state: RootState): boolean => state.user.loading;

export const selectProfileIdentity = createSelector(
  [selectCurrentProfile, selectAuthUser, selectProfileLoading],
  (profile, authUser, loading): ProfileIdentity =>
    buildProfileIdentity(profile, authUser, loading && !profile),
);

