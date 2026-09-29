import { AxiosError, AxiosHeaders } from 'axios';
import { open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  getDatabase,
  initializeDatabase,
} from '../src/services/db';
import { APP_META_KEYS, getAppMeta } from '../src/services/db/appMeta';
import { getLocalUser, upsertLocalUser } from '../src/repositories/userRepository';
import { farmRepository } from '../src/repositories';
import {
  STALE_CLAIM_MS,
  classifyFailure,
  clearOwner,
  createManualConnectivity,
  createSyncHttpClient,
  createSyncSubsystem,
  establishOwner,
  isStateOnline,
  resolveOwner,
  setSyncLogSink,
  syncQueue,
} from '../src/services/sync';

const OWNER_A_ID = 'user-a';
const OWNER_B_ID = 'user-b';
const OWNER_A = asOwnerUserId(OWNER_A_ID);
const OWNER_B = asOwnerUserId(OWNER_B_ID);

const axiosFailure = (status: number | null): AxiosError => {
  const error = new AxiosError('failed', 'ERR');
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

const seedQueueEntry = async (ownerId: string) => {
  const owner = asOwnerUserId(ownerId);
  const farm = await farmRepository.create(owner, { name: `Farm ${ownerId}` });
  const outcome = await syncQueue.enqueue(owner, {
    entityType: 'farm',
    entityLocalId: farm.local_id,
    operation: 'create',
  });
  return outcome.kind === 'inserted' ? outcome.entry : null;
};

const makeStale = async (id: number): Promise<void> => {
  await getDatabase().execute('UPDATE sync_queue SET claimed_at = ? WHERE id = ?', [
    new Date(Date.now() - STALE_CLAIM_MS - 60_000).toISOString(),
    id,
  ]);
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

describe('local identity and owner resolution', () => {
  it('creates a local user row from the authenticated user', async () => {
    const owner = await establishOwner({
      id: OWNER_A_ID,
      email: 'a@example.com',
      fullName: 'Farmer A',
      role: 'farmer',
    });

    expect(owner).toBe(OWNER_A_ID);
    const stored = await getLocalUser(OWNER_A_ID);
    expect(stored?.email).toBe('a@example.com');
    expect(stored?.role).toBe('farmer');
    await expect(getAppMeta(APP_META_KEYS.activeUserId)).resolves.toBe(OWNER_A_ID);
  });

  it('is idempotent across repeated logins', async () => {
    await establishOwner({ id: OWNER_A_ID, email: 'a@example.com' });
    await establishOwner({ id: OWNER_A_ID, fullName: 'Renamed' });

    const users = await getDatabase().execute('SELECT COUNT(*) AS c FROM users');
    expect(Number(users.rows[0].c)).toBe(1);

    const stored = await getLocalUser(OWNER_A_ID);
    expect(stored?.email).toBe('a@example.com');
    expect(stored?.name).toBe('Renamed');
  });

  it('resolves the persisted owner after a restart', async () => {
    await establishOwner({ id: OWNER_A_ID });
    await closeDatabase();
    await initializeDatabase();

    await expect(resolveOwner()).resolves.toBe(OWNER_A_ID);
  });

  it('returns null when no owner has been established', async () => {
    await expect(resolveOwner()).resolves.toBeNull();
  });

  it('returns null after the owner is cleared', async () => {
    await establishOwner({ id: OWNER_A_ID });
    await clearOwner();
    await expect(resolveOwner()).resolves.toBeNull();
  });

  it('refuses an empty user id', async () => {
    await expect(upsertLocalUser({ id: '   ' })).rejects.toThrow(/without an id/i);
  });
});

describe('startup stale in-flight recovery', () => {
  it('recovers only the resolved owner’s entries', async () => {
    await establishOwner({ id: OWNER_A_ID });
    await upsertLocalUser({ id: OWNER_B_ID });

    const entryA = await seedQueueEntry(OWNER_A_ID);
    const entryB = await seedQueueEntry(OWNER_B_ID);

    await syncQueue.claim(OWNER_A);
    await syncQueue.claim(OWNER_B);
    await makeStale(entryA!.id);
    await makeStale(entryB!.id);

    const subsystem = createSyncSubsystem({
      connectivity: createManualConnectivity(false),
      autoFlushOnReconnect: false,
    });
    const recovered = await subsystem.recoverForCurrentOwner();

    expect(recovered).toBe(1);
    await expect(syncQueue.getEntry(OWNER_A, entryA!.id)).resolves.toMatchObject({
      status: 'pending',
    });
    await expect(syncQueue.getEntry(OWNER_B, entryB!.id)).resolves.toMatchObject({
      status: 'processing',
    });
    subsystem.dispose();
  });

  it('performs no recovery when there is no owner', async () => {
    await upsertLocalUser({ id: OWNER_A_ID });
    const entry = await seedQueueEntry(OWNER_A_ID);
    await syncQueue.claim(OWNER_A);
    await makeStale(entry!.id);

    const subsystem = createSyncSubsystem({
      connectivity: createManualConnectivity(false),
      autoFlushOnReconnect: false,
    });
    await expect(subsystem.recoverForCurrentOwner()).resolves.toBe(0);

    await expect(syncQueue.getEntry(OWNER_A, entry!.id)).resolves.toMatchObject({
      status: 'processing',
    });
    subsystem.dispose();
  });

  it('recovers on activate for the activated owner', async () => {
    await upsertLocalUser({ id: OWNER_A_ID });
    const entry = await seedQueueEntry(OWNER_A_ID);
    await syncQueue.claim(OWNER_A);
    await makeStale(entry!.id);

    const subsystem = createSyncSubsystem({
      connectivity: createManualConnectivity(false),
      autoFlushOnReconnect: false,
    });
    await subsystem.activate({ id: OWNER_A_ID });

    await expect(syncQueue.getEntry(OWNER_A, entry!.id)).resolves.toMatchObject({
      status: 'pending',
    });
    subsystem.dispose();
  });

  it('leaves a recoverable queue after a restart', async () => {
    await establishOwner({ id: OWNER_A_ID });
    const entry = await seedQueueEntry(OWNER_A_ID);
    await syncQueue.claim(OWNER_A);

    await closeDatabase();
    await initializeDatabase();

    const stored = await syncQueue.getEntry(OWNER_A, entry!.id);
    expect(stored?.status).toBe('processing');
    await makeStale(entry!.id);

    const subsystem = createSyncSubsystem({
      connectivity: createManualConnectivity(false),
      autoFlushOnReconnect: false,
    });
    await expect(subsystem.recoverForCurrentOwner()).resolves.toBe(1);
    subsystem.dispose();
  });
});

describe('logout / user switching safety', () => {
  it('never processes user A’s queue as user B', async () => {
    await upsertLocalUser({ id: OWNER_A_ID });
    await upsertLocalUser({ id: OWNER_B_ID });
    const entryA = await seedQueueEntry(OWNER_A_ID);

    const subsystem = createSyncSubsystem({
      connectivity: createManualConnectivity(true),
      adapters: [
        {
          entityType: 'farm',
          create: async () => ({ serverId: 'srv-should-not-happen' }),
        },
      ],
      autoFlushOnReconnect: false,
    });

    await subsystem.activate({ id: OWNER_B_ID });
    await subsystem.flushIfPossible();

    const untouched = await syncQueue.getEntry(OWNER_A, entryA!.id);
    expect(untouched?.status).toBe('pending');
    expect(untouched?.owner_user_id).toBe(OWNER_A_ID);
    subsystem.dispose();
  });

  it('does not reassign queue ownership when users switch', async () => {
    await upsertLocalUser({ id: OWNER_A_ID });
    await upsertLocalUser({ id: OWNER_B_ID });
    const entryA = await seedQueueEntry(OWNER_A_ID);

    const subsystem = createSyncSubsystem({
      connectivity: createManualConnectivity(false),
      autoFlushOnReconnect: false,
    });
    await subsystem.activate({ id: OWNER_A_ID });
    await subsystem.deactivate();
    await subsystem.activate({ id: OWNER_B_ID });

    expect(subsystem.owner()).toBe(OWNER_B_ID);
    const stored = await syncQueue.getEntry(OWNER_A, entryA!.id);
    expect(stored?.owner_user_id).toBe(OWNER_A_ID);
    await expect(syncQueue.countPending(OWNER_B)).resolves.toBe(0);
    subsystem.dispose();
  });

  it('stops flushing after deactivate', async () => {
    await upsertLocalUser({ id: OWNER_A_ID });
    await seedQueueEntry(OWNER_A_ID);

    let calls = 0;
    const subsystem = createSyncSubsystem({
      connectivity: createManualConnectivity(true),
      adapters: [
        {
          entityType: 'farm',
          create: async () => {
            calls += 1;
            return { serverId: 'srv' };
          },
        },
      ],
      autoFlushOnReconnect: false,
    });

    await subsystem.activate({ id: OWNER_A_ID });
    await subsystem.deactivate();
    await subsystem.flushIfPossible();

    expect(calls).toBe(0);
    subsystem.dispose();
  });
});

describe('connectivity provider', () => {
  it('maps NetInfo state to an online decision', () => {
    expect(isStateOnline(null)).toBe(false);
    expect(
      isStateOnline({ isConnected: false, isInternetReachable: true } as never),
    ).toBe(false);
    expect(
      isStateOnline({ isConnected: true, isInternetReachable: false } as never),
    ).toBe(false);
    expect(
      isStateOnline({ isConnected: true, isInternetReachable: null } as never),
    ).toBe(true);
    expect(
      isStateOnline({ isConnected: true, isInternetReachable: true } as never),
    ).toBe(true);
  });

  it('blocks flushing while offline and allows it once online', async () => {
    await upsertLocalUser({ id: OWNER_A_ID });
    await seedQueueEntry(OWNER_A_ID);

    let calls = 0;
    const connectivity = createManualConnectivity(false);
    const subsystem = createSyncSubsystem({
      connectivity,
      adapters: [
        {
          entityType: 'farm',
          create: async () => {
            calls += 1;
            return { serverId: 'srv' };
          },
        },
      ],
      autoFlushOnReconnect: false,
    });

    await subsystem.activate({ id: OWNER_A_ID });
    await subsystem.flushIfPossible();
    expect(calls).toBe(0);

    connectivity.setOnline(true);
    await subsystem.flushIfPossible();
    expect(calls).toBe(1);
    subsystem.dispose();
  });

  it('auto-flushes when connectivity is restored', async () => {
    await upsertLocalUser({ id: OWNER_A_ID });
    await seedQueueEntry(OWNER_A_ID);

    let calls = 0;
    const connectivity = createManualConnectivity(false);
    const subsystem = createSyncSubsystem({
      connectivity,
      adapters: [
        {
          entityType: 'farm',
          create: async () => {
            calls += 1;
            return { serverId: 'srv' };
          },
        },
      ],
    });

    await subsystem.activate({ id: OWNER_A_ID });
    connectivity.setOnline(true);
    await new Promise<void>(resolve => { setImmediate(resolve); });
    await new Promise<void>(resolve => { setImmediate(resolve); });

    expect(calls).toBe(1);
    subsystem.dispose();
  });

  it('stops notifying after dispose', async () => {
    const connectivity = createManualConnectivity(false);
    const subsystem = createSyncSubsystem({ connectivity });
    subsystem.dispose();

    connectivity.setOnline(true);
    expect(subsystem.owner()).toBeNull();
  });
});

describe('auth-safe sync http client', () => {
  const loadClient = (): import('axios').AxiosInstance =>
    createSyncHttpClient();

  const stubAdapter = (
    client: import('axios').AxiosInstance,
    handler: (attempt: number) => { status: number },
  ): { attempts: () => number } => {
    let attempts = 0;
    client.defaults.adapter = async config => {
      attempts += 1;
      const { status } = handler(attempts);
      const response = {
        data: { ok: status < 400 },
        status,
        statusText: String(status),
        headers: new AxiosHeaders(),
        config,
      };
      if (status >= 400) {
        throw new AxiosError('failed', 'ERR', config, null, response as never);
      }
      return response as never;
    };
    return { attempts: () => attempts };
  };

  it('sends a request with the stored token', async () => {
    const client = loadClient();
    stubAdapter(client, () => ({ status: 200 }));

    const response = await client.get('/probe');
    expect(response.status).toBe(200);
  });

  it('refreshes once and retries when the token is expired', async () => {
    const http = require('../src/services/http');
    const spy = jest
      .spyOn(http, 'refreshAccessToken')
      .mockResolvedValue('fresh-token');

    const client = loadClient();
    const tracker = stubAdapter(client, attempt => ({
      status: attempt === 1 ? 401 : 200,
    }));

    const response = await client.get('/protected');
    expect(response.status).toBe(200);
    expect(tracker.attempts()).toBe(2);
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it('surfaces 401 without logging out when the refresh fails', async () => {
    const http = require('../src/services/http');
    const spy = jest.spyOn(http, 'refreshAccessToken').mockResolvedValue(null);
    const unauthorized = jest.fn();
    http.setUnauthorizedHandler(unauthorized);

    const client = loadClient();
    const tracker = stubAdapter(client, () => ({ status: 401 }));

    await expect(client.get('/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(tracker.attempts()).toBe(1);
    expect(unauthorized).not.toHaveBeenCalled();

    http.setUnauthorizedHandler(null);
    spy.mockRestore();
  });

  it('does not retry the refresh more than once', async () => {
    const http = require('../src/services/http');
    const spy = jest
      .spyOn(http, 'refreshAccessToken')
      .mockResolvedValue('fresh-token');

    const client = loadClient();
    const tracker = stubAdapter(client, () => ({ status: 401 }));

    await expect(client.get('/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(tracker.attempts()).toBe(2);
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});

describe('sync auth failure keeps work recoverable', () => {
  it('classifies 401 as auth and leaves the entry pending', async () => {
    expect(classifyFailure(axiosFailure(401)).kind).toBe('auth');

    await upsertLocalUser({ id: OWNER_A_ID });
    const entry = await seedQueueEntry(OWNER_A_ID);

    const subsystem = createSyncSubsystem({
      connectivity: createManualConnectivity(true),
      adapters: [
        {
          entityType: 'farm',
          create: async () => {
            throw axiosFailure(401);
          },
        },
      ],
      autoFlushOnReconnect: false,
    });

    await subsystem.activate({ id: OWNER_A_ID });
    await subsystem.flushIfPossible();

    const stored = await syncQueue.getEntry(OWNER_A, entry!.id);
    expect(stored?.status).toBe('pending');
    expect(stored?.attempt_count).toBe(0);
    await expect(syncQueue.countFailed(OWNER_A)).resolves.toBe(0);
    subsystem.dispose();
  });

  it('keeps local data intact after an auth failure', async () => {
    await upsertLocalUser({ id: OWNER_A_ID });
    await seedQueueEntry(OWNER_A_ID);

    const subsystem = createSyncSubsystem({
      connectivity: createManualConnectivity(true),
      adapters: [
        {
          entityType: 'farm',
          create: async () => {
            throw axiosFailure(401);
          },
        },
      ],
      autoFlushOnReconnect: false,
    });
    await subsystem.activate({ id: OWNER_A_ID });
    await subsystem.flushIfPossible();

    await expect(farmRepository.count(OWNER_A)).resolves.toBe(1);
    await expect(getLocalUser(OWNER_A_ID)).resolves.not.toBeNull();
    subsystem.dispose();
  });
});

describe('normal app http behaviour is unchanged', () => {
  it('still invokes the global unauthorized handler on an unrecoverable 401', async () => {
    const httpModule = require('../src/services/http');
    const client = httpModule.default as import('axios').AxiosInstance;
    const unauthorized = jest.fn();
    httpModule.setUnauthorizedHandler(unauthorized);

    const previousAdapter = client.defaults.adapter;
    client.defaults.adapter = async config => {
      const response = {
        data: {},
        status: 401,
        statusText: '401',
        headers: new AxiosHeaders(),
        config,
      };
      throw new AxiosError('unauthorized', 'ERR', config, null, response as never);
    };

    await expect(client.get('/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(unauthorized).toHaveBeenCalledTimes(1);

    client.defaults.adapter = previousAdapter;
    httpModule.setUnauthorizedHandler(null);
  });
});
