import { newIdempotencyKey, nowIso } from '../db/ids';
import { runTransaction } from '../db';
import type { OwnerUserId } from '../db/types';
import {
  execute,
  queryAll,
  queryCount,
  queryOne,
  requireOwner,
} from '../../repositories/ownerScope';
import { STALE_CLAIM_MS } from './retryPolicy';
import { notifySyncQueueChanged } from './syncEvents';
import type {
  DbSyncQueueEntry,
  EnqueueInput,
  EnqueueOutcome,
  SyncOperation,
} from './types';

const ACTIVE_STATUSES = "('pending', 'processing', 'failed')";

export const getEntry = (
  owner: OwnerUserId,
  id: number,
): Promise<DbSyncQueueEntry | null> =>
  queryOne<DbSyncQueueEntry>(
    'SELECT * FROM sync_queue WHERE owner_user_id = ? AND id = ?',
    [requireOwner(owner), id],
  );

export const findActiveForEntity = (
  owner: OwnerUserId,
  entityType: string,
  entityLocalId: string,
): Promise<DbSyncQueueEntry | null> =>
  queryOne<DbSyncQueueEntry>(
    `SELECT * FROM sync_queue
      WHERE owner_user_id = ? AND entity_type = ? AND entity_local_id = ?
        AND status IN ${ACTIVE_STATUSES}
      ORDER BY id DESC LIMIT 1`,
    [requireOwner(owner), entityType, entityLocalId],
  );

const insertEntry = async (
  owner: OwnerUserId,
  input: EnqueueInput,
): Promise<DbSyncQueueEntry> => {
  const ownerId = requireOwner(owner);
  const timestamp = nowIso();
  const result = await execute(
    `INSERT INTO sync_queue
       (owner_user_id, entity_type, entity_local_id, entity_server_id, operation,
        payload_json, idempotency_key, status, attempt_count, available_at,
        created_at, updated_at, depends_on_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`,
    [
      ownerId,
      input.entityType,
      input.entityLocalId,
      input.entityServerId ?? null,
      input.operation,
      input.payloadJson ?? null,
      newIdempotencyKey(),
      timestamp,
      timestamp,
      timestamp,
      input.dependsOnId ?? null,
    ],
  );

  const inserted = await queryOne<DbSyncQueueEntry>(
    'SELECT * FROM sync_queue WHERE owner_user_id = ? AND id = ?',
    [ownerId, Number(result.insertId)],
  );
  if (!inserted) {
    throw new Error('Failed to read back the enqueued sync entry.');
  }
  notifySyncQueueChanged();
  return inserted;
};

const replaceOperation = async (
  owner: OwnerUserId,
  id: number,
  operation: SyncOperation,
  entityServerId: string | null,
): Promise<DbSyncQueueEntry> => {
  await execute(
    `UPDATE sync_queue
        SET operation = ?,
            entity_server_id = COALESCE(?, entity_server_id),
            status = 'pending',
            attempt_count = 0,
            available_at = ?,
            last_error = NULL,
            claimed_at = NULL,
            updated_at = ?
      WHERE owner_user_id = ? AND id = ?`,
    [operation, entityServerId, nowIso(), nowIso(), requireOwner(owner), id],
  );
  const updated = await getEntry(owner, id);
  if (!updated) {
    throw new Error('Failed to read back the coalesced sync entry.');
  }
  return updated;
};

const touch = async (
  owner: OwnerUserId,
  id: number,
  entityServerId: string | null,
): Promise<DbSyncQueueEntry> => {
  await execute(
    `UPDATE sync_queue
        SET updated_at = ?,
            entity_server_id = COALESCE(?, entity_server_id),
            status = CASE WHEN status = 'failed' THEN 'pending' ELSE status END,
            attempt_count = CASE WHEN status = 'failed' THEN 0 ELSE attempt_count END,
            last_error = CASE WHEN status = 'failed' THEN NULL ELSE last_error END
      WHERE owner_user_id = ? AND id = ?`,
    [nowIso(), entityServerId, requireOwner(owner), id],
  );
  const updated = await getEntry(owner, id);
  if (!updated) {
    throw new Error('Failed to read back the touched sync entry.');
  }
  return updated;
};

export const enqueue = async (
  owner: OwnerUserId,
  input: EnqueueInput,
): Promise<EnqueueOutcome> => {
  const existing = await findActiveForEntity(
    owner,
    input.entityType,
    input.entityLocalId,
  );

  if (!existing || existing.status === 'processing') {
    return { kind: 'inserted', entry: await insertEntry(owner, input) };
  }

  const previous = existing.operation;
  const next = input.operation;

  if (previous === 'delete') {
    return { kind: 'coalesced', entry: existing };
  }

  if (previous === 'create' && next === 'delete') {
    await execute('DELETE FROM sync_queue WHERE owner_user_id = ? AND id = ?', [
      requireOwner(owner),
      existing.id,
    ]);
    return { kind: 'annihilated', removedId: existing.id };
  }

  if (previous === 'create') {
    return { kind: 'coalesced', entry: await touch(owner, existing.id, null) };
  }

  if (previous === 'update' && next !== 'delete') {
    return { kind: 'coalesced', entry: await touch(owner, existing.id, null) };
  }

  if (previous === 'update' && next === 'delete') {
    return {
      kind: 'coalesced',
      entry: await replaceOperation(
        owner,
        existing.id,
        'delete',
        input.entityServerId ?? null,
      ),
    };
  }

  return { kind: 'inserted', entry: await insertEntry(owner, input) };
};

export const enqueueMany = async (
  owner: OwnerUserId,
  inputs: readonly EnqueueInput[],
): Promise<EnqueueOutcome[]> => {
  const outcomes: EnqueueOutcome[] = [];
  for (const input of inputs) {
    outcomes.push(await enqueue(owner, input));
  }
  return outcomes;
};

export const getNextEligible = (
  owner: OwnerUserId,
  now: string = nowIso(),
): Promise<DbSyncQueueEntry | null> =>
  queryOne<DbSyncQueueEntry>(
    `SELECT q.* FROM sync_queue q
      WHERE q.owner_user_id = ?
        AND q.status = 'pending'
        AND q.available_at <= ?
        AND (
          q.depends_on_id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM sync_queue p
             WHERE p.id = q.depends_on_id AND p.status <> 'completed'
          )
        )
      ORDER BY q.id ASC
      LIMIT 1`,
    [requireOwner(owner), now],
  );

export const claim = async (
  owner: OwnerUserId,
  now: string = nowIso(),
): Promise<DbSyncQueueEntry | null> =>
  runTransaction(async () => {
    const candidate = await getNextEligible(owner, now);
    if (!candidate) {
      return null;
    }
    const result = await execute(
      `UPDATE sync_queue
          SET status = 'processing', claimed_at = ?, updated_at = ?
        WHERE owner_user_id = ? AND id = ? AND status = 'pending'`,
      [now, now, requireOwner(owner), candidate.id],
    );
    if (result.rowsAffected === 0) {
      return null;
    }
    return getEntry(owner, candidate.id);
  });

export const markSuccess = async (
  owner: OwnerUserId,
  id: number,
): Promise<void> => {
  await execute(
    `UPDATE sync_queue
        SET status = 'completed', claimed_at = NULL, last_error = NULL, updated_at = ?
      WHERE owner_user_id = ? AND id = ?`,
    [nowIso(), requireOwner(owner), id],
  );
  notifySyncQueueChanged();
};

export const markRetry = async (
  owner: OwnerUserId,
  id: number,
  availableAt: string,
  error: string,
): Promise<void> => {
  await execute(
    `UPDATE sync_queue
        SET status = 'pending',
            attempt_count = attempt_count + 1,
            available_at = ?,
            last_error = ?,
            claimed_at = NULL,
            updated_at = ?
      WHERE owner_user_id = ? AND id = ?`,
    [availableAt, error, nowIso(), requireOwner(owner), id],
  );
  notifySyncQueueChanged();
};

export const markFailed = async (
  owner: OwnerUserId,
  id: number,
  error: string,
): Promise<void> => {
  await execute(
    `UPDATE sync_queue
        SET status = 'failed', claimed_at = NULL, last_error = ?, updated_at = ?
      WHERE owner_user_id = ? AND id = ?`,
    [error, nowIso(), requireOwner(owner), id],
  );
  notifySyncQueueChanged();
};

export const releaseInFlight = async (
  owner: OwnerUserId,
  id: number,
): Promise<void> => {
  await execute(
    `UPDATE sync_queue
        SET status = 'pending', claimed_at = NULL, updated_at = ?
      WHERE owner_user_id = ? AND id = ? AND status = 'processing'`,
    [nowIso(), requireOwner(owner), id],
  );
};

export const resetStaleInFlight = async (
  owner: OwnerUserId,
  now: number = Date.now(),
): Promise<number> => {
  const threshold = new Date(now - STALE_CLAIM_MS).toISOString();
  const result = await execute(
    `UPDATE sync_queue
        SET status = 'pending', claimed_at = NULL, updated_at = ?,
            last_error = 'recovered from stale in-flight state'
      WHERE owner_user_id = ? AND status = 'processing'
        AND (claimed_at IS NULL OR claimed_at <= ?)`,
    [new Date(now).toISOString(), requireOwner(owner), threshold],
  );
  return result.rowsAffected;
};

export const failEntriesBlockedByFailedDependency = async (
  owner: OwnerUserId,
): Promise<number> => {
  const result = await execute(
    `UPDATE sync_queue
        SET status = 'failed',
            claimed_at = NULL,
            last_error = 'blocked by a permanently failed dependency',
            updated_at = ?
      WHERE owner_user_id = ?
        AND status = 'pending'
        AND depends_on_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM sync_queue p
           WHERE p.id = sync_queue.depends_on_id AND p.status = 'failed'
        )`,
    [nowIso(), requireOwner(owner)],
  );
  return result.rowsAffected;
};

export const cancel = async (owner: OwnerUserId, id: number): Promise<boolean> => {
  const result = await execute(
    "DELETE FROM sync_queue WHERE owner_user_id = ? AND id = ? AND status <> 'processing'",
    [requireOwner(owner), id],
  );
  return result.rowsAffected > 0;
};

export const countPending = (owner: OwnerUserId): Promise<number> =>
  queryCount(
    "SELECT COUNT(*) FROM sync_queue WHERE owner_user_id = ? AND status IN ('pending', 'processing')",
    [requireOwner(owner)],
  );

export const countFailed = (owner: OwnerUserId): Promise<number> =>
  queryCount(
    "SELECT COUNT(*) FROM sync_queue WHERE owner_user_id = ? AND status = 'failed'",
    [requireOwner(owner)],
  );

export const retryFailed = async (owner: OwnerUserId): Promise<number> => {
  const result = await execute(
    `UPDATE sync_queue
        SET status = 'pending',
            attempt_count = 0,
            available_at = ?,
            last_error = NULL,
            claimed_at = NULL,
            updated_at = ?
      WHERE owner_user_id = ? AND status = 'failed'`,
    [nowIso(), nowIso(), requireOwner(owner)],
  );
  if (result.rowsAffected > 0) {
    notifySyncQueueChanged();
  }
  return result.rowsAffected;
};

export const countUnsent = (owner: OwnerUserId): Promise<number> =>
  queryCount(
    "SELECT COUNT(*) FROM sync_queue WHERE owner_user_id = ? AND status IN ('pending', 'processing', 'failed')",
    [requireOwner(owner)],
  );

export const listPending = (owner: OwnerUserId): Promise<DbSyncQueueEntry[]> =>
  queryAll<DbSyncQueueEntry>(
    `SELECT * FROM sync_queue
      WHERE owner_user_id = ? AND status IN ('pending', 'processing')
      ORDER BY id ASC`,
    [requireOwner(owner)],
  );

export const listFailed = (owner: OwnerUserId): Promise<DbSyncQueueEntry[]> =>
  queryAll<DbSyncQueueEntry>(
    "SELECT * FROM sync_queue WHERE owner_user_id = ? AND status = 'failed' ORDER BY id ASC",
    [requireOwner(owner)],
  );

export const purgeCompleted = async (
  owner: OwnerUserId,
  olderThanIso: string,
): Promise<number> => {
  const result = await execute(
    "DELETE FROM sync_queue WHERE owner_user_id = ? AND status = 'completed' AND updated_at < ?",
    [requireOwner(owner), olderThanIso],
  );
  return result.rowsAffected;
};
