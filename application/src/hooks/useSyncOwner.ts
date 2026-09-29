import { useEffect, useRef } from 'react';
import { useAppSelector } from '../redux/hooks';
import { selectAuthUser } from '../redux/slices/authSlice';
import { isDatabaseReady } from '../services/db';
import { getSyncSubsystem } from '../services/sync';

export const useSyncOwner = (databaseReady: boolean): void => {
  const user = useAppSelector(selectAuthUser);
  const activeId = useRef<string | null>(null);

  useEffect(() => {
    if (!databaseReady || !isDatabaseReady()) {
      return;
    }

    const subsystem = getSyncSubsystem();

    if (!user?.id) {
      if (activeId.current !== null) {
        activeId.current = null;
        subsystem.deactivate().catch(() => undefined);
      }
      return;
    }

    if (activeId.current === user.id) {
      return;
    }

    activeId.current = user.id;
    subsystem
      .activate({
        id: user.id,
        email: user.email ?? null,
        fullName: user.fullName ?? null,
        role: user.role ?? null,
      })
      .catch(() => undefined);
  }, [databaseReady, user]);
};
