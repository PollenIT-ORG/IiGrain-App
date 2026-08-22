import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { fetchProfileThunk } from '../redux/thunks/profileThunks';
import { selectAuthStatus, selectAuthUser } from '../redux/slices/authSlice';
import { selectProfile, selectProfileError } from '../redux/slices/userSlice';

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

export const useProfileHydration = (): void => {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAuthStatus);
  const authUser = useAppSelector(selectAuthUser);
  const profile = useAppSelector(selectProfile);
  const error = useAppSelector(selectProfileError);

  const authUserId = authUser?.id;
  const isAuthenticated = status === 'authenticated';
  const [attempt, setAttempt] = useState(0);

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

  useEffect(() => {
    if (!isAuthenticated || profile || !error || attempt >= MAX_RETRIES) {
      return undefined;
    }
    const timer = setTimeout(() => setAttempt(a => a + 1), RETRY_BASE_MS * 2 ** attempt);
    return () => clearTimeout(timer);
  }, [isAuthenticated, profile, error, attempt]);

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
