import type { OwnerUserId } from '../db/types';
import { assessmentAnswerAdapter } from './adapters/assessmentAnswerAdapter';
import { assessmentSubmitAdapter } from './adapters/assessmentSubmitAdapter';
import { farmAdapter } from './adapters/farmAdapter';
import { fieldAdapter } from './adapters/fieldAdapter';
import { fieldBoundaryAdapter } from './adapters/fieldBoundaryAdapter';
import { fieldSoilAdapter } from './adapters/fieldSoilAdapter';
import { monitoringAdapter } from './adapters/monitoringAdapter';
import { mediaAdapter } from './adapters/mediaAdapter';
import { purgeAbandonedDrafts, reconcileMediaFiles } from './mediaOutbox';
import { netInfoConnectivity } from './netInfoConnectivity';
import { establishOwner, clearOwner, resolveOwner } from './ownerSession';
import { createSyncEngine } from './syncEngine';
import type { SyncEngine } from './syncEngine';
import { logSync } from './syncLogger';
import * as queue from './syncQueueRepository';
import type { LocalUserInput } from '../../repositories/userRepository';
import type { ConnectivityProvider, DomainSyncAdapter } from './types';

export interface SyncSubsystem {
  readonly engine: SyncEngine;
  readonly connectivity: ConnectivityProvider;
  owner(): OwnerUserId | null;
  activate(user: LocalUserInput): Promise<OwnerUserId>;
  deactivate(): Promise<void>;
  recoverForCurrentOwner(): Promise<number>;
  flushIfPossible(): Promise<void>;
  dispose(): void;
}

export interface SyncSubsystemOptions {
  readonly connectivity?: ConnectivityProvider;
  readonly adapters?: readonly DomainSyncAdapter[];
  readonly autoFlushOnReconnect?: boolean;
}

export const COMPLETED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export const DEFAULT_ADAPTERS: readonly DomainSyncAdapter[] = [
  assessmentAnswerAdapter,
  assessmentSubmitAdapter,
  farmAdapter,
  fieldAdapter,
  fieldBoundaryAdapter,
  fieldSoilAdapter,
  monitoringAdapter,
  mediaAdapter,
];

let shared: SyncSubsystem | null = null;

export const getSyncSubsystem = (): SyncSubsystem => {
  if (!shared) {
    shared = createSyncSubsystem();
  }
  return shared;
};

export const resetSyncSubsystem = (): void => {
  shared?.dispose();
  shared = null;
};

export const createSyncSubsystem = (
  options: SyncSubsystemOptions = {},
): SyncSubsystem => {
  const connectivity = options.connectivity ?? netInfoConnectivity;
  const engine = createSyncEngine({
    connectivity,
    adapters: options.adapters ?? DEFAULT_ADAPTERS,
  });

  let owner: OwnerUserId | null = null;
  let unsubscribe: (() => void) | null = null;

  const housekeeping = async (resolved: OwnerUserId): Promise<void> => {
    await reconcileMediaFiles(resolved).catch(() => 0);
    await purgeAbandonedDrafts(resolved).catch(() => 0);
    const cutoff = new Date(Date.now() - COMPLETED_RETENTION_MS).toISOString();
    const purged = await queue.purgeCompleted(resolved, cutoff).catch(() => 0);
    if (purged > 0) {
      logSync('flush_completed', {
        count: purged,
        reason: 'completed queue entries purged',
      });
    }
  };

  const flushIfPossible = async (): Promise<void> => {
    if (!owner) {
      return;
    }
    try {
      await engine.flush(owner);
    } catch (error) {
      logSync('flush_completed', {
        reason: error instanceof Error ? error.message : 'flush failed',
      });
    }
  };

  if (options.autoFlushOnReconnect !== false && connectivity.subscribe) {
    unsubscribe = connectivity.subscribe(online => {
      if (online) {
        flushIfPossible().catch(() => undefined);
      }
    });
  }

  return {
    engine,
    connectivity,

    owner: () => owner,

    async activate(user) {
      const resolved = await establishOwner(user);
      owner = resolved;
      const recovered = await queue.resetStaleInFlight(resolved);
      if (recovered > 0) {
        logSync('stale_in_flight_recovered', { count: recovered });
      }
      await housekeeping(resolved);
      return resolved;
    },

    async deactivate() {
      owner = null;
      await clearOwner();
    },

    async recoverForCurrentOwner() {
      const resolved = owner ?? (await resolveOwner());
      if (!resolved) {
        logSync('flush_completed', { reason: 'no owner scope; recovery skipped' });
        return 0;
      }
      owner = resolved;
      const recovered = await queue.resetStaleInFlight(resolved);
      if (recovered > 0) {
        logSync('stale_in_flight_recovered', { count: recovered });
      }
      await housekeeping(resolved);
      return recovered;
    },

    flushIfPossible,

    dispose() {
      unsubscribe?.();
      unsubscribe = null;
    },
  };
};
