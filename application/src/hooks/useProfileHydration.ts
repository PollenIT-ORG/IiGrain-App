import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { fetchProfileThunk } from '../redux/thunks/profileThunks';
import { selectAuthStatus, selectAuthUser } from '../redux/slices/authSlice';
import { selectProfile, selectProfileError } from '../redux/slices/userSlice';

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

/**
 * Single hydration point for the user profile.
 *
 * The login and bootstrap responses do not carry an avatar, so `GET /profile/me`
 * is the only source of one. Mounting this once at the navigation root means the
 * profile is loaded as soon as the user is authenticated, rather than depending
 * on which screen the user happens to open first.
 *
 * `fetchProfileThunk` carries its own freshness `condition`, so every dispatch
 * here is deduplicated and TTL-gated — repeated triggers cost no requests.
 */
export const useProfileHydration = (): void => {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAuthStatus);
  const authUser = useAppSelector(selectAuthUser);
  const profile = useAppSelector(selectProfile);
  const error = useAppSelector(selectProfileError);

  const authUserId = authUser?.id;
  const isAuthenticated = status === 'authenticated';
  const [attempt, setAttempt] = useState(0);

  // Reset the retry budget whenever the identity changes, so a new session is
  // never blocked by the previous one having exhausted its attempts.
  const lastIdentity = useRef<string | null>(null);
  useEffect(() => {
    const identity = isAuthenticated ? authUserId ?? 'authenticated' : null;
    if (lastIdentity.current !== identity) {
      lastIdentity.current = identity;
      setAttempt(0);
    }
  }, [isAuthenticated, authUserId]);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchProfileThunk());
    }
  }, [dispatch, isAuthenticated, authUserId, attempt]);

  // The fetch can fail transiently — right after login the app is issuing several
  // requests at once. Without this the profile would stay empty for the whole
  // session, because nothing else retries it.
  useEffect(() => {
    if (!isAuthenticated || profile || !error || attempt >= MAX_RETRIES) {
      return undefined;
    }
    const timer = setTimeout(() => setAttempt(a => a + 1), RETRY_BASE_MS * 2 ** attempt);
    return () => clearTimeout(timer);
  }, [isAuthenticated, profile, error, attempt]);

  // Returning from the background is the one moment a cached profile is most
  // likely to have gone stale (avatar changed on another device).
  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        dispatch(fetchProfileThunk());
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [dispatch, isAuthenticated]);
};
