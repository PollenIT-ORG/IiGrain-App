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
import { farmRepository } from '../src/repositories';
import {
  createFarmOffline,
  createSyncEngine,
  farmAdapter,
  optimisticConnectivity,
  setSyncLogSink,
  syncQueue,
} from '../src/services/sync';
import { syncHttp } from '../src/services/sync/syncHttp';
import { handleApiError, isTimeoutError } from '../src/utils/handleApiError';
import { createFarmThunk } from '../src/redux/thunks/farmThunks';
import * as farmApi from '../src/api/FarmApi';

jest.mock('../src/api/FarmApi', () => ({
  ...jest.requireActual('../src/api/FarmApi'),
  createMyFarm: jest.fn(),
}));

const OWNER_ID = 'farmer-uncertain';
const OWNER = asOwnerUserId(OWNER_ID);

const authReducer = () => ({ user: { id: OWNER_ID } });
const makeStore = () => configureStore({ reducer: { auth: authReducer } });

const dispatch = (action: unknown) =>
  (makeStore().dispatch as unknown as (a: unknown) => Promise<{
    type: string;
    payload: unknown;
  }>)(action);

const timeoutError = (): AxiosError => {
  const error = new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED');
  error.request = {};
  return error;
};

const connectionLost = (): AxiosError => {
  const error = new AxiosError('Network Error', 'ERR_NETWORK');
  error.request = {};
  return error;
};

let calls: { url: string; method: string }[] = [];
let farmsOnServer: unknown[] = [];

const installAdapter = (): void => {
  syncHttp.defaults.adapter = async config => {
    const method = (config.method ?? '').toLowerCase();
    calls.push({ url: config.url ?? '', method });
    const data =
      method === 'get'
        ? { data: { farms: farmsOnServer } }
        : { data: { farm: { id: 'srv-new', updated_at: 'T1' } } };
    return {
      data,
      status: method === 'get' ? 200 : 201,
      statusText: 'ok',
      headers: new AxiosHeaders(),
      config,
    } as never;
  };
};

beforeEach(async () => {
  setSyncLogSink(() => {});
  calls = [];
  farmsOnServer = [];
  installAdapter();
  (farmApi.createMyFarm as jest.Mock).mockRejectedValue(timeoutError());
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

const engine = () =>
  createSyncEngine({
    connectivity: optimisticConnectivity,
    adapters: [farmAdapter],
  });

describe('classifying a timeout', () => {
  it('still reads as offline, which is why this guard exists', () => {
    expect(handleApiError(timeoutError()).kind).toBe('offline');
  });

  it('is told apart from a genuine loss of connection', () => {
    expect(isTimeoutError(timeoutError())).toBe(true);
    expect(isTimeoutError(connectionLost())).toBe(false);
  });

  it('does not mistake a real bug for a timeout', () => {
    expect(isTimeoutError(new TypeError('undefined is not a function'))).toBe(false);
    expect(handleApiError(new TypeError('boom')).kind).toBe('unknown');
  });
});

describe('a create whose outcome is unknown', () => {
  it('is marked so it verifies before sending', async () => {
    await dispatch(createFarmThunk({ name: 'Green Acres', areaAcres: 12 }));

    const [entry] = await syncQueue.listPending(OWNER);
    expect(JSON.parse(entry.payload_json ?? '{}')).toEqual({ verifyFirst: true });
  });

  it('adopts the farm the server already created instead of making a second one', async () => {
    await dispatch(createFarmThunk({ name: 'Green Acres', areaAcres: 12 }));
    farmsOnServer = [
      {
        id: 'srv-already-there',
        name: 'Green Acres',
        area_acres: 12,
        created_at: new Date().toISOString(),
      },
    ];

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls.filter(c => c.method === 'post')).toHaveLength(0);
    const [row] = await farmRepository.list(OWNER);
    expect(row.server_id).toBe('srv-already-there');
  });

  it('creates it normally when the server never received it', async () => {
    await dispatch(createFarmThunk({ name: 'Green Acres', areaAcres: 12 }));
    farmsOnServer = [];

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls.filter(c => c.method === 'post')).toHaveLength(1);
    const [row] = await farmRepository.list(OWNER);
    expect(row.server_id).toBe('srv-new');
  });
});

describe('a create made with no connection at all', () => {
  beforeEach(() => {
    (farmApi.createMyFarm as jest.Mock).mockRejectedValue(connectionLost());
  });

  it('is not marked uncertain, because the request never left the device', async () => {
    await dispatch(createFarmThunk({ name: 'Green Acres' }));

    const [entry] = await syncQueue.listPending(OWNER);
    expect(entry.payload_json).toBeNull();
  });

  it('posts straight away without a verification round trip', async () => {
    await dispatch(createFarmThunk({ name: 'Green Acres' }));

    await engine().flush(OWNER);

    expect(calls.filter(c => c.method === 'get')).toHaveLength(0);
    expect(calls.filter(c => c.method === 'post')).toHaveLength(1);
  });

  it('is unaffected by what happens to be on the server', async () => {
    await createFarmOffline(OWNER, { name: 'Green Acres' });
    farmsOnServer = [
      { id: 'unrelated', name: 'Green Acres', created_at: new Date().toISOString() },
    ];

    await engine().flush(OWNER);

    const [row] = await farmRepository.list(OWNER);
    expect(row.server_id).toBe('srv-new');
  });
});
