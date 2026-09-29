import { AxiosError, AxiosHeaders } from 'axios';
import { open } from '@op-engineering/op-sqlite';
import { configureStore } from '@reduxjs/toolkit';
import {
  DATABASE_NAME,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  initializeDatabase,
} from '../src/services/db';
import { upsertLocalUser } from '../src/repositories/userRepository';
import { farmRepository, fieldRepository } from '../src/repositories';
import { cacheFarmList, readCachedFarmList } from '../src/services/sync/farmCache';
import {
  createSyncEngine,
  farmAdapter,
  fieldAdapter,
  optimisticConnectivity,
  setSyncLogSink,
  syncQueue,
} from '../src/services/sync';
import { syncHttp } from '../src/services/sync/syncHttp';
import { createFarmThunk } from '../src/redux/thunks/farmThunks';
import { createFieldThunk } from '../src/redux/thunks/fieldThunks';
import * as farmApi from '../src/api/FarmApi';
import * as fieldApi from '../src/api/FieldApi';
import type { Farm } from '../src/types/farm';

jest.mock('../src/api/FarmApi', () => ({
  ...jest.requireActual('../src/api/FarmApi'),
  createMyFarm: jest.fn(),
}));

jest.mock('../src/api/FieldApi', () => ({
  ...jest.requireActual('../src/api/FieldApi'),
  createFarmField: jest.fn(),
}));

const OWNER_ID = 'farmer-create';
const OWNER = asOwnerUserId(OWNER_ID);

const authReducer = () => ({ user: { id: OWNER_ID } });

const makeStore = () => configureStore({ reducer: { auth: authReducer } });

const dispatch = (action: unknown) =>
  (makeStore().dispatch as unknown as (a: unknown) => Promise<{
    type: string;
    payload: unknown;
  }>)(action);

const offlineError = (): AxiosError => {
  const error = new AxiosError('Network Error', 'ERR_NETWORK');
  error.request = {};
  return error;
};

const seedFarm: Farm = {
  id: 'srv-farm-1',
  name: 'Green Acres',
  ownerName: 'Asha',
  location: 'Nashik',
  areaAcres: 12,
  fieldsCount: 0,
  status: 'active',
  lastUpdatedISO: '2026-09-01T00:00:00Z',
  soilType: '',
  regenScore: 0,
};

beforeEach(async () => {
  setSyncLogSink(() => {});
  (farmApi.createMyFarm as jest.Mock).mockRejectedValue(offlineError());
  (fieldApi.createFarmField as jest.Mock).mockRejectedValue(offlineError());
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

describe('creating a farm with no connection', () => {
  it('succeeds instead of failing at the user', async () => {
    const action = await dispatch(
      createFarmThunk({ name: 'Made offline', areaAcres: 8, location: 'Pune' }),
    );

    expect(createFarmThunk.fulfilled.match(action as never)).toBe(true);
    const farm = action.payload as Farm;
    expect(farm.name).toBe('Made offline');
    expect(farm.areaAcres).toBe(8);
  });

  it('stores it locally and queues it for sync', async () => {
    await dispatch(createFarmThunk({ name: 'Made offline' }));

    const rows = await farmRepository.list(OWNER);
    expect(rows.map(r => r.name)).toEqual(['Made offline']);
    expect(rows[0].server_id).toBeNull();
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('shows up straight away in the offline farm list', async () => {
    await dispatch(createFarmThunk({ name: 'Made offline' }));

    const cached = await readCachedFarmList(OWNER);
    expect(cached?.farms.map(f => f.name)).toEqual(['Made offline']);
  });

  it('survives a restart and then reaches the server', async () => {
    await dispatch(createFarmThunk({ name: 'Made offline', areaAcres: 8 }));

    await closeDatabase();
    await initializeDatabase();

    const calls: string[] = [];
    syncHttp.defaults.adapter = async config => {
      calls.push(config.url ?? '');
      return {
        data: { data: { farm: { id: 'srv-new', updated_at: 'T1' } } },
        status: 201,
        statusText: '201',
        headers: new AxiosHeaders(),
        config,
      } as never;
    };

    const result = await createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [farmAdapter, fieldAdapter],
    }).flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls).toEqual(['/farms/me/farms']);
    const [row] = await farmRepository.list(OWNER);
    expect(row.server_id).toBe('srv-new');
  });
});

describe('creating a field with no connection', () => {
  it('attaches it to a farm the user already had', async () => {
    await cacheFarmList(OWNER, [seedFarm]);

    const action = await dispatch(
      createFieldThunk({
        farmId: 'srv-farm-1',
        input: { name: 'North block', areaAcres: 4.5, crop: 'Wheat' },
      }),
    );

    expect(createFieldThunk.fulfilled.match(action as never)).toBe(true);
    const rows = await fieldRepository.list(OWNER);
    expect(rows.map(r => r.name)).toEqual(['North block']);
    expect(rows[0].server_id).toBeNull();
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('still fails cleanly for a farm this device has never seen', async () => {
    const action = await dispatch(
      createFieldThunk({ farmId: 'unknown-farm', input: { name: 'Nowhere' } }),
    );

    expect(createFieldThunk.rejected.match(action as never)).toBe(true);
    await expect(fieldRepository.list(OWNER)).resolves.toHaveLength(0);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
  });

  it('attaches to a farm that was itself made offline', async () => {
    await dispatch(createFarmThunk({ name: 'Made offline' }));
    const [farm] = await farmRepository.list(OWNER);

    const action = await dispatch(
      createFieldThunk({ farmId: farm.local_id, input: { name: 'North block' } }),
    );

    expect(createFieldThunk.fulfilled.match(action as never)).toBe(true);
    const rows = await fieldRepository.list(OWNER);
    expect(rows[0].farm_local_id).toBe(farm.local_id);
  });

  it('queues the field behind its farm so it is sent second', async () => {
    await dispatch(createFarmThunk({ name: 'Made offline' }));
    const [farm] = await farmRepository.list(OWNER);
    await dispatch(
      createFieldThunk({ farmId: farm.local_id, input: { name: 'North block' } }),
    );

    const pending = await syncQueue.listPending(OWNER);
    const farmEntry = pending.find(e => e.entity_type === 'farm');
    const fieldEntry = pending.find(e => e.entity_type === 'field');
    expect(fieldEntry?.depends_on_id).toBe(farmEntry?.id);
  });

  it('sends the whole chain with real ids once back online', async () => {
    await dispatch(createFarmThunk({ name: 'Made offline' }));
    const [farm] = await farmRepository.list(OWNER);
    await dispatch(
      createFieldThunk({ farmId: farm.local_id, input: { name: 'North block' } }),
    );

    const calls: string[] = [];
    syncHttp.defaults.adapter = async config => {
      calls.push(config.url ?? '');
      const body = config.url === '/farms/me/farms'
        ? { data: { farm: { id: 'srv-new-farm' } } }
        : { data: { field: { id: 'srv-new-field' } } };
      return {
        data: body,
        status: 201,
        statusText: '201',
        headers: new AxiosHeaders(),
        config,
      } as never;
    };

    const result = await createSyncEngine({
      connectivity: optimisticConnectivity,
      adapters: [farmAdapter, fieldAdapter],
    }).flush(OWNER);

    expect(result.succeeded).toBe(2);
    expect(calls).toEqual(['/farms/me/farms', '/farms/srv-new-farm/fields']);
    const [field] = await fieldRepository.list(OWNER);
    expect(field.server_id).toBe('srv-new-field');
  });
});
