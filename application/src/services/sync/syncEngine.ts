import type { OwnerUserId } from '../db/types';
import { repositoryEntityWriter } from './entityRegistry';
import {
  classifyFailure,
  hasAttemptsLeft,
  nextAvailableAt,
} from './retryPolicy';
import { logSync } from './syncLogger';
import * as queue from './syncQueueRepository';
import type {
  ConnectivityProvider,
  DbSyncQueueEntry,
  DomainSyncAdapter,
  EntitySyncWriter,
  FlushResult,
  FlushStopReason,
  SyncAdapterContext,
  SyncAdapterResult,
} from './types';

export const DEFAULT_MAX_ITEMS_PER_FLUSH = 50;

export interface SyncEngineOptions {
  readonly connectivity: ConnectivityProvider;
  readonly adapters: readonly DomainSyncAdapter[];
  readonly entityWriter?: EntitySyncWriter;
  readonly maxItemsPerFlush?: number;
  readonly random?: () => number;
  readonly now?: () => number;
}

export interface SyncEngine {
  flush(owner: OwnerUserId): Promise<FlushResult>;
  isFlushing(): boolean;
  recoverStaleInFlight(owner: OwnerUserId): Promise<number>;
}

const emptyResult = (stoppedBecause: FlushStopReason): FlushResult => ({
  attempted: 0,
  succeeded: 0,
  retried: 0,
  failed: 0,
  blocked: 0,
  stoppedBecause,
});

export const createSyncEngine = (options: SyncEngineOptions): SyncEngine => {
  const writer = options.entityWriter ?? repositoryEntityWriter;
  const maxItems = options.maxItemsPerFlush ?? DEFAULT_MAX_ITEMS_PER_FLUSH;
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;

  const adapters = new Map<string, DomainSyncAdapter>();
  for (const adapter of options.adapters) {
    adapters.set(adapter.entityType, adapter);
  }

  let inFlight: Promise<FlushResult> | null = null;

  const runAdapter = async (
    owner: OwnerUserId,
    entry: DbSyncQueueEntry,
    adapter: DomainSyncAdapter,
  ): Promise<SyncAdapterResult> => {
    const context: SyncAdapterContext = {
      ownerUserId: owner,
      entry,
      resolveServerId: (entityType, entityLocalId) =>
        writer.readServerId(owner, entityType, entityLocalId),
    };

    if (entry.operation === 'create') {
      if (!adapter.create) {
        throw new Error(`Adapter ${adapter.entityType} cannot handle create.`);
      }
      return adapter.create(context);
    }
    if (entry.operation === 'update') {
      if (!adapter.update) {
        throw new Error(`Adapter ${adapter.entityType} cannot handle update.`);
      }
      return adapter.update(context);
    }
    if (!adapter.delete) {
      throw new Error(`Adapter ${adapter.entityType} cannot handle delete.`);
    }
    return adapter.delete(context);
  };

  const outcomeIsUncertain = (entry: DbSyncQueueEntry): boolean => {
    if (!entry.payload_json) {
      return false;
    }
    try {
      const parsed: unknown = JSON.parse(entry.payload_json);
      return Boolean(
        parsed && typeof parsed === 'object' && (parsed as { verifyFirst?: boolean }).verifyFirst,
      );
    } catch {
      return false;
    }
  };

  const adoptExistingCreate = async (
    owner: OwnerUserId,
    entry: DbSyncQueueEntry,
    adapter: DomainSyncAdapter,
  ): Promise<SyncAdapterResult | null> => {
    if (entry.operation !== 'create') {
      return null;
    }
    if (entry.attempt_count === 0 && !outcomeIsUncertain(entry)) {
      return null;
    }
    if (!adapter.verifyCreated) {
      return null;
    }

    const context: SyncAdapterContext = {
      ownerUserId: owner,
      entry,
      resolveServerId: (entityType, entityLocalId) =>
        writer.readServerId(owner, entityType, entityLocalId),
    };

    const existing = await adapter.verifyCreated(context);
    if (existing) {
      logSync('request_succeeded', {
        entryId: entry.id,
        entityType: entry.entity_type,
        operation: entry.operation,
        reason: 'adopted existing server record',
      });
    }
    return existing;
  };

  const processOne = async (
    owner: OwnerUserId,
    entry: DbSyncQueueEntry,
    result: { attempted: number; succeeded: number; retried: number; failed: number },
  ): Promise<FlushStopReason | null> => {
    const adapter = adapters.get(entry.entity_type);
    if (!adapter) {
      logSync('adapter_missing', {
        entryId: entry.id,
        entityType: entry.entity_type,
      });
      await queue.markFailed(owner, entry.id, 'no adapter registered for entity type');
      result.failed += 1;
      return null;
    }

    result.attempted += 1;
    logSync('request_started', {
      entryId: entry.id,
      entityType: entry.entity_type,
      operation: entry.operation,
      attempt: entry.attempt_count,
    });

    try {
      const adopted = await adoptExistingCreate(owner, entry, adapter);
      const outcome = adopted ?? (await runAdapter(owner, entry, adapter));

      if (entry.operation === 'create' && outcome.serverId) {
        await writer.applyServerId(
          owner,
          entry.entity_type,
          entry.entity_local_id,
          outcome.serverId,
        );
      }
      await writer.markSynced(
        owner,
        entry.entity_type,
        entry.entity_local_id,
        outcome.serverUpdatedAt ?? null,
      );
      await queue.markSuccess(owner, entry.id);

      result.succeeded += 1;
      logSync('request_succeeded', {
        entryId: entry.id,
        entityType: entry.entity_type,
        operation: entry.operation,
      });
      return null;
    } catch (error) {
      const failure = classifyFailure(error);

      if (failure.kind === 'offline') {
        await queue.releaseInFlight(owner, entry.id);
        logSync('flush_skipped_offline', { entryId: entry.id });
        return 'offline';
      }

      if (failure.kind === 'auth') {
        await queue.releaseInFlight(owner, entry.id);
        logSync('auth_required', {
          entryId: entry.id,
          httpStatus: failure.status,
        });
        return 'auth_required';
      }

      if (failure.kind === 'permanent' || !hasAttemptsLeft(entry.attempt_count + 1)) {
        await queue.markFailed(owner, entry.id, failure.message);
        result.failed += 1;
        logSync('permanent_failure', {
          entryId: entry.id,
          entityType: entry.entity_type,
          httpStatus: failure.status,
          attempt: entry.attempt_count + 1,
        });
        return null;
      }

      const availableAt = nextAvailableAt(entry.attempt_count + 1, now(), random);
      await queue.markRetry(owner, entry.id, availableAt, failure.message);
      result.retried += 1;
      logSync('retry_scheduled', {
        entryId: entry.id,
        entityType: entry.entity_type,
        attempt: entry.attempt_count + 1,
        httpStatus: failure.status,
      });
      return null;
    }
  };

  const runFlush = async (owner: OwnerUserId): Promise<FlushResult> => {
    logSync('flush_started');

    if (!(await options.connectivity.isOnline())) {
      logSync('flush_skipped_offline');
      return emptyResult('offline');
    }

    const recovered = await queue.resetStaleInFlight(owner, now());
    if (recovered > 0) {
      logSync('stale_in_flight_recovered', { count: recovered });
    }

    const blocked = await queue.failEntriesBlockedByFailedDependency(owner);
    if (blocked > 0) {
      logSync('dependency_blocked', { count: blocked });
    }

    const tally = { attempted: 0, succeeded: 0, retried: 0, failed: 0 };
    let stoppedBecause: FlushStopReason = 'drained';

    for (let processed = 0; processed < maxItems; processed += 1) {
      const entry = await queue.claim(owner);
      if (!entry) {
        stoppedBecause = 'drained';
        break;
      }

      logSync('entry_claimed', {
        entryId: entry.id,
        entityType: entry.entity_type,
        operation: entry.operation,
      });

      const stop = await processOne(owner, entry, tally);
      if (stop) {
        stoppedBecause = stop;
        break;
      }

      if (processed === maxItems - 1) {
        stoppedBecause = 'max_items';
      }
    }

    const result: FlushResult = { ...tally, blocked, stoppedBecause };
    logSync('flush_completed', {
      count: result.attempted,
      reason: result.stoppedBecause,
    });
    return result;
  };

  return {
    isFlushing: () => inFlight !== null,

    async recoverStaleInFlight(owner) {
      const recovered = await queue.resetStaleInFlight(owner, now());
      if (recovered > 0) {
        logSync('stale_in_flight_recovered', { count: recovered });
      }
      return recovered;
    },

    async flush(owner) {
      if (inFlight) {
        logSync('flush_completed', { reason: 'busy' });
        return emptyResult('busy');
      }
      inFlight = runFlush(owner).finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
};
