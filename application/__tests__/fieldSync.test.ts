import { AxiosError, AxiosHeaders } from 'axios';
import { open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  initializeDatabase,
} from '../src/services/db';
import { upsertLocalUser } from '../src/repositories/userRepository';
import { farmRepository, fieldRepository } from '../src/repositories';
import { fieldsBlockedByUnsyncedFarm } from '../src/repositories/fieldRepository';
import {
  createFarmOffline,
  createFieldOffline,
  createSyncEngine,
  deleteFieldOffline,
  farmAdapter,
  fieldAdapter,
  optimisticConnectivity,
  setSyncLogSink,
  syncQueue,
  updateFieldOffline,
} from '../src/services/sync';
import { syncHttp } from '../src/services/sync/syncHttp';

const OWNER_ID = 'farmer-fields';
const OWNER = asOwnerUserId(OWNER_ID);

interface Call {
  url: string;
  method: string;
  body: unknown;
}

let calls: Call[] = [];
let handler: (call: Call) => { status: number; data?: unknown } = () => ({
  status: 200,
  data: {},
});

const installAdapter = (): void => {
  syncHttp.defaults.adapter = async config => {
    const call: Call = {
      url: config.url ?? '',
      method: (config.method ?? '').toLowerCase(),
      body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
    };
    calls.push(call);
    const outcome = handler(call);
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
    return response as never;
  };
};

const engine = () =>
  createSyncEngine({
    connectivity: optimisticConnectivity,
    adapters: [farmAdapter, fieldAdapter],
  });

const respondCreated = (): void => {
  handler = call => {
    if (call.method === 'post' && call.url.endsWith('/fields')) {
      return {
        status: 201,
        data: {
          data: {
            field: {
              id: 'srv-field-1',
              name: 'North block',
              updated_at: '2026-09-10T00:00:00Z',
            },
          },
        },
      };
    }
    if (call.method === 'post') {
      return {
        status: 201,
        data: {
          data: {
            farm: {
              id: 'srv-farm-1',
              name: 'Green Acres',
              updated_at: '2026-09-10T00:00:00Z',
            },
          },
        },
      };
    }
    if (call.method === 'patch') {
      return {
        status: 200,
        data: {
          data: {
            field: { id: 'srv-field-1', updated_at: '2026-09-11T00:00:00Z' },
          },
        },
      };
    }
    return { status: 200, data: {} };
  };
};

const newFarm = (serverId: string | null = null) =>
  serverId
    ? farmRepository.create(OWNER, { name: 'Green Acres', server_id: serverId })
    : createFarmOffline(OWNER, { name: 'Green Acres' });

const newField = (farmLocalId: string) =>
  createFieldOffline(OWNER, farmLocalId, {
    name: 'North block',
    area_acres: 4.5,
    crop: 'Wheat',
  });

beforeEach(async () => {
  setSyncLogSink(() => {});
  calls = [];
  respondCreated();
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

describe('offline field creation', () => {
  it('stores the field and queues it without a network call', async () => {
    const farm = await newFarm('srv-farm-1');
    const field = await newField(farm.local_id);

    expect(field.server_id).toBeNull();
    expect(field.farm_local_id).toBe(farm.local_id);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
    expect(calls).toHaveLength(0);
  });

  it('sends the field to its farm once flushed', async () => {
    const farm = await newFarm('srv-farm-1');
    const field = await newField(farm.local_id);

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls[0].url).toBe('/farms/srv-farm-1/fields');
    expect(calls[0].body).toMatchObject({
      name: 'North block',
      areaAcres: 4.5,
      crop: 'Wheat',
    });

    const stored = await fieldRepository.getByLocalId(OWNER, field.local_id);
    expect(stored?.server_id).toBe('srv-field-1');
    expect(stored?.sync_state).toBe('synced');
  });
});

describe('farm to field dependency', () => {
  it('records the dependency when the farm is also offline', async () => {
    const farm = await newFarm();
    await newField(farm.local_id);

    const pending = await syncQueue.listPending(OWNER);
    const farmEntry = pending.find(e => e.entity_type === 'farm');
    const fieldEntry = pending.find(e => e.entity_type === 'field');

    expect(farmEntry).toBeDefined();
    expect(fieldEntry?.depends_on_id).toBe(farmEntry?.id);
  });

  it('creates the farm first and then the field with the real farm id', async () => {
    const farm = await newFarm();
    const field = await newField(farm.local_id);

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(2);
    expect(calls.map(c => c.url)).toEqual(['/farms/me/farms', '/farms/srv-farm-1/fields']);

    const storedFarm = await farmRepository.getByLocalId(OWNER, farm.local_id);
    const storedField = await fieldRepository.getByLocalId(OWNER, field.local_id);
    expect(storedFarm?.server_id).toBe('srv-farm-1');
    expect(storedField?.server_id).toBe('srv-field-1');
  });

  it('holds the field back while its farm is still unsynced', async () => {
    const farm = await newFarm();
    await newField(farm.local_id);

    handler = call =>
      call.url === '/farms/me/farms' ? { status: 500 } : { status: 201, data: {} };

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(0);
    expect(calls.map(c => c.url)).toEqual(['/farms/me/farms']);
    await expect(fieldsBlockedByUnsyncedFarm(OWNER)).resolves.toHaveLength(1);
  });

  it('never posts a field to an undefined farm id', async () => {
    const farm = await newFarm();
    await newField(farm.local_id);

    handler = call =>
      call.url === '/farms/me/farms'
        ? { status: 201, data: { data: { farm: {} } } }
        : { status: 201, data: {} };

    await engine().flush(OWNER);

    for (const call of calls) {
      expect(call.url).not.toContain('undefined');
      expect(call.url).not.toContain('null');
    }
  });
});

describe('field updates and deletes', () => {
  it('updates against the resolved farm and field ids', async () => {
    const farm = await newFarm('srv-farm-1');
    const field = await newField(farm.local_id);
    await engine().flush(OWNER);
    calls = [];

    await updateFieldOffline(OWNER, field.local_id, { crop: 'Barley' });
    await engine().flush(OWNER);

    expect(calls[0].method).toBe('patch');
    expect(calls[0].url).toBe('/farms/srv-farm-1/fields/srv-field-1');
    expect(calls[0].body).toMatchObject({ crop: 'Barley' });
  });

  it('coalesces repeated offline edits into one call', async () => {
    const farm = await newFarm('srv-farm-1');
    const field = await newField(farm.local_id);
    await engine().flush(OWNER);
    calls = [];

    await updateFieldOffline(OWNER, field.local_id, { crop: 'Barley' });
    await updateFieldOffline(OWNER, field.local_id, { crop: 'Maize' });
    await updateFieldOffline(OWNER, field.local_id, { season: 'Kharif' });

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
    await engine().flush(OWNER);

    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ crop: 'Maize', season: 'Kharif' });
  });

  it('drops a create and its delete without touching the network', async () => {
    const farm = await newFarm('srv-farm-1');
    const field = await newField(farm.local_id);

    await deleteFieldOffline(OWNER, field.local_id);

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
    await engine().flush(OWNER);
    expect(calls).toHaveLength(0);
  });

  it('deletes a synced field on the server', async () => {
    const farm = await newFarm('srv-farm-1');
    const field = await newField(farm.local_id);
    await engine().flush(OWNER);
    calls = [];

    await deleteFieldOffline(OWNER, field.local_id);
    await engine().flush(OWNER);

    expect(calls[0].method).toBe('delete');
    expect(calls[0].url).toBe('/farms/srv-farm-1/fields/srv-field-1');
  });
});

describe('duplicate protection', () => {
  it('adopts a field the server already created instead of posting again', async () => {
    const farm = await newFarm('srv-farm-1');
    const field = await newField(farm.local_id);

    handler = () => ({ status: 500 });
    await engine().flush(OWNER);
    expect(calls).toHaveLength(1);

    calls = [];
    handler = call => {
      if (call.method === 'get') {
        return {
          status: 200,
          data: {
            data: {
              fields: [
                {
                  id: 'srv-field-existing',
                  name: 'North block',
                  area_acres: 4.5,
                  created_at: new Date().toISOString(),
                },
              ],
            },
          },
        };
      }
      return { status: 201, data: {} };
    };

    await syncQueue.resetStaleInFlight(OWNER);
    const entries = await syncQueue.listPending(OWNER);
    await syncQueue.markRetry(OWNER, entries[0].id, new Date(0).toISOString(), 'retry');

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls.filter(c => c.method === 'post')).toHaveLength(0);
    const stored = await fieldRepository.getByLocalId(OWNER, field.local_id);
    expect(stored?.server_id).toBe('srv-field-existing');
  });
});

describe('owner isolation', () => {
  it('keeps another user out of these fields', async () => {
    await upsertLocalUser({ id: 'other-user' });
    const farm = await newFarm('srv-farm-1');
    const field = await newField(farm.local_id);

    const other = asOwnerUserId('other-user');
    await expect(fieldRepository.getByLocalId(other, field.local_id)).resolves.toBeNull();
    await expect(fieldRepository.list(other)).resolves.toHaveLength(0);
    await expect(syncQueue.countPending(other)).resolves.toBe(0);
  });
});
