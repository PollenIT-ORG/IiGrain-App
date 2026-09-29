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
import { farmRepository, fieldRepository, monitoringRepository } from '../src/repositories';
import {
  cacheMonitoringRecords,
  readCachedMonitoringRecord,
  readCachedMonitoringRecords,
} from '../src/services/sync/monitoringCache';
import { setSyncLogSink, syncQueue } from '../src/services/sync';
import {
  createRecordThunk,
  fetchModuleRecordsThunk,
  updateRecordThunk,
} from '../src/redux/thunks/monitoringThunks';
import * as api from '../src/api/fieldMonitoringApi';
import type { MonitoringRecord } from '../src/types/monitoring';

jest.mock('../src/api/fieldMonitoringApi', () => ({
  ...jest.requireActual('../src/api/fieldMonitoringApi'),
  getRecords: jest.fn(),
  createRecord: jest.fn(),
  updateRecord: jest.fn(),
}));

const OWNER_ID = 'farmer-monitor';
const OWNER = asOwnerUserId(OWNER_ID);
const MODULE = 'soil_samples';

const context = {
  fieldId: 'srv-field-1',
  fieldName: 'North block',
  farmId: 'srv-farm-1',
  farmName: 'Green Acres',
  programId: 'p1',
  programName: 'Program',
};

const authReducer = () => ({ user: { id: OWNER_ID } });
const monitoringReducer = () => ({ context });

const makeStore = () =>
  configureStore({ reducer: { auth: authReducer, monitoring: monitoringReducer } });

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

const serverRecord = (over: Partial<MonitoringRecord> = {}): MonitoringRecord => ({
  id: 'srv-record-1',
  status: 'completed',
  notes: 'Sampled at dawn',
  documentCount: 0,
  createdAtISO: '2026-09-01T00:00:00Z',
  updatedAtISO: '2026-09-01T00:00:00Z',
  values: { depth_cm: 30 },
  ...over,
});

const seedField = async (): Promise<void> => {
  const farm = await farmRepository.create(OWNER, {
    name: 'Green Acres',
    server_id: 'srv-farm-1',
  });
  await fieldRepository.create(OWNER, {
    farm_local_id: farm.local_id,
    name: 'North block',
    server_id: 'srv-field-1',
  });
};

beforeEach(async () => {
  setSyncLogSink(() => {});
  (api.getRecords as jest.Mock).mockRejectedValue(offlineError());
  (api.createRecord as jest.Mock).mockRejectedValue(offlineError());
  (api.updateRecord as jest.Mock).mockRejectedValue(offlineError());
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
  await upsertLocalUser({ id: OWNER_ID });
  await seedField();
});

afterAll(async () => {
  setSyncLogSink(null);
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

describe('saving a monitoring record offline', () => {
  it('succeeds instead of failing at the user', async () => {
    const action = await dispatch(
      createRecordThunk({
        fieldId: 'srv-field-1',
        module: MODULE,
        payload: { status: 'completed', notes: 'Sampled at dawn', values: { depth_cm: 30 } },
      }),
    );

    expect(createRecordThunk.fulfilled.match(action as never)).toBe(true);
    const record = action.payload as MonitoringRecord;
    expect(record.notes).toBe('Sampled at dawn');
    expect(record.values).toEqual({ depth_cm: 30 });
  });

  it('stores it locally and queues it', async () => {
    await dispatch(
      createRecordThunk({
        fieldId: 'srv-field-1',
        module: MODULE,
        payload: { status: 'in_progress', notes: null, values: { depth_cm: 12 } },
      }),
    );

    const rows = await monitoringRepository.list(OWNER);
    expect(rows).toHaveLength(1);
    expect(rows[0].server_id).toBeNull();
    expect(rows[0].module).toBe(MODULE);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('shows up straight away in the offline record list', async () => {
    await dispatch(
      createRecordThunk({
        fieldId: 'srv-field-1',
        module: MODULE,
        payload: { status: 'completed', notes: 'Mine', values: {} },
      }),
    );

    const cached = await readCachedMonitoringRecords(OWNER, 'srv-field-1', MODULE);
    expect(cached?.map(r => r.notes)).toEqual(['Mine']);
  });

  it('survives a restart', async () => {
    await dispatch(
      createRecordThunk({
        fieldId: 'srv-field-1',
        module: MODULE,
        payload: { status: 'completed', notes: 'Mine', values: {} },
      }),
    );

    await closeDatabase();
    await initializeDatabase();

    await expect(
      readCachedMonitoringRecords(OWNER, 'srv-field-1', MODULE),
    ).resolves.toHaveLength(1);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('refuses cleanly for a field this device has never seen', async () => {
    const action = await dispatch(
      createRecordThunk({
        fieldId: 'unknown-field',
        module: MODULE,
        payload: { status: 'completed', notes: null, values: {} },
      }),
    );

    expect(createRecordThunk.rejected.match(action as never)).toBe(true);
    await expect(monitoringRepository.list(OWNER)).resolves.toHaveLength(0);
  });
});

describe('editing a monitoring record offline', () => {
  const seedRecord = async (): Promise<string> => {
    await cacheMonitoringRecords(OWNER, 'srv-field-1', MODULE, [serverRecord()]);
    return 'srv-record-1';
  };

  it('keeps the edit locally and queues it', async () => {
    const recordId = await seedRecord();

    const action = await dispatch(
      updateRecordThunk({
        fieldId: 'srv-field-1',
        module: MODULE,
        recordId,
        patch: { notes: 'Edited offline', values: { depth_cm: 45 } },
      }),
    );

    expect(updateRecordThunk.fulfilled.match(action as never)).toBe(true);
    const stored = await readCachedMonitoringRecord(OWNER, recordId);
    expect(stored?.notes).toBe('Edited offline');
    expect(stored?.values).toEqual({ depth_cm: 45 });
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('collapses repeated edits into one queued change', async () => {
    const recordId = await seedRecord();
    const edit = (notes: string) =>
      dispatch(
        updateRecordThunk({
          fieldId: 'srv-field-1',
          module: MODULE,
          recordId,
          patch: { notes },
        }),
      );

    await edit('one');
    await edit('two');
    await edit('three');

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
    const stored = await readCachedMonitoringRecord(OWNER, recordId);
    expect(stored?.notes).toBe('three');
  });
});

describe('reading records offline', () => {
  it('serves the records the user saw online', async () => {
    await cacheMonitoringRecords(OWNER, 'srv-field-1', MODULE, [
      serverRecord(),
      serverRecord({ id: 'srv-record-2', notes: 'Second' }),
    ]);

    const action = await dispatch(
      fetchModuleRecordsThunk({ fieldId: 'srv-field-1', module: MODULE }),
    );

    expect(fetchModuleRecordsThunk.fulfilled.match(action as never)).toBe(true);
    const payload = action.payload as { records: MonitoringRecord[] };
    expect(payload.records).toHaveLength(2);
  });

  it('fails rather than showing an empty list when nothing was cached', async () => {
    const action = await dispatch(
      fetchModuleRecordsThunk({ fieldId: 'srv-field-1', module: MODULE }),
    );

    expect(fetchModuleRecordsThunk.rejected.match(action as never)).toBe(true);
  });

  it('does not let a server read overwrite an offline edit', async () => {
    await cacheMonitoringRecords(OWNER, 'srv-field-1', MODULE, [serverRecord()]);
    await dispatch(
      updateRecordThunk({
        fieldId: 'srv-field-1',
        module: MODULE,
        recordId: 'srv-record-1',
        patch: { notes: 'Mine wins' },
      }),
    );

    await cacheMonitoringRecords(OWNER, 'srv-field-1', MODULE, [
      serverRecord({ notes: 'Server version' }),
    ]);

    const stored = await readCachedMonitoringRecord(OWNER, 'srv-record-1');
    expect(stored?.notes).toBe('Mine wins');
  });

  it('keeps records out of another user reach', async () => {
    await upsertLocalUser({ id: 'other-user' });
    await cacheMonitoringRecords(OWNER, 'srv-field-1', MODULE, [serverRecord()]);

    await expect(
      readCachedMonitoringRecords(asOwnerUserId('other-user'), 'srv-field-1', MODULE),
    ).resolves.toBeNull();
  });
});
