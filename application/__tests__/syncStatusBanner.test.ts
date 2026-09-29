import { open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  initializeDatabase,
} from '../src/services/db';
import { upsertLocalUser } from '../src/repositories/userRepository';
import { farmRepository } from '../src/repositories';
import { setSyncLogSink, subscribeToSyncQueue, syncQueue } from '../src/services/sync';
import { bannerContentFor } from '../src/components/SyncStatusBanner';
import { phaseFor } from '../src/hooks/useSyncStatus';

const OWNER_ID = 'farmer-banner';
const OWNER = asOwnerUserId(OWNER_ID);

beforeEach(async () => {
  setSyncLogSink(() => {});
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
  await upsertLocalUser({ id: OWNER_ID });
});

afterAll(async () => {
  setSyncLogSink(null);
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

const state = (over: Partial<{
  online: boolean;
  pending: number;
  failed: number;
  retrying: boolean;
  justSynced: boolean;
  signedIn: boolean;
}> = {}) => ({
  online: true,
  pending: 0,
  failed: 0,
  retrying: false,
  justSynced: false,
  signedIn: true,
  ...over,
});

describe('sync phase', () => {
  it('is idle when online with nothing queued', () => {
    expect(phaseFor(state())).toBe('idle');
  });

  it('is offline whenever there is no connection', () => {
    expect(phaseFor(state({ online: false }))).toBe('offline');
    expect(phaseFor(state({ online: false, pending: 4 }))).toBe('offline');
    expect(phaseFor(state({ online: false, failed: 2 }))).toBe('offline');
  });

  it('prefers failures over pending work when online', () => {
    expect(phaseFor(state({ pending: 5, failed: 1 }))).toBe('failed');
  });

  it('is syncing when online with pending work', () => {
    expect(phaseFor(state({ pending: 2 }))).toBe('syncing');
  });

  it('confirms success only once the queue has drained', () => {
    expect(phaseFor(state({ justSynced: true }))).toBe('synced');
    expect(phaseFor(state({ justSynced: true, pending: 1 }))).toBe('syncing');
  });
});

describe('before anyone signs in', () => {
  it('stays silent on the auth screens even with no connection', () => {
    expect(phaseFor(state({ signedIn: false, online: false }))).toBe('idle');
  });

  it('stays silent regardless of leftover counts', () => {
    expect(phaseFor(state({ signedIn: false, pending: 3 }))).toBe('idle');
    expect(phaseFor(state({ signedIn: false, failed: 2 }))).toBe('idle');
    expect(phaseFor(state({ signedIn: false, justSynced: true }))).toBe('idle');
  });

  it('speaks up again once a user is signed in', () => {
    expect(phaseFor(state({ signedIn: true, online: false }))).toBe('offline');
  });
});

describe('banner content', () => {
  it('shows nothing when idle', () => {
    expect(bannerContentFor({ phase: 'idle', pending: 0, failed: 0 })).toBeNull();
  });

  it('reassures the user when offline with no pending work', () => {
    const content = bannerContentFor({ phase: 'offline', pending: 0, failed: 0 });
    expect(content?.title).toMatch(/offline/i);
    expect(content?.detail).toMatch(/saves on this device/i);
    expect(content?.action).toBeNull();
  });

  it('counts pending work while offline', () => {
    const content = bannerContentFor({ phase: 'offline', pending: 3, failed: 0 });
    expect(content?.detail).toContain('3 changes');
  });

  it('uses the singular form for one change', () => {
    const content = bannerContentFor({ phase: 'offline', pending: 1, failed: 0 });
    expect(content?.detail).toContain('1 change');
    expect(content?.detail).not.toContain('1 changes');
  });

  it('spins only while syncing', () => {
    expect(bannerContentFor({ phase: 'syncing', pending: 2, failed: 0 })?.spinning).toBe(true);
    expect(bannerContentFor({ phase: 'offline', pending: 2, failed: 0 })?.spinning).toBe(false);
    expect(bannerContentFor({ phase: 'failed', pending: 0, failed: 1 })?.spinning).toBe(false);
  });

  it('offers a retry and says nothing was lost when a sync fails', () => {
    const content = bannerContentFor({ phase: 'failed', pending: 0, failed: 2 });
    expect(content?.title).toContain('2 changes');
    expect(content?.detail).toMatch(/nothing was lost/i);
    expect(content?.action).toBe('Try again');
  });

  it('confirms when everything has synced', () => {
    const content = bannerContentFor({ phase: 'synced', pending: 0, failed: 0 });
    expect(content?.title).toMatch(/all changes synced/i);
    expect(content?.action).toBeNull();
  });

  it('gives every visible state its own icon and accent', () => {
    const phases = ['offline', 'syncing', 'failed', 'synced'] as const;
    const shown = phases.map(phase =>
      bannerContentFor({ phase, pending: 1, failed: 1 }),
    );

    expect(shown.every(Boolean)).toBe(true);
    expect(new Set(shown.map(c => c?.icon)).size).toBe(4);
    expect(new Set(shown.map(c => c?.accent)).size).toBe(4);
  });
});

describe('queue change notifications', () => {
  const enqueueOne = async (): Promise<void> => {
    const farm = await farmRepository.create(OWNER, { name: 'Farm' });
    await syncQueue.enqueue(OWNER, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });
  };

  it('notifies when work is queued', async () => {
    let calls = 0;
    const unsubscribe = subscribeToSyncQueue(() => {
      calls += 1;
    });

    await enqueueOne();

    expect(calls).toBeGreaterThan(0);
    unsubscribe();
  });

  it('notifies when an entry succeeds', async () => {
    await enqueueOne();
    const pending = await syncQueue.listPending(OWNER);

    let calls = 0;
    const unsubscribe = subscribeToSyncQueue(() => {
      calls += 1;
    });

    await syncQueue.markSuccess(OWNER, pending[0].id);

    expect(calls).toBe(1);
    unsubscribe();
  });

  it('notifies when an entry fails', async () => {
    await enqueueOne();
    const pending = await syncQueue.listPending(OWNER);

    let calls = 0;
    const unsubscribe = subscribeToSyncQueue(() => {
      calls += 1;
    });

    await syncQueue.markFailed(OWNER, pending[0].id, 'nope');

    expect(calls).toBe(1);
    unsubscribe();
  });

  it('stops notifying after unsubscribe', async () => {
    let calls = 0;
    const unsubscribe = subscribeToSyncQueue(() => {
      calls += 1;
    });
    unsubscribe();

    await enqueueOne();

    expect(calls).toBe(0);
  });

  it('reflects real queue counts', async () => {
    await enqueueOne();
    await enqueueOne();

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(2);
    await expect(syncQueue.countFailed(OWNER)).resolves.toBe(0);

    const pending = await syncQueue.listPending(OWNER);
    await syncQueue.markFailed(OWNER, pending[0].id, 'boom');

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
    await expect(syncQueue.countFailed(OWNER)).resolves.toBe(1);
  });
});

describe('retrying failed work', () => {
  const enqueueOne = async (): Promise<void> => {
    const farm = await farmRepository.create(OWNER, { name: 'Farm' });
    await syncQueue.enqueue(OWNER, {
      entityType: 'farm',
      entityLocalId: farm.local_id,
      operation: 'create',
    });
  };

  it('moves failed entries back to pending', async () => {
    await enqueueOne();
    const pending = await syncQueue.listPending(OWNER);
    await syncQueue.markFailed(OWNER, pending[0].id, 'boom');

    await expect(syncQueue.retryFailed(OWNER)).resolves.toBe(1);

    await expect(syncQueue.countFailed(OWNER)).resolves.toBe(0);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('clears the attempt count so backoff starts fresh', async () => {
    await enqueueOne();
    const [entry] = await syncQueue.listPending(OWNER);
    await syncQueue.markRetry(OWNER, entry.id, new Date().toISOString(), 'first');
    await syncQueue.markFailed(OWNER, entry.id, 'boom');

    await syncQueue.retryFailed(OWNER);

    const [retried] = await syncQueue.listPending(OWNER);
    expect(retried.attempt_count).toBe(0);
    expect(retried.last_error).toBeNull();
  });

  it('tells the UI something changed', async () => {
    await enqueueOne();
    const [entry] = await syncQueue.listPending(OWNER);
    await syncQueue.markFailed(OWNER, entry.id, 'boom');

    let calls = 0;
    const unsubscribe = subscribeToSyncQueue(() => {
      calls += 1;
    });

    await syncQueue.retryFailed(OWNER);

    expect(calls).toBe(1);
    unsubscribe();
  });

  it('does nothing when there is nothing to retry', async () => {
    await enqueueOne();
    await expect(syncQueue.retryFailed(OWNER)).resolves.toBe(0);
  });

  it('never touches another user failed work', async () => {
    await upsertLocalUser({ id: 'other-user' });
    await enqueueOne();
    const [entry] = await syncQueue.listPending(OWNER);
    await syncQueue.markFailed(OWNER, entry.id, 'boom');

    await expect(syncQueue.retryFailed(asOwnerUserId('other-user'))).resolves.toBe(0);
    await expect(syncQueue.countFailed(OWNER)).resolves.toBe(1);
  });
});
