import { open } from '@op-engineering/op-sqlite';
import {
  signOutConfirmLabel,
  signOutTitle,
  signOutWarning,
} from '../src/hooks/useSignOut';
import {
  DATABASE_NAME,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  getDatabase,
  initializeDatabase,
} from '../src/services/db';
import { APP_META_KEYS, getAppMeta } from '../src/services/db/appMeta';
import { farmRepository, fieldRepository } from '../src/repositories';
import {
  createFarmOffline,
  createFieldOffline,
  createSyncSubsystem,
  offlineConnectivity,
  resolveOwner,
  setSyncLogSink,
  syncQueue,
} from '../src/services/sync';

const USER = { id: 'farmer-logout', email: 'a@b.c', fullName: 'A', role: 'farmer' };
const OWNER = asOwnerUserId(USER.id);

const subsystem = () =>
  createSyncSubsystem({
    connectivity: offlineConnectivity,
    adapters: [],
    autoFlushOnReconnect: false,
  });

const buildPendingWork = async () => {
  const farm = await createFarmOffline(OWNER, { name: 'Green Acres' });
  const field = await createFieldOffline(OWNER, farm.local_id, { name: 'North block' });
  return { farm, field };
};

beforeEach(async () => {
  setSyncLogSink(() => {});
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
});

afterAll(async () => {
  setSyncLogSink(null);
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

describe('logging out with unsent work', () => {
  it('counts what has not reached the server', async () => {
    const sync = subsystem();
    await sync.activate(USER);
    await buildPendingWork();

    await expect(syncQueue.countUnsent(OWNER)).resolves.toBe(2);
    sync.dispose();
  });

  it('counts failed entries too, so nothing is written off silently', async () => {
    const sync = subsystem();
    await sync.activate(USER);
    await buildPendingWork();
    const entries = await syncQueue.listPending(OWNER);
    await syncQueue.markFailed(OWNER, entries[0].id, 'gave up');

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
    await expect(syncQueue.countUnsent(OWNER)).resolves.toBe(2);
    sync.dispose();
  });

  it('keeps every row and queue entry after logging out', async () => {
    const sync = subsystem();
    await sync.activate(USER);
    const work = await buildPendingWork();

    await sync.deactivate();

    await expect(getAppMeta(APP_META_KEYS.activeUserId)).resolves.toBeNull();
    await expect(syncQueue.countUnsent(OWNER)).resolves.toBe(2);
    await expect(farmRepository.getByLocalId(OWNER, work.farm.local_id)).resolves.not.toBeNull();
    await expect(fieldRepository.getByLocalId(OWNER, work.field.local_id)).resolves.not.toBeNull();
    sync.dispose();
  });

  it('picks the work back up when the same user signs in again', async () => {
    const first = subsystem();
    await first.activate(USER);
    const work = await buildPendingWork();
    await first.deactivate();
    first.dispose();

    await closeDatabase();
    await initializeDatabase();

    const second = subsystem();
    const owner = await second.activate(USER);

    expect(owner).toBe(OWNER);
    await expect(resolveOwner()).resolves.toBe(OWNER);
    await expect(syncQueue.countUnsent(owner)).resolves.toBe(2);
    const pending = await syncQueue.listPending(owner);
    expect(pending.map(e => e.entity_type).sort()).toEqual(['farm', 'field']);
    await expect(farmRepository.getByLocalId(owner, work.farm.local_id)).resolves.not.toBeNull();
    second.dispose();
  });

  it('hides the previous user work from whoever signs in next', async () => {
    const first = subsystem();
    await first.activate(USER);
    await buildPendingWork();
    await first.deactivate();
    first.dispose();

    const second = subsystem();
    const other = await second.activate({ id: 'someone-else' });

    await expect(syncQueue.countUnsent(other)).resolves.toBe(0);
    await expect(farmRepository.list(other)).resolves.toHaveLength(0);
    await expect(fieldRepository.list(other)).resolves.toHaveLength(0);

    await expect(syncQueue.countUnsent(OWNER)).resolves.toBe(2);
    second.dispose();
  });

  it('reports nothing pending on a clean session', async () => {
    const sync = subsystem();
    await sync.activate(USER);

    await expect(syncQueue.countUnsent(OWNER)).resolves.toBe(0);
    sync.dispose();
  });
});

describe('queue housekeeping on startup', () => {
  const enqueueOne = async (): Promise<number> => {
    await createFarmOffline(OWNER, { name: 'Green Acres' });
    const [entry] = await syncQueue.listPending(OWNER);
    return entry.id;
  };

  it('clears completed entries that are old', async () => {
    const first = subsystem();
    await first.activate(USER);
    const id = await enqueueOne();
    await syncQueue.markSuccess(OWNER, id);
    await getDatabase().execute(
      "UPDATE sync_queue SET updated_at = '2020-01-01T00:00:00.000Z' WHERE id = ?",
      [id],
    );
    first.dispose();

    const second = subsystem();
    await second.activate(USER);

    const rows = await getDatabase().execute('SELECT COUNT(*) AS c FROM sync_queue');
    expect(Number(rows.rows[0].c)).toBe(0);
    second.dispose();
  });

  it('keeps completed entries that are recent', async () => {
    const first = subsystem();
    await first.activate(USER);
    const id = await enqueueOne();
    await syncQueue.markSuccess(OWNER, id);
    first.dispose();

    const second = subsystem();
    await second.activate(USER);

    const rows = await getDatabase().execute('SELECT COUNT(*) AS c FROM sync_queue');
    expect(Number(rows.rows[0].c)).toBe(1);
    second.dispose();
  });

  it('never purges work that has not been sent', async () => {
    const first = subsystem();
    await first.activate(USER);
    await enqueueOne();
    await getDatabase().execute(
      "UPDATE sync_queue SET updated_at = '2020-01-01T00:00:00.000Z'",
    );
    first.dispose();

    const second = subsystem();
    await second.activate(USER);

    await expect(syncQueue.countUnsent(OWNER)).resolves.toBe(1);
    second.dispose();
  });

  it('never purges another owner completed entries', async () => {
    const first = subsystem();
    await first.activate(USER);
    const id = await enqueueOne();
    await syncQueue.markSuccess(OWNER, id);
    await getDatabase().execute(
      "UPDATE sync_queue SET updated_at = '2020-01-01T00:00:00.000Z'",
    );
    await first.deactivate();
    first.dispose();

    const second = subsystem();
    await second.activate({ id: 'someone-else' });

    const rows = await getDatabase().execute('SELECT COUNT(*) AS c FROM sync_queue');
    expect(Number(rows.rows[0].c)).toBe(1);
    second.dispose();
  });
});

describe('what the sign-out dialog says', () => {
  it('warns and reassures when work is unsent', () => {
    expect(signOutTitle(3)).toBe('Log out with unsent work?');
    expect(signOutConfirmLabel(3)).toBe('Log out anyway');
    const message = signOutWarning(3);
    expect(message).toContain('3 changes');
    expect(message).toMatch(/stay saved on this device/i);
  });

  it('uses the singular for one change', () => {
    const message = signOutWarning(1);
    expect(message).toMatch(/^One change/);
    expect(message).not.toContain('1 changes');
  });

  it('stays calm when there is nothing outstanding', () => {
    expect(signOutTitle(0)).toBe('Log out?');
    expect(signOutConfirmLabel(0)).toBe('Log out');
    expect(signOutWarning(0)).toMatch(/sign back in at any time/i);
  });

  it('never tells the user their work will be lost', () => {
    for (const count of [0, 1, 5]) {
      expect(signOutWarning(count)).not.toMatch(/lost|deleted|discard/i);
    }
  });
});
