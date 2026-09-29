import { AxiosError, AxiosHeaders } from 'axios';
import { open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  getDatabase,
  getSchemaVersion,
  initializeDatabase,
  nowIso,
} from '../src/services/db';
import type { OwnerUserId } from '../src/services/db/types';
import { farmRepository, fieldRepository } from '../src/repositories';
import {
  BASE_DELAY_MS,
  MAX_ATTEMPTS,
  MAX_DELAY_MS,
  STALE_CLAIM_MS,
  backoffDelayMs,
  classifyFailure,
  createManualConnectivity,
  createSyncEngine,
  offlineConnectivity,
  optimisticConnectivity,
  setSyncLogSink,
  syncQueue,
} from '../src/services/sync';
import type {
  DomainSyncAdapter,
  EntitySyncWriter,
  SyncAdapterResult,
} from '../src/services/sync';

const OWNER_A = asOwnerUserId('user-a');
const OWNER_B = asOwnerUserId('user-b');

const seedUser = async (localId: string): Promise<void> => {
  await getDatabase().execute(
    `INSERT INTO users (local_id, server_id, email, name, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [localId, null, `${localId}@example.com`, 'Test', 'farmer', nowIso(), nowIso()],
  );
};

const axiosFailure = (status: number | null): AxiosError => {
  const error = new AxiosError('request failed', 'ERR', undefined, undefined);
  if (status !== null) {
    error.response = {
      status,
      statusText: 'error',
      data: {},
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    };
  }
  return error;
};

interface RecordingAdapter extends DomainSyncAdapter {
  calls: string[];
}

const makeAdapter = (
  entityType: string,
  behaviour: (op: string) => Promise<SyncAdapterResult>,
): RecordingAdapter => {
  const calls: string[] = [];
  const run = (op: string) => async () => {
    calls.push(op);
    return behaviour(op);
  };
  return {
    entityType,
    calls,
    create: run('create'),
    update: run('update'),
    delete: run('delete'),
  };
};

const okAdapter = (entityType: string, serverId = 'srv-generated') =>
  makeAdapter(entityType, async () => ({ serverId, serverUpdatedAt: nowIso() }));

const makeFarm = (owner: OwnerUserId, name = 'Farm') =>
  farmRepository.create(owner, { name });

beforeEach(async () => {
  setSyncLogSink(() => {});
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
  await seedUser('user-a');
  await seedUser('user-b');
});

afterAll(async () => {
  setSyncLogSink(null);
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

describe('migration v3', () => {
  it('reaches the latest schema version', async () => {
    const { LATEST_SCHEMA_VERSION } = require('../src/services/db');
    await expect(getSchemaVersion()).resolves.toBe(LATEST_SCHEMA_VERSION);
    expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(3);
  });

  it('adds dependency and claim columns while keeping queue rows', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const rows = await getDatabase().execute(
      'SELECT depends_on_id, claimed_at FROM sync_queue',
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].depends_on_id).toBeNull();
    expect(rows.rows[0].claimed_at).toBeNull();
  });
});

describe('queue basics', () => {
  it('enqueues and lists', async () => {
    const farm = await makeFarm(OWNER_A);
    const outcome = await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    expect(outcome.kind).toBe('inserted');
    await expect(syncQueue.countPending(OWNER_A)).resolves.toBe(1);
    await expect(syncQueue.listPending(OWNER_A)).resolves.toHaveLength(1);
  });

  it('claims an entry and marks it processing', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const claimed = await syncQueue.claim(OWNER_A);
    expect(claimed?.status).toBe('processing');
    expect(claimed?.claimed_at).not.toBeNull();

    await expect(syncQueue.claim(OWNER_A)).resolves.toBeNull();
  });

  it('marks success, retry and failure', async () => {
    const farm = await makeFarm(OWNER_A);
    const inserted = await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });
    const id = inserted.kind === 'inserted' ? inserted.entry.id : 0;

    await syncQueue.markRetry(OWNER_A, id, nowIso(), 'boom');
    let entry = await syncQueue.getEntry(OWNER_A, id);
    expect(entry?.status).toBe('pending');
    expect(entry?.attempt_count).toBe(1);
    expect(entry?.last_error).toBe('boom');

    await syncQueue.markFailed(OWNER_A, id, 'permanent');
    entry = await syncQueue.getEntry(OWNER_A, id);
    expect(entry?.status).toBe('failed');
    await expect(syncQueue.countFailed(OWNER_A)).resolves.toBe(1);

    await syncQueue.markSuccess(OWNER_A, id);
    entry = await syncQueue.getEntry(OWNER_A, id);
    expect(entry?.status).toBe('completed');
    expect(entry?.last_error).toBeNull();
  });
});

describe('ownership', () => {
  it('never exposes another user’s queue', async () => {
    const farmA = await makeFarm(OWNER_A);
    const farmB = await makeFarm(OWNER_B);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farmA.local_id,
      operation: 'create',
    });
    await syncQueue.enqueue(OWNER_B, {
      entityType: 'farm',
      entityLocalId: farmB.local_id,
      operation: 'create',
    });

    await expect(syncQueue.countPending(OWNER_A)).resolves.toBe(1);
    const claimedByB = await syncQueue.claim(OWNER_B);
    expect(claimedByB?.owner_user_id).toBe('user-b');

    const stillPendingForA = await syncQueue.listPending(OWNER_A);
    expect(stillPendingForA[0].status).toBe('pending');
  });

  it('does not flush another user’s work', async () => {
    const farmB = await makeFarm(OWNER_B);
    await syncQueue.enqueue(OWNER_B, {
      entityType: 'farm',
      entityLocalId: farmB.local_id,
      operation: 'create',
    });

    const adapter = okAdapter('farm');
    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [adapter],
    });

    const result = await engine.flush(OWNER_A);
    expect(result.attempted).toBe(0);
    expect(adapter.calls).toHaveLength(0);
    await expect(syncQueue.countPending(OWNER_B)).resolves.toBe(1);
  });
});

describe('coalescing rules', () => {
  const enqueueFor = (owner: OwnerUserId, localId: string, operation: 'create' | 'update' | 'delete') =>
    syncQueue.enqueue(owner, { entityType: 'farm', entityLocalId: localId, operation });

  it('collapses UPDATE + UPDATE into one entry', async () => {
    const farm = await makeFarm(OWNER_A);
    await enqueueFor(OWNER_A, farm.local_id, 'update');
    const second = await enqueueFor(OWNER_A, farm.local_id, 'update');

    expect(second.kind).toBe('coalesced');
    await expect(syncQueue.countPending(OWNER_A)).resolves.toBe(1);
  });

  it('keeps CREATE when a later UPDATE arrives', async () => {
    const farm = await makeFarm(OWNER_A);
    await enqueueFor(OWNER_A, farm.local_id, 'create');
    await enqueueFor(OWNER_A, farm.local_id, 'update');

    const pending = await syncQueue.listPending(OWNER_A);
    expect(pending).toHaveLength(1);
    expect(pending[0].operation).toBe('create');
  });

  it('annihilates CREATE + DELETE without contacting the server', async () => {
    const farm = await makeFarm(OWNER_A);
    await enqueueFor(OWNER_A, farm.local_id, 'create');
    const outcome = await enqueueFor(OWNER_A, farm.local_id, 'delete');

    expect(outcome.kind).toBe('annihilated');
    await expect(syncQueue.countPending(OWNER_A)).resolves.toBe(0);
  });

  it('promotes UPDATE to DELETE and keeps the server id', async () => {
    const farm = await makeFarm(OWNER_A);
    await enqueueFor(OWNER_A, farm.local_id, 'update');
    const outcome = await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'delete',
      entityServerId: 'srv-9',
    });

    expect(outcome.kind).toBe('coalesced');
    const pending = await syncQueue.listPending(OWNER_A);
    expect(pending[0].operation).toBe('delete');
    expect(pending[0].entity_server_id).toBe('srv-9');
  });

  it('never coalesces into an in-flight entry', async () => {
    const farm = await makeFarm(OWNER_A);
    await enqueueFor(OWNER_A, farm.local_id, 'update');
    await syncQueue.claim(OWNER_A);

    const outcome = await enqueueFor(OWNER_A, farm.local_id, 'update');
    expect(outcome.kind).toBe('inserted');
    await expect(syncQueue.countPending(OWNER_A)).resolves.toBe(2);
  });
});

describe('dependency ordering', () => {
  const setupParentChild = async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await fieldRepository.create(OWNER_A, {
      farm_local_id: farm.local_id,
      name: 'Plot',
    });

    const parent = await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });
    const parentId = parent.kind === 'inserted' ? parent.entry.id : 0;

    const child = await syncQueue.enqueue(OWNER_A, {
      entityType: 'field',
      entityLocalId: field.local_id,
      operation: 'create',
      dependsOnId: parentId,
    });
    const childId = child.kind === 'inserted' ? child.entry.id : 0;

    return { farm, field, parentId, childId };
  };

  it('blocks the child while the parent is pending', async () => {
    const { parentId } = await setupParentChild();
    const next = await syncQueue.getNextEligible(OWNER_A);
    expect(next?.id).toBe(parentId);
  });

  it('blocks the child while the parent is in flight', async () => {
    await setupParentChild();
    await syncQueue.claim(OWNER_A);
    await expect(syncQueue.getNextEligible(OWNER_A)).resolves.toBeNull();
  });

  it('blocks the child while the parent is retrying', async () => {
    const { parentId } = await setupParentChild();
    await syncQueue.markRetry(
      OWNER_A,
      parentId,
      new Date(Date.now() + 60_000).toISOString(),
      'retrying',
    );
    await expect(syncQueue.getNextEligible(OWNER_A)).resolves.toBeNull();
  });

  it('unlocks the child once the parent completes', async () => {
    const { parentId, childId } = await setupParentChild();
    await syncQueue.markSuccess(OWNER_A, parentId);

    const next = await syncQueue.getNextEligible(OWNER_A);
    expect(next?.id).toBe(childId);
  });

  it('fails the child deterministically when the parent fails permanently', async () => {
    const { parentId, childId } = await setupParentChild();
    await syncQueue.markFailed(OWNER_A, parentId, 'permanent');

    const affected = await syncQueue.failEntriesBlockedByFailedDependency(OWNER_A);
    expect(affected).toBe(1);

    const child = await syncQueue.getEntry(OWNER_A, childId);
    expect(child?.status).toBe('failed');
    expect(child?.last_error).toMatch(/failed dependency/i);
    await expect(syncQueue.getNextEligible(OWNER_A)).resolves.toBeNull();
  });

  it('processes parent then child in one flush', async () => {
    await setupParentChild();
    const farmAdapter = okAdapter('farm', 'srv-farm');
    const fieldAdapter = okAdapter('field', 'srv-field');

    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [farmAdapter, fieldAdapter],
    });

    const result = await engine.flush(OWNER_A);
    expect(result.succeeded).toBe(2);
    expect(farmAdapter.calls).toEqual(['create']);
    expect(fieldAdapter.calls).toEqual(['create']);
  });

  it('keeps unrelated entries flowing when one is blocked', async () => {
    const { parentId } = await setupParentChild();
    await syncQueue.markRetry(
      OWNER_A,
      parentId,
      new Date(Date.now() + 600_000).toISOString(),
      'wait',
    );

    const other = await makeFarm(OWNER_A, 'Independent');
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: other.local_id,
      operation: 'create',
    });

    const adapter = okAdapter('farm');
    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [adapter],
    });

    const result = await engine.flush(OWNER_A);
    expect(result.succeeded).toBe(1);
  });
});

describe('retry policy', () => {
  it('classifies transport and status codes', () => {
    expect(classifyFailure(axiosFailure(null)).kind).toBe('offline');
    expect(classifyFailure(axiosFailure(401)).kind).toBe('auth');
    expect(classifyFailure(axiosFailure(408)).kind).toBe('retryable');
    expect(classifyFailure(axiosFailure(429)).kind).toBe('retryable');
    expect(classifyFailure(axiosFailure(500)).kind).toBe('retryable');
    expect(classifyFailure(axiosFailure(503)).kind).toBe('retryable');
    expect(classifyFailure(axiosFailure(400)).kind).toBe('permanent');
    expect(classifyFailure(axiosFailure(403)).kind).toBe('permanent');
    expect(classifyFailure(axiosFailure(422)).kind).toBe('permanent');
  });

  it('increases backoff and caps it', () => {
    const fixed = () => 0.5;
    const delays = [1, 2, 3, 4, 5, 6].map(n => backoffDelayMs(n, fixed));

    expect(delays[0]).toBeGreaterThanOrEqual(BASE_DELAY_MS);
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
    }
    expect(backoffDelayMs(50, fixed)).toBeLessThanOrEqual(MAX_DELAY_MS);
  });

  it('retries a 500 and increments the attempt count', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const adapter = makeAdapter('farm', async () => {
      throw axiosFailure(500);
    });
    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [adapter],
    });

    const result = await engine.flush(OWNER_A);
    expect(result.retried).toBe(1);

    const pending = await syncQueue.listPending(OWNER_A);
    expect(pending[0].status).toBe('pending');
    expect(pending[0].attempt_count).toBe(1);
    expect(Date.parse(pending[0].available_at)).toBeGreaterThan(Date.now());
  });

  it('does not retry a permanent validation error', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const adapter = makeAdapter('farm', async () => {
      throw axiosFailure(422);
    });
    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [adapter],
    });

    const result = await engine.flush(OWNER_A);
    expect(result.failed).toBe(1);
    expect(adapter.calls).toHaveLength(1);

    const failed = await syncQueue.listFailed(OWNER_A);
    expect(failed).toHaveLength(1);
  });

  it('gives up after the attempt cap', async () => {
    const farm = await makeFarm(OWNER_A);
    const inserted = await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });
    const id = inserted.kind === 'inserted' ? inserted.entry.id : 0;

    await getDatabase().execute(
      'UPDATE sync_queue SET attempt_count = ? WHERE id = ?',
      [MAX_ATTEMPTS - 1, id],
    );

    const adapter = makeAdapter('farm', async () => {
      throw axiosFailure(500);
    });
    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [adapter],
    });

    const result = await engine.flush(OWNER_A);
    expect(result.failed).toBe(1);
    const entry = await syncQueue.getEntry(OWNER_A, id);
    expect(entry?.status).toBe('failed');
  });
});

describe('authentication', () => {
  it('stops the flush and leaves the entry retryable on 401', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const adapter = makeAdapter('farm', async () => {
      throw axiosFailure(401);
    });
    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [adapter],
    });

    const result = await engine.flush(OWNER_A);
    expect(result.stoppedBecause).toBe('auth_required');
    expect(result.failed).toBe(0);

    const pending = await syncQueue.listPending(OWNER_A);
    expect(pending[0].status).toBe('pending');
    expect(pending[0].attempt_count).toBe(0);
  });
});

describe('connectivity', () => {
  it('performs zero requests while offline', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const adapter = okAdapter('farm');
    const engine = createSyncEngine({
      connectivity: offlineConnectivity,
      adapters: [adapter],
    });

    const result = await engine.flush(OWNER_A);
    expect(result.stoppedBecause).toBe('offline');
    expect(adapter.calls).toHaveLength(0);
    await expect(syncQueue.countPending(OWNER_A)).resolves.toBe(1);
  });

  it('resumes when connectivity returns', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const connectivity = createManualConnectivity(false);
    const adapter = okAdapter('farm');
    const engine = createSyncEngine({ connectivity, adapters: [adapter] });

    await engine.flush(OWNER_A);
    expect(adapter.calls).toHaveLength(0);

    connectivity.setOnline(true);
    const result = await engine.flush(OWNER_A);
    expect(result.succeeded).toBe(1);
  });

  it('returns the entry to a safe state when the network drops mid-request', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const adapter = makeAdapter('farm', async () => {
      throw axiosFailure(null);
    });
    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [adapter],
    });

    const result = await engine.flush(OWNER_A);
    expect(result.stoppedBecause).toBe('offline');

    const pending = await syncQueue.listPending(OWNER_A);
    expect(pending[0].status).toBe('pending');
    expect(pending[0].attempt_count).toBe(0);
  });
});

describe('single flight', () => {
  it('does not process the same entry twice under concurrent flushes', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const adapter = okAdapter('farm');
    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [adapter],
    });

    const [first, second] = await Promise.all([
      engine.flush(OWNER_A),
      engine.flush(OWNER_A),
    ]);

    expect(adapter.calls).toHaveLength(1);
    const busy = [first, second].filter(r => r.stoppedBecause === 'busy');
    expect(busy).toHaveLength(1);
  });
});

describe('in-flight recovery', () => {
  it('recovers an entry stranded by a crash', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });
    const claimed = await syncQueue.claim(OWNER_A);

    await getDatabase().execute('UPDATE sync_queue SET claimed_at = ? WHERE id = ?', [
      new Date(Date.now() - STALE_CLAIM_MS - 60_000).toISOString(),
      claimed!.id,
    ]);

    const recovered = await syncQueue.resetStaleInFlight(OWNER_A);
    expect(recovered).toBe(1);

    const entry = await syncQueue.getEntry(OWNER_A, claimed!.id);
    expect(entry?.status).toBe('pending');
    expect(entry?.claimed_at).toBeNull();
  });

  it('does not steal a freshly claimed entry', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });
    const claimed = await syncQueue.claim(OWNER_A);

    const recovered = await syncQueue.resetStaleInFlight(OWNER_A);
    expect(recovered).toBe(0);

    const entry = await syncQueue.getEntry(OWNER_A, claimed!.id);
    expect(entry?.status).toBe('processing');
  });

  it('survives a simulated app restart', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });
    await syncQueue.claim(OWNER_A);

    await closeDatabase();
    await initializeDatabase();

    const pending = await syncQueue.listPending(OWNER_A);
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('processing');
  });
});

describe('server id handling', () => {
  it('persists server_id on create without changing local_id', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [okAdapter('farm', 'srv-from-server')],
    });
    await engine.flush(OWNER_A);

    const updated = await farmRepository.getByLocalId(OWNER_A, farm.local_id);
    expect(updated?.local_id).toBe(farm.local_id);
    expect(updated?.server_id).toBe('srv-from-server');
    expect(updated?.sync_state).toBe('synced');
  });

  it('exposes a parent server id to a dependent adapter', async () => {
    const farm = await makeFarm(OWNER_A);
    await farmRepository.setServerId(OWNER_A, farm.local_id, 'srv-parent');
    const field = await fieldRepository.create(OWNER_A, {
      farm_local_id: farm.local_id,
      name: 'Plot',
    });
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'field',
      entityLocalId: field.local_id,
      operation: 'create',
    });

    let resolved: string | null = null;
    const adapter: DomainSyncAdapter = {
      entityType: 'field',
      create: async context => {
        resolved = await context.resolveServerId('farm', farm.local_id);
        return { serverId: 'srv-field' };
      },
    };

    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [adapter],
    });
    await engine.flush(OWNER_A);

    expect(resolved).toBe('srv-parent');
  });
});

describe('crash safety between request and local acknowledgement', () => {
  it('keeps the entry recoverable when the local write fails after a successful request', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const brokenWriter: EntitySyncWriter = {
      applyServerId: async () => {
        throw new Error('device died before the local write landed');
      },
      markSynced: async () => undefined,
      readServerId: async () => null,
    };

    const adapter = okAdapter('farm', 'srv-accepted-by-server');
    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [adapter],
      entityWriter: brokenWriter,
    });

    const result = await engine.flush(OWNER_A);

    expect(adapter.calls).toEqual(['create']);
    expect(result.succeeded).toBe(0);
    expect(result.retried).toBe(1);

    const pending = await syncQueue.listPending(OWNER_A);
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('pending');
    expect(pending[0].attempt_count).toBe(1);

    const stillLocal = await farmRepository.getByLocalId(OWNER_A, farm.local_id);
    expect(stillLocal).not.toBeNull();
    expect(stillLocal?.local_id).toBe(farm.local_id);
  });
});

describe('failure safety', () => {
  it('fails an entry with no registered adapter instead of looping', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [],
    });

    const result = await engine.flush(OWNER_A);
    expect(result.failed).toBe(1);
    expect(result.stoppedBecause).toBe('drained');
  });

  it('never deletes local data because the API failed', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [
        makeAdapter('farm', async () => {
          throw axiosFailure(422);
        }),
      ],
    });
    await engine.flush(OWNER_A);

    const stillThere = await farmRepository.getByLocalId(OWNER_A, farm.local_id);
    expect(stillThere).not.toBeNull();
    await expect(farmRepository.count(OWNER_A)).resolves.toBe(1);
  });

  it('keeps the queue entry until the server acknowledges', async () => {
    const farm = await makeFarm(OWNER_A);
    await syncQueue.enqueue(OWNER_A, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const engine = createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [
        makeAdapter('farm', async () => {
          throw axiosFailure(500);
        }),
      ],
    });
    await engine.flush(OWNER_A);

    const rows = await getDatabase().execute('SELECT COUNT(*) AS c FROM sync_queue');
    expect(Number(rows.rows[0].c)).toBe(1);
  });
});
