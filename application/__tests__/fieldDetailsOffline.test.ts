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
import {
  cacheFieldDocuments,
  readCachedFieldDocuments,
} from '../src/services/sync/documentCache';
import { setSyncLogSink } from '../src/services/sync';
import {
  fetchFieldActivityThunk,
  fetchFieldDocumentsThunk,
  fetchFieldOverviewThunk,
} from '../src/redux/thunks/fieldDetailsThunks';
import * as fieldDetailsApi from '../src/api/fieldDetailsApi';
import type { ActivityEntry } from '../src/types/farm';
import type { FieldDocument, FieldOverview } from '../src/types/fieldDetails';

jest.mock('../src/api/fieldDetailsApi', () => ({
  ...jest.requireActual('../src/api/fieldDetailsApi'),
  getFieldOverview: jest.fn(),
  getFieldActivity: jest.fn(),
  getFieldDocuments: jest.fn(),
}));

const OWNER_ID = 'farmer-details';
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

const docs: FieldDocument[] = [
  {
    id: 'srv-doc-1',
    name: 'Soil report.pdf',
    url: 'https://cdn.example.com/soil.pdf',
    kind: 'pdf',
    icon: 'file-pdf-box',
    sizeLabel: '2.1 MB',
    uploadedAtISO: '2026-09-01T00:00:00Z',
  },
  {
    id: 'srv-doc-2',
    name: 'Field photo.jpg',
    url: 'https://cdn.example.com/photo.jpg',
    kind: 'image',
    icon: 'image-outline',
    sizeLabel: '820 KB',
    uploadedAtISO: '2026-09-02T00:00:00Z',
  },
];

const overview = {
  id: 'srv-field-1',
  name: 'North block',
} as unknown as FieldOverview;

const activity: ActivityEntry[] = [
  {
    id: 'a1',
    title: 'Assessment submitted',
    description: 'Soil health',
    dateISO: '2026-09-01T00:00:00Z',
  } as ActivityEntry,
];

beforeEach(async () => {
  setSyncLogSink(() => {});
  (fieldDetailsApi.getFieldOverview as jest.Mock).mockRejectedValue(offlineError());
  (fieldDetailsApi.getFieldActivity as jest.Mock).mockRejectedValue(offlineError());
  (fieldDetailsApi.getFieldDocuments as jest.Mock).mockRejectedValue(offlineError());
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
  await upsertLocalUser({ id: OWNER_ID });

  const farm = await farmRepository.create(OWNER, {
    name: 'Green Acres',
    server_id: 'srv-farm-1',
  });
  await fieldRepository.create(OWNER, {
    farm_local_id: farm.local_id,
    name: 'North block',
    server_id: 'srv-field-1',
  });
});

afterAll(async () => {
  setSyncLogSink(null);
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

describe('field documents offline', () => {
  it('lists the documents the user saw online', async () => {
    await cacheFieldDocuments(OWNER, 'srv-field-1', docs);

    const action = await dispatch(fetchFieldDocumentsThunk('srv-field-1'));

    expect(fetchFieldDocumentsThunk.fulfilled.match(action as never)).toBe(true);
    const payload = action.payload as FieldDocument[];
    expect(payload.map(d => d.name).sort()).toEqual([
      'Field photo.jpg',
      'Soil report.pdf',
    ]);
  });

  it('keeps the url so an already-downloaded file can still be opened', async () => {
    await cacheFieldDocuments(OWNER, 'srv-field-1', docs);

    const cached = await readCachedFieldDocuments(OWNER, 'srv-field-1');
    const pdf = cached?.find(d => d.name === 'Soil report.pdf');
    expect(pdf?.url).toBe('https://cdn.example.com/soil.pdf');
    expect(pdf?.kind).toBe('pdf');
  });

  it('caches on a successful online read', async () => {
    (fieldDetailsApi.getFieldDocuments as jest.Mock).mockResolvedValueOnce(docs);

    await dispatch(fetchFieldDocumentsThunk('srv-field-1'));

    await expect(readCachedFieldDocuments(OWNER, 'srv-field-1')).resolves.toHaveLength(2);
  });

  it('refreshes rather than duplicating when seen again', async () => {
    await cacheFieldDocuments(OWNER, 'srv-field-1', docs);
    await cacheFieldDocuments(OWNER, 'srv-field-1', [
      { ...docs[0], name: 'Soil report v2.pdf' },
    ]);

    const cached = await readCachedFieldDocuments(OWNER, 'srv-field-1');
    expect(cached).toHaveLength(2);
    expect(cached?.some(d => d.name === 'Soil report v2.pdf')).toBe(true);
  });

  it('survives a restart', async () => {
    await cacheFieldDocuments(OWNER, 'srv-field-1', docs);

    await closeDatabase();
    await initializeDatabase();

    await expect(readCachedFieldDocuments(OWNER, 'srv-field-1')).resolves.toHaveLength(2);
  });

  it('fails rather than showing an empty list when nothing was cached', async () => {
    const action = await dispatch(fetchFieldDocumentsThunk('srv-field-1'));

    expect(fetchFieldDocumentsThunk.rejected.match(action as never)).toBe(true);
  });

  it('ignores documents for a field this device has never seen', async () => {
    await cacheFieldDocuments(OWNER, 'unknown-field', docs);

    await expect(readCachedFieldDocuments(OWNER, 'unknown-field')).resolves.toBeNull();
  });

  it('never leaks documents to another user', async () => {
    await upsertLocalUser({ id: 'other-user' });
    await cacheFieldDocuments(OWNER, 'srv-field-1', docs);

    await expect(
      readCachedFieldDocuments(asOwnerUserId('other-user'), 'srv-field-1'),
    ).resolves.toBeNull();
  });
});

describe('field overview and activity offline', () => {
  it('serves the overview the user saw online', async () => {
    (fieldDetailsApi.getFieldOverview as jest.Mock).mockResolvedValueOnce(overview);
    await dispatch(fetchFieldOverviewThunk('srv-field-1'));

    (fieldDetailsApi.getFieldOverview as jest.Mock).mockRejectedValue(offlineError());
    const action = await dispatch(fetchFieldOverviewThunk('srv-field-1'));

    expect(fetchFieldOverviewThunk.fulfilled.match(action as never)).toBe(true);
    expect((action.payload as FieldOverview).name).toBe('North block');
  });

  it('serves the activity feed the user saw online', async () => {
    (fieldDetailsApi.getFieldActivity as jest.Mock).mockResolvedValueOnce(activity);
    await dispatch(fetchFieldActivityThunk('srv-field-1'));

    (fieldDetailsApi.getFieldActivity as jest.Mock).mockRejectedValue(offlineError());
    const action = await dispatch(fetchFieldActivityThunk('srv-field-1'));

    expect(fetchFieldActivityThunk.fulfilled.match(action as never)).toBe(true);
    expect((action.payload as ActivityEntry[])[0].title).toBe('Assessment submitted');
  });

  it('keeps each field overview separate', async () => {
    (fieldDetailsApi.getFieldOverview as jest.Mock).mockResolvedValueOnce(overview);
    await dispatch(fetchFieldOverviewThunk('srv-field-1'));

    (fieldDetailsApi.getFieldOverview as jest.Mock).mockRejectedValue(offlineError());
    const action = await dispatch(fetchFieldOverviewThunk('srv-field-2'));

    expect(fetchFieldOverviewThunk.rejected.match(action as never)).toBe(true);
  });

  it('fails when the field was never opened online', async () => {
    const action = await dispatch(fetchFieldOverviewThunk('never-seen'));

    expect(fetchFieldOverviewThunk.rejected.match(action as never)).toBe(true);
  });
});
