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
import { getBoundary } from '../src/repositories/fieldBoundaryRepository';
import { getSoil } from '../src/repositories/fieldSoilRepository';
import {
  createFarmOffline,
  createFieldOffline,
  createSyncEngine,
  farmAdapter,
  fieldAdapter,
  fieldBoundaryAdapter,
  fieldSoilAdapter,
  optimisticConnectivity,
  removeBoundaryOffline,
  saveBoundaryOffline,
  saveSoilOffline,
  setSyncLogSink,
  syncQueue,
} from '../src/services/sync';
import { syncHttp } from '../src/services/sync/syncHttp';

const OWNER_ID = 'farmer-geo';
const OWNER = asOwnerUserId(OWNER_ID);

interface Call {
  url: string;
  method: string;
  body: Record<string, unknown>;
}

let calls: Call[] = [];
let status = 200;

const installAdapter = (): void => {
  syncHttp.defaults.adapter = async config => {
    const call: Call = {
      url: config.url ?? '',
      method: (config.method ?? '').toLowerCase(),
      body:
        typeof config.data === 'string'
          ? (JSON.parse(config.data) as Record<string, unknown>)
          : ((config.data ?? {}) as Record<string, unknown>),
    };
    calls.push(call);
    const response = {
      data: { data: { farm: { id: 'srv-farm' }, field: { id: 'srv-field' } } },
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
};

const engine = () =>
  createSyncEngine({
    connectivity: optimisticConnectivity,
    adapters: [farmAdapter, fieldAdapter, fieldBoundaryAdapter, fieldSoilAdapter],
  });

const RING = [
  { latitude: 12.1, longitude: 77.1 },
  { latitude: 12.2, longitude: 77.1 },
  { latitude: 12.2, longitude: 77.2 },
];

const syncedField = async () => {
  const farm = await farmRepository.create(OWNER, {
    name: 'Green Acres',
    server_id: 'srv-farm',
  });
  const field = await fieldRepository.create(OWNER, {
    farm_local_id: farm.local_id,
    name: 'North block',
    server_id: 'srv-field',
  });
  return { farm, field };
};

const offlineField = async () => {
  const farm = await createFarmOffline(OWNER, { name: 'Green Acres' });
  const field = await createFieldOffline(OWNER, farm.local_id, {
    name: 'North block',
  });
  return { farm, field };
};

beforeEach(async () => {
  setSyncLogSink(() => {});
  calls = [];
  status = 200;
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

describe('boundaries offline', () => {
  it('saves locally and queues without a network call', async () => {
    const { farm, field } = await syncedField();

    const boundary = await saveBoundaryOffline(OWNER, {
      fieldLocalId: field.local_id,
      farmLocalId: farm.local_id,
      ring: RING,
      areaSqM: 1200,
    });

    expect(boundary.sync_state).toBe('local');
    expect(calls).toHaveLength(0);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('puts the polygon to the real farm and field ids', async () => {
    const { farm, field } = await syncedField();
    await saveBoundaryOffline(OWNER, {
      fieldLocalId: field.local_id,
      farmLocalId: farm.local_id,
      ring: RING,
    });

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls[0].method).toBe('put');
    expect(calls[0].url).toBe('/farms/srv-farm/fields/srv-field/boundary');
    expect(calls[0].body.boundary).toMatchObject({ type: 'Polygon' });

    const stored = await getBoundary(OWNER, field.local_id);
    expect(stored?.sync_state).toBe('synced');
  });

  it('collapses repeated redraws into a single put', async () => {
    const { farm, field } = await syncedField();
    const draw = (offset: number) =>
      saveBoundaryOffline(OWNER, {
        fieldLocalId: field.local_id,
        farmLocalId: farm.local_id,
        ring: RING.map(p => ({ ...p, latitude: p.latitude + offset })),
      });

    await draw(0);
    await draw(0.01);
    await draw(0.02);

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
    await engine().flush(OWNER);
    expect(calls).toHaveLength(1);
  });

  it('waits for the field to exist on the server', async () => {
    const { farm, field } = await offlineField();
    await saveBoundaryOffline(OWNER, {
      fieldLocalId: field.local_id,
      farmLocalId: farm.local_id,
      ring: RING,
    });

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(3);
    expect(calls.map(c => c.url)).toEqual([
      '/farms/me/farms',
      '/farms/srv-farm/fields',
      '/farms/srv-farm/fields/srv-field/boundary',
    ]);
  });

  it('clears the boundary on the server when removed', async () => {
    const { farm, field } = await syncedField();
    await saveBoundaryOffline(OWNER, {
      fieldLocalId: field.local_id,
      farmLocalId: farm.local_id,
      ring: RING,
    });
    await engine().flush(OWNER);
    calls = [];

    await removeBoundaryOffline(OWNER, field.local_id);
    await engine().flush(OWNER);

    expect(calls[0].method).toBe('put');
    expect(calls[0].body.boundary).toBeNull();
  });

  it('keeps the drawing when the upload fails', async () => {
    const { farm, field } = await syncedField();
    await saveBoundaryOffline(OWNER, {
      fieldLocalId: field.local_id,
      farmLocalId: farm.local_id,
      ring: RING,
    });
    status = 500;

    await engine().flush(OWNER);

    const stored = await getBoundary(OWNER, field.local_id);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored?.ring_json ?? '[]')).toHaveLength(3);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });
});

describe('soil offline', () => {
  it('saves locally and queues without a network call', async () => {
    const { field } = await syncedField();

    const soil = await saveSoilOffline(OWNER, field.local_id, {
      ph: 6.4,
      nitrogen: 12,
      notes: 'Tested after rain',
    });

    expect(soil.sync_state).toBe('local');
    expect(calls).toHaveLength(0);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('puts to the field soil endpoint with the stored values', async () => {
    const { field } = await syncedField();
    await saveSoilOffline(OWNER, field.local_id, {
      ph: 6.4,
      nitrogen: 12,
      notes: 'Tested after rain',
    });

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls[0].method).toBe('put');
    expect(calls[0].url).toBe('/fields/srv-field/soil');
    expect(calls[0].body).toMatchObject({
      ph: 6.4,
      nitrogen: 12,
      notes: 'Tested after rain',
    });

    const stored = await getSoil(OWNER, field.local_id);
    expect(stored?.sync_state).toBe('synced');
  });

  it('sends only the last edit when edited repeatedly offline', async () => {
    const { field } = await syncedField();
    await saveSoilOffline(OWNER, field.local_id, { ph: 6.0 });
    await saveSoilOffline(OWNER, field.local_id, { ph: 6.5 });
    await saveSoilOffline(OWNER, field.local_id, { ph: 7.1 });

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
    await engine().flush(OWNER);

    expect(calls).toHaveLength(1);
    expect(calls[0].body.ph).toBe(7.1);
  });

  it('waits for the field to exist on the server', async () => {
    const { field } = await offlineField();
    await saveSoilOffline(OWNER, field.local_id, { ph: 6.4 });

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(3);
    expect(calls[calls.length - 1].url).toBe('/fields/srv-field/soil');
  });

  it('keeps the readings when the upload fails', async () => {
    const { field } = await syncedField();
    await saveSoilOffline(OWNER, field.local_id, { ph: 6.4 });
    status = 500;

    await engine().flush(OWNER);

    const stored = await getSoil(OWNER, field.local_id);
    expect(stored?.ph).toBe(6.4);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });
});

describe('owner isolation', () => {
  it('hides boundaries and soil from another user', async () => {
    await upsertLocalUser({ id: 'other-user' });
    const { farm, field } = await syncedField();
    await saveBoundaryOffline(OWNER, {
      fieldLocalId: field.local_id,
      farmLocalId: farm.local_id,
      ring: RING,
    });
    await saveSoilOffline(OWNER, field.local_id, { ph: 6.4 });

    const other = asOwnerUserId('other-user');
    await expect(getBoundary(other, field.local_id)).resolves.toBeNull();
    await expect(getSoil(other, field.local_id)).resolves.toBeNull();
    await expect(syncQueue.countPending(other)).resolves.toBe(0);
  });
});
