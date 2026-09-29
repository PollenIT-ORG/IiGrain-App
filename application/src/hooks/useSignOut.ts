import { useCallback, useState } from 'react';
import { useAppDispatch } from '../redux/hooks';
import { logoutThunk } from '../redux/slices/authSlice';
import { isDatabaseReady } from '../services/db';
import { getSyncSubsystem, resolveOwner, syncQueue } from '../services/sync';

export interface SignOutGuard {
  readonly confirming: boolean;
  readonly pendingCount: number;
  readonly checking: boolean;
  requestSignOut: () => Promise<void>;
  confirmSignOut: () => void;
  cancelSignOut: () => void;
}

export const countUnsentWork = async (): Promise<number> => {
  if (!isDatabaseReady()) {
    return 0;
  }
  const owner = getSyncSubsystem().owner() ?? (await resolveOwner());
  if (!owner) {
    return 0;
  }
  return syncQueue.countUnsent(owner);
};

export interface SignOutOptions {
  readonly alwaysConfirm?: boolean;
}

export const useSignOut = (
  onDone?: () => void,
  options: SignOutOptions = {},
): SignOutGuard => {
  const dispatch = useAppDispatch();
  const [confirming, setConfirming] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [checking, setChecking] = useState(false);

  const signOut = useCallback(() => {
    dispatch(logoutThunk());
    onDone?.();
  }, [dispatch, onDone]);

  const requestSignOut = useCallback(async () => {
    setChecking(true);
    let unsent = 0;
    try {
      unsent = await countUnsentWork();
    } catch {
      unsent = 0;
    } finally {
      setChecking(false);
    }

    setPendingCount(unsent);

    if (unsent > 0 || options.alwaysConfirm) {
      setConfirming(true);
      return;
    }
    signOut();
  }, [signOut, options.alwaysConfirm]);

  const confirmSignOut = useCallback(() => {
    setConfirming(false);
    signOut();
  }, [signOut]);

  const cancelSignOut = useCallback(() => {
    setConfirming(false);
  }, []);

  return {
    confirming,
    pendingCount,
    checking,
    requestSignOut,
    confirmSignOut,
    cancelSignOut,
  };
};

export const signOutTitle = (pendingCount: number): string =>
  pendingCount > 0 ? 'Log out with unsent work?' : 'Log out?';

export const signOutConfirmLabel = (pendingCount: number): string =>
  pendingCount > 0 ? 'Log out anyway' : 'Log out';

export const signOutWarning = (pendingCount: number): string =>
  pendingCount === 0
    ? 'You can sign back in at any time.'
    : pendingCount === 1
    ? 'One change made offline has not reached the server yet. It stays saved on this device and will be sent the next time you sign in here with an internet connection.'
    : `${pendingCount} changes made offline have not reached the server yet. They stay saved on this device and will be sent the next time you sign in here with an internet connection.`;
