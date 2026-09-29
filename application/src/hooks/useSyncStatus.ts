import { useCallback, useEffect, useRef, useState } from 'react';
import { isDatabaseReady } from '../services/db';
import {
  getSyncSubsystem,
  netInfoConnectivity,
  subscribeToSyncQueue,
  syncQueue,
} from '../services/sync';

export type SyncPhase = 'idle' | 'offline' | 'syncing' | 'failed' | 'synced';

export interface SyncStatus {
  readonly online: boolean;
  readonly pending: number;
  readonly failed: number;
  readonly retrying: boolean;
  readonly justSynced: boolean;
  readonly signedIn: boolean;
}

export interface SyncStatusApi extends SyncStatus {
  readonly phase: SyncPhase;
  retry: () => void;
}

const INITIAL: SyncStatus = {
  online: true,
  pending: 0,
  failed: 0,
  retrying: false,
  justSynced: false,
  signedIn: false,
};

const SYNCED_VISIBLE_MS = 2600;

export const phaseFor = (status: SyncStatus): SyncPhase => {
  if (!status.signedIn) {
    return 'idle';
  }
  if (!status.online) {
    return 'offline';
  }
  if (status.failed > 0) {
    return 'failed';
  }
  if (status.pending > 0) {
    return 'syncing';
  }
  return status.justSynced ? 'synced' : 'idle';
};

export const useSyncStatus = (): SyncStatusApi => {
  const [status, setStatus] = useState<SyncStatus>(INITIAL);
  const outstanding = useRef(0);
  const syncedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const clearSyncedTimer = useCallback(() => {
    if (syncedTimer.current) {
      clearTimeout(syncedTimer.current);
      syncedTimer.current = null;
    }
  }, []);

  const refreshCounts = useCallback(async (): Promise<void> => {
    if (!isDatabaseReady()) {
      return;
    }
    const owner = getSyncSubsystem().owner();
    if (!owner) {
      outstanding.current = 0;
      setStatus(prev => ({
        ...prev,
        pending: 0,
        failed: 0,
        justSynced: false,
        signedIn: false,
      }));
      return;
    }
    try {
      const [pending, failed] = await Promise.all([
        syncQueue.countPending(owner),
        syncQueue.countFailed(owner),
      ]);
      if (!alive.current) {
        return;
      }

      const drained = outstanding.current > 0 && pending === 0 && failed === 0;
      outstanding.current = pending + failed;

      setStatus(prev => ({
        ...prev,
        pending,
        failed,
        signedIn: true,
        justSynced: drained || prev.justSynced,
      }));

      if (drained) {
        clearSyncedTimer();
        syncedTimer.current = setTimeout(() => {
          if (alive.current) {
            setStatus(prev => ({ ...prev, justSynced: false }));
          }
        }, SYNCED_VISIBLE_MS);
      }
    } catch {
      setStatus(prev => prev);
    }
  }, [clearSyncedTimer]);

  const retry = useCallback(() => {
    const subsystem = getSyncSubsystem();
    const owner = subsystem.owner();
    if (!owner) {
      return;
    }
    setStatus(prev => ({ ...prev, retrying: true }));
    syncQueue
      .retryFailed(owner)
      .then(() => subsystem.flushIfPossible())
      .catch(() => undefined)
      .then(() => {
        if (alive.current) {
          setStatus(prev => ({ ...prev, retrying: false }));
        }
        return refreshCounts();
      })
      .catch(() => undefined);
  }, [refreshCounts]);

  useEffect(() => {
    alive.current = true;

    const applyOnline = (online: boolean): void => {
      if (alive.current) {
        setStatus(prev => ({ ...prev, online }));
      }
    };

    netInfoConnectivity.isOnline().then(applyOnline).catch(() => undefined);
    refreshCounts().catch(() => undefined);

    const unsubscribeNet = netInfoConnectivity.subscribe?.(online => {
      applyOnline(online);
      refreshCounts().catch(() => undefined);
    });

    const unsubscribeQueue = subscribeToSyncQueue(() => {
      refreshCounts().catch(() => undefined);
    });

    return () => {
      alive.current = false;
      clearSyncedTimer();
      unsubscribeNet?.();
      unsubscribeQueue();
    };
  }, [refreshCounts, clearSyncedTimer]);

  return { ...status, phase: phaseFor(status), retry };
};
