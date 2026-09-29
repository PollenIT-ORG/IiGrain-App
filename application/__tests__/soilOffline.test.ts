import { AxiosError } from 'axios';
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
import { getSoil } from '../src/repositories/fieldSoilRepository';
import { cacheFieldSoil, readCachedFieldSoil } from '../src/services/sync/farmCache';
import { setSyncLogSink, syncQueue } from '../src/services/sync';
import {
  fetchFieldSoilRecordThunk,
  saveFieldSoilThunk,
} from '../src/redux/slices/soilSlice';
import * as soilApi from '../src/api/soilApi';
import type { SoilRecord } from '../src/types/fieldDetails';

jest.mock('../src/api/soilApi', () => ({
  ...jest.requireActual('../src/api/soilApi'),
  getFieldSoilRecord: jest.fn(),
  saveFieldSoil: jest.fn(),
}));

const OWNER_ID = 'farmer-soil';
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

const serverSoil: SoilRecord = {
  ph: 6.2,
  organicMatter: 3.1,
  nitrogen: 12,
  phosphorus: 8,
  potassium: 20,
  moisture: 18,
  texture: 'Loam',
  notes: 'From the lab',
  testedOnISO: '2026-08-01',
};

let localFieldId = '';

beforeEach(async () => {
  setSyncLogSink(() => {});
  (soilApi.getFieldSoilRecord as jest.Mock).mockRejectedValue(offlineError());
  (soilApi.saveFieldSoil as jest.Mock).mockRejectedValue(offlineError());
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
  await upsertLocalUser({ id: OWNER_ID });

  const farm = await farmRepository.create(OWNER, {
    name: 'Green Acres',
    server_id: 'srv-farm-1',
  });
  const field = await fieldRepository.create(OWNER, {
    farm_local_id: farm.local_id,
    name: 'North block',
    server_id: 'srv-field-1',
  });
  localFieldId = field.local_id;
});

afterAll(async () => {
  setSyncLogSink(null);
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

describe('saving soil readings offline', () => {
  it('succeeds instead of failing at the user', async () => {
    const action = await dispatch(
      saveFieldSoilThunk({
        fieldId: 'srv-field-1',
        input: { ph: 6.8, nitrogen: 15, notes: 'Tested after rain' },
      }),
    );

    expect(saveFieldSoilThunk.fulfilled.match(action as never)).toBe(true);
    const payload = action.payload as { record: SoilRecord };
    expect(payload.record.ph).toBe(6.8);
    expect(payload.record.notes).toBe('Tested after rain');
  });

  it('stores the readings and queues them', async () => {
    await dispatch(
      saveFieldSoilThunk({ fieldId: 'srv-field-1', input: { ph: 6.8 } }),
    );

    const row = await getSoil(OWNER, localFieldId);
    expect(row?.ph).toBe(6.8);
    expect(row?.sync_state).toBe('local');
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('collapses repeated edits into one queued change', async () => {
    await dispatch(saveFieldSoilThunk({ fieldId: 'srv-field-1', input: { ph: 6.0 } }));
    await dispatch(saveFieldSoilThunk({ fieldId: 'srv-field-1', input: { ph: 6.5 } }));
    await dispatch(saveFieldSoilThunk({ fieldId: 'srv-field-1', input: { ph: 7.2 } }));

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
    const row = await getSoil(OWNER, localFieldId);
    expect(row?.ph).toBe(7.2);
  });

  it('survives a restart', async () => {
    await dispatch(saveFieldSoilThunk({ fieldId: 'srv-field-1', input: { ph: 6.8 } }));

    await closeDatabase();
    await initializeDatabase();

    const cached = await readCachedFieldSoil(OWNER, 'srv-field-1');
    expect(cached?.record.ph).toBe(6.8);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('refuses cleanly for a field this device has never seen', async () => {
    const action = await dispatch(
      saveFieldSoilThunk({ fieldId: 'unknown-field', input: { ph: 6.8 } }),
    );

    expect(saveFieldSoilThunk.rejected.match(action as never)).toBe(true);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
  });
});

describe('reading soil offline', () => {
  it('serves what the user saw online', async () => {
    await cacheFieldSoil(OWNER, 'srv-field-1', serverSoil, false);

    const action = await dispatch(fetchFieldSoilRecordThunk('srv-field-1'));

    expect(fetchFieldSoilRecordThunk.fulfilled.match(action as never)).toBe(true);
    const payload = action.payload as { record: SoilRecord; locked: boolean };
    expect(payload.record.ph).toBe(6.2);
    expect(payload.record.texture).toBe('Loam');
    expect(payload.locked).toBe(false);
  });

  it('remembers a locked record', async () => {
    await cacheFieldSoil(OWNER, 'srv-field-1', serverSoil, true);

    const cached = await readCachedFieldSoil(OWNER, 'srv-field-1');
    expect(cached?.locked).toBe(true);
  });

  it('fails rather than showing blank readings when nothing was cached', async () => {
    const action = await dispatch(fetchFieldSoilRecordThunk('srv-field-1'));

    expect(fetchFieldSoilRecordThunk.rejected.match(action as never)).toBe(true);
  });

  it('does not let a server read overwrite an offline edit', async () => {
    await cacheFieldSoil(OWNER, 'srv-field-1', serverSoil, false);
    await dispatch(
      saveFieldSoilThunk({ fieldId: 'srv-field-1', input: { ph: 9.9, notes: 'Mine' } }),
    );

    await cacheFieldSoil(OWNER, 'srv-field-1', serverSoil, false);

    const row = await getSoil(OWNER, localFieldId);
    expect(row?.ph).toBe(9.9);
    expect(row?.notes).toBe('Mine');
  });

  it('keeps soil out of another user reach', async () => {
    await upsertLocalUser({ id: 'other-user' });
    await cacheFieldSoil(OWNER, 'srv-field-1', serverSoil, false);

    await expect(
      readCachedFieldSoil(asOwnerUserId('other-user'), 'srv-field-1'),
    ).resolves.toBeNull();
  });
});
