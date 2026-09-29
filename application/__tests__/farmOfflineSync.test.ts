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
import { farmRepository } from '../src/repositories';
import { upsertLocalUser } from '../src/repositories/userRepository';
import {
  ENTITY_TYPES,
  createSyncEngine,
  farmAdapter,
  offlineConnectivity,
  optimisticConnectivity,
  setSyncLogSink,
  syncQueue,
} from '../src/services/sync';
import { syncHttp } from '../src/services/sync/syncHttp';

const OWNER_ID = 'farmer-farm';
const OWNER = asOwnerUserId(OWNER_ID);

interface Call {
  method: string;
  url: string;
  body: Record<string, unknown>;
}

let calls: Call[] = [];
let handler: (call: Call, attempt: number) => { status: number; data?: unknown } = () => ({
  status: 201,
  data: { data: { farm: { id: 'srv-farm-1', updated_at: '2026-09-10T00:00:00Z' } } },
});

const installAdapter = (): void => {
  let attempt = 0;
  syncHttp.defaults.adapter = async config => {
    attempt += 1;
    const call: Call = {
      method: (config.method ?? '').toLowerCase(),
      url: config.url ?? '',
      body: typeof config.data === 'string' ? JSON.parse(config.data) : {},
    };
    calls.push(call);
    const outcome = handler(call, attempt);
    const response = {
      data: outcome.data ?? {},
      status: outcome.status,
      statusText: String(outcome.status),
      headers: new AxiosHeaders(),
      config,
    };
    if (outcome.status >= 400) {
      throw new AxiosError('failed', 'ERR', config, null, response as never);
    }
    if (outcome.status === 0) {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config, {});
    }
    return response as never;
  };
};

const engine = (online = true) =>
  createSyncEngine({
    connectivity: online ? optimisticConnectivity : offlineConnectivity,
    adapters: [farmAdapter],
  });

const createFarmOffline = async (name = 'North Block') => {
  const farm = await farmRepository.create(OWNER, { name, area_acres: 12.5 });
  await syncQueue.enqueue(OWNER, {
    entityType: ENTITY_TYPES.farm,
    entityLocalId: farm.local_id,
    operation: 'create',
  });
  return farm;
};

beforeEach(async () => {
  setSyncLogSink(() => {});
  calls = [];
  handler = () => ({
    status: 201,
    data: { data: { farm: { id: 'srv-farm-1', updated_at: '2026-09-10T00:00:00Z' } } },
  });
  installAdapter();
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

describe('offline farm creation', () => {
  it('stores the farm locally and queues it without any request', async () => {
    const farm = await createFarmOffline();

    expect(farm.server_id).toBeNull();
    expect(farm.sync_state).toBe('local');
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
    expect(calls).toHaveLength(0);
  });

  it('performs no request while offline', async () => {
    await createFarmOffline();
    const result = await engine(false).flush(OWNER);

    expect(result.stoppedBecause).toBe('offline');
    expect(calls).toHaveLength(0);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('creates on the server and records the server id', async () => {
    const farm = await createFarmOffline();

    const result = await engine().flush(OWNER);
    expect(result.succeeded).toBe(1);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('post');
    expect(calls[0].url).toBe('/farms/me/farms');
    expect(calls[0].body).toMatchObject({ name: 'North Block', areaAcres: 12.5 });

    const stored = await farmRepository.getByLocalId(OWNER, farm.local_id);
    expect(stored?.local_id).toBe(farm.local_id);
    expect(stored?.server_id).toBe('srv-farm-1');
    expect(stored?.sync_state).toBe('synced');
  });

  it('coalesces edits made before the first sync', async () => {
    const farm = await createFarmOffline();
    await farmRepository.update(OWNER, farm.local_id, { name: 'Renamed Block' });
    await syncQueue.enqueue(OWNER, {
      entityType: ENTITY_TYPES.farm,
      entityLocalId: farm.local_id,
      operation: 'update',
    });

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);

    await engine().flush(OWNER);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('post');
    expect(calls[0].body.name).toBe('Renamed Block');
  });

  it('survives a restart with the farm still queued', async () => {
    const farm = await createFarmOffline();

    await closeDatabase();
    await initializeDatabase();

    const stored = await farmRepository.getByLocalId(OWNER, farm.local_id);
    expect(stored?.name).toBe('North Block');
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });
});

describe('duplicate protection when a response is lost', () => {
  it('adopts the existing server record instead of creating a second one', async () => {
    const farm = await createFarmOffline();
    const createdAt = (await farmRepository.getByLocalId(OWNER, farm.local_id))!.created_at;

    handler = call => {
      if (call.method === 'post') {
        return { status: 500 };
      }
      return { status: 200, data: { data: { farms: [] } } };
    };
    await engine().flush(OWNER);

    const afterFailure = await syncQueue.listPending(OWNER);
    expect(afterFailure[0].attempt_count).toBe(1);

    calls = [];
    handler = call => {
      if (call.method === 'get') {
        return {
          status: 200,
          data: {
            data: {
              farms: [
                {
                  id: 'srv-already-created',
                  name: 'North Block',
                  area_acres: '12.50',
                  created_at: createdAt,
                  updated_at: createdAt,
                },
              ],
            },
          },
        };
      }
      return { status: 201, data: { data: { farm: { id: 'srv-duplicate' } } } };
    };

    await getDatabase().execute(
      "UPDATE sync_queue SET available_at = ? WHERE owner_user_id = ?",
      [new Date(Date.now() - 1000).toISOString(), OWNER_ID],
    );

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls.filter(c => c.method === 'post')).toHaveLength(0);

    const stored = await farmRepository.getByLocalId(OWNER, farm.local_id);
    expect(stored?.server_id).toBe('srv-already-created');
    expect(stored?.sync_state).toBe('synced');
  });

  it('creates the farm when verification finds no existing record', async () => {
    const farm = await createFarmOffline();

    handler = call => (call.method === 'post' ? { status: 500 } : { status: 200, data: { data: { farms: [] } } });
    await engine().flush(OWNER);

    calls = [];
    handler = call => {
      if (call.method === 'get') {
        return { status: 200, data: { data: { farms: [] } } };
      }
      return { status: 201, data: { data: { farm: { id: 'srv-created-now' } } } };
    };

    await getDatabase().execute(
      "UPDATE sync_queue SET available_at = ? WHERE owner_user_id = ?",
      [new Date(Date.now() - 1000).toISOString(), OWNER_ID],
    );

    await engine().flush(OWNER);

    expect(calls.filter(c => c.method === 'post')).toHaveLength(1);
    const stored = await farmRepository.getByLocalId(OWNER, farm.local_id);
    expect(stored?.server_id).toBe('srv-created-now');
  });

  it('does not verify on the very first attempt', async () => {
    await createFarmOffline();
    await engine().flush(OWNER);

    expect(calls.filter(c => c.method === 'get')).toHaveLength(0);
    expect(calls.filter(c => c.method === 'post')).toHaveLength(1);
  });

  it('does not match a farm with a different name', async () => {
    await createFarmOffline('North Block');

    handler = call => (call.method === 'post' ? { status: 500 } : { status: 200, data: { data: { farms: [] } } });
    await engine().flush(OWNER);

    calls = [];
    handler = call => {
      if (call.method === 'get') {
        return {
          status: 200,
          data: {
            data: {
              farms: [{ id: 'srv-other', name: 'Different Farm', area_acres: '12.50' }],
            },
          },
        };
      }
      return { status: 201, data: { data: { farm: { id: 'srv-created' } } } };
    };

    await getDatabase().execute(
      "UPDATE sync_queue SET available_at = ? WHERE owner_user_id = ?",
      [new Date(Date.now() - 1000).toISOString(), OWNER_ID],
    );
    await engine().flush(OWNER);

    expect(calls.filter(c => c.method === 'post')).toHaveLength(1);
  });
});

describe('farm failure handling', () => {
  it('keeps the farm locally when the server rejects it permanently', async () => {
    const farm = await createFarmOffline();
    handler = () => ({ status: 422 });

    const result = await engine().flush(OWNER);

    expect(result.failed).toBe(1);
    const stored = await farmRepository.getByLocalId(OWNER, farm.local_id);
    expect(stored).not.toBeNull();
    await expect(syncQueue.countFailed(OWNER)).resolves.toBe(1);
  });

  it('never deletes a local farm because sync failed', async () => {
    await createFarmOffline();
    handler = () => ({ status: 500 });

    await engine().flush(OWNER);

    await expect(farmRepository.count(OWNER)).resolves.toBe(1);
  });
});
