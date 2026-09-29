import { AxiosError, AxiosHeaders } from 'axios';
import RNFS from 'react-native-fs';
import { open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  getDatabase,
  initializeDatabase,
} from '../src/services/db';
import { upsertLocalUser } from '../src/repositories/userRepository';
import { getMedia, listPendingUploads } from '../src/repositories/mediaRepository';
import {
  MEDIA_DRAFT_TYPE,
  MEDIA_ENTITY_TYPE,
  captureMedia,
  commitMedia,
  createSyncEngine,
  discardMedia,
  listDraftMedia,
  listUnsentMediaFor,
  mediaAdapter,
  optimisticConnectivity,
  outboxDirFor,
  purgeAbandonedDrafts,
  reconcileMediaFiles,
  setSyncLogSink,
  syncQueue,
} from '../src/services/sync';
import { syncHttp } from '../src/services/sync/syncHttp';

const OWNER_ID = 'farmer-media';
const OWNER = asOwnerUserId(OWNER_ID);

interface Call {
  url: string;
  method: string;
}

type Responder = () => { status: number; data?: unknown };

const CREATED: Responder = () => ({
  status: 201,
  data: {
    data: {
      document: {
        id: 'srv-doc-1',
        url: 'https://cdn.example.com/a.jpg',
        uploaded_at: '2026-09-10T00:00:00Z',
      },
    },
  },
});

let calls: Call[] = [];
let respond: Responder = CREATED;

const installAdapter = (): void => {
  syncHttp.defaults.adapter = async config => {
    calls.push({ url: config.url ?? '', method: (config.method ?? '').toLowerCase() });
    const outcome = respond();
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

const fsFiles = (RNFS as unknown as { __files: Set<string> }).__files;

const capture = () =>
  captureMedia(OWNER, {
    purpose: 'monitoring_document',
    file: {
      uri: 'file:///tmp/picker-cache/IMG_1234.jpg',
      name: 'IMG_1234.jpg',
      mime: 'image/jpeg',
      size: 2048,
    },
    attachedToType: 'monitoring_record',
    attachedToLocalId: 'record-local-1',
    context: { fieldId: 'srv-field-1', module: 'soil_samples', kind: 'photo' },
  });

const DRAFT_SCOPE = 'srv-field-1:soil_samples:new';

const captureDraft = (name = 'IMG_1234.jpg') =>
  captureMedia(OWNER, {
    purpose: 'monitoring_document',
    file: {
      uri: `file:///tmp/picker-cache/${name}`,
      name,
      mime: 'image/jpeg',
      size: 2048,
    },
    attachedToType: MEDIA_DRAFT_TYPE,
    attachedToLocalId: DRAFT_SCOPE,
    context: { fieldId: 'srv-field-1', module: 'soil_samples', kind: 'photo' },
    draft: true,
  });

const engine = () =>
  createSyncEngine({
    connectivity: optimisticConnectivity,
    adapters: [mediaAdapter],
  });

beforeEach(async () => {
  setSyncLogSink(() => {});
  calls = [];
  respond = CREATED;
  fsFiles.clear();
  (RNFS.copyFile as jest.Mock).mockReset();
  (RNFS.copyFile as jest.Mock).mockImplementation((_from: string, to: string) => {
    fsFiles.add(to);
    return Promise.resolve();
  });
  (RNFS.exists as jest.Mock).mockReset();
  (RNFS.exists as jest.Mock).mockImplementation((path: string) =>
    Promise.resolve(fsFiles.has(path)),
  );
  (RNFS.mkdir as jest.Mock).mockReset();
  (RNFS.mkdir as jest.Mock).mockResolvedValue(undefined);
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

describe('durable capture', () => {
  it('copies the picked file out of the picker cache into the outbox', async () => {
    const media = await capture();

    expect(media.file_path.startsWith(outboxDirFor(OWNER_ID))).toBe(true);
    expect(media.file_path).not.toContain('picker-cache');
    expect(RNFS.copyFile).toHaveBeenCalled();
    await expect(RNFS.exists(media.file_path)).resolves.toBe(true);
  });

  it('records metadata rather than the binary', async () => {
    const media = await capture();

    expect(media.file_name).toBe('IMG_1234.jpg');
    expect(media.mime).toBe('image/jpeg');
    expect(media.size_bytes).toBe(2048);
    expect(media.upload_status).toBe('local');
    expect(media.owner_user_id).toBe(OWNER_ID);
  });

  it('stores the upload context needed later', async () => {
    const media = await capture();
    expect(JSON.parse(media.context_json ?? '{}')).toEqual({
      fieldId: 'srv-field-1',
      module: 'soil_samples',
      kind: 'photo',
    });
  });

  it('queues a durable sync entry', async () => {
    await capture();

    const pending = await syncQueue.listPending(OWNER);
    expect(pending).toHaveLength(1);
    expect(pending[0].entity_type).toBe(MEDIA_ENTITY_TYPE);
    expect(calls).toHaveLength(0);
  });

  it('survives an app restart', async () => {
    const media = await capture();

    await closeDatabase();
    await initializeDatabase();

    const stored = await getMedia(OWNER, media.local_id);
    expect(stored?.file_path).toBe(media.file_path);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
    await expect(listPendingUploads(OWNER)).resolves.toHaveLength(1);
  });

  it('rolls back when the file cannot be stored', async () => {
    (RNFS.copyFile as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

    await expect(capture()).rejects.toThrow(/disk full/);

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
    const rows = await getDatabase().execute('SELECT COUNT(*) AS c FROM media_files');
    expect(Number(rows.rows[0].c)).toBe(0);
  });
});

describe('upload', () => {
  it('uploads to the monitoring document endpoint and records the url', async () => {
    const media = await capture();

    const result = await engine().flush(OWNER);
    expect(result.succeeded).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('post');
    expect(calls[0].url).toContain('/field-monitoring/fields/srv-field-1/documents');

    const stored = await getMedia(OWNER, media.local_id);
    expect(stored?.upload_status).toBe('uploaded');
    expect(stored?.remote_url).toBe('https://cdn.example.com/a.jpg');
    await expect(listPendingUploads(OWNER)).resolves.toHaveLength(0);
  });

  it('keeps the file and stays retryable when the upload fails', async () => {
    const media = await capture();
    respond = () => ({ status: 500 });

    const result = await engine().flush(OWNER);
    expect(result.retried).toBe(1);

    await expect(RNFS.exists(media.file_path)).resolves.toBe(true);
    const pending = await syncQueue.listPending(OWNER);
    expect(pending[0].attempt_count).toBe(1);
  });

  it('does not upload when the durable file has gone missing', async () => {
    const media = await capture();
    fsFiles.delete(media.file_path);

    const result = await engine().flush(OWNER);

    expect(calls).toHaveLength(0);
    expect(result.succeeded).toBe(0);
    const stored = await getMedia(OWNER, media.local_id);
    expect(stored?.upload_status).toBe('failed');
    expect(stored?.last_error).toMatch(/no longer on this device/i);
  });
});

describe('startup reconciliation', () => {
  it('surfaces media whose file vanished', async () => {
    const media = await capture();
    fsFiles.delete(media.file_path);

    const missing = await reconcileMediaFiles(OWNER);
    expect(missing).toBe(1);

    const stored = await getMedia(OWNER, media.local_id);
    expect(stored?.upload_status).toBe('failed');
    expect(stored?.last_error).toMatch(/no longer on this device/i);
  });

  it('leaves intact media alone', async () => {
    const media = await capture();

    await expect(reconcileMediaFiles(OWNER)).resolves.toBe(0);
    const stored = await getMedia(OWNER, media.local_id);
    expect(stored?.upload_status).toBe('local');
  });

  it('is owner scoped', async () => {
    await upsertLocalUser({ id: 'other-user' });
    const media = await capture();
    fsFiles.delete(media.file_path);

    const other = asOwnerUserId('other-user');
    await expect(reconcileMediaFiles(other)).resolves.toBe(0);

    const stored = await getMedia(OWNER, media.local_id);
    expect(stored?.upload_status).toBe('local');
  });
});

describe('schema', () => {
  it('applies the media context migration', async () => {
    const rows = await getDatabase().execute('PRAGMA user_version');
    expect(Number(Object.values(rows.rows[0])[0])).toBeGreaterThanOrEqual(4);

    const columns = await getDatabase().execute("PRAGMA table_info('media_files')");
    expect(columns.rows.map(r => String(r.name))).toContain('context_json');
  });

  it('stores no binary content in SQLite', async () => {
    await capture();
    const columns = await getDatabase().execute("PRAGMA table_info('media_files')");
    const names = columns.rows.map(r => String(r.name));

    expect(names).toContain('file_path');
    expect(names).not.toContain('blob');
    expect(names).not.toContain('data');
    expect(names).not.toContain('content');
  });
});

describe('draft lifecycle', () => {
  it('keeps the file without queuing an upload', async () => {
    const media = await captureDraft();

    expect(media.upload_status).toBe('local');
    await expect(RNFS.exists(media.file_path)).resolves.toBe(true);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('survives an app restart before the record is saved', async () => {
    const media = await captureDraft();

    await closeDatabase();
    await initializeDatabase();

    const drafts = await listDraftMedia(OWNER, 'monitoring_document', DRAFT_SCOPE);
    expect(drafts.map(d => d.local_id)).toEqual([media.local_id]);
    await expect(RNFS.exists(drafts[0].file_path)).resolves.toBe(true);
  });

  it('queues the upload only once the record exists', async () => {
    const media = await captureDraft();

    await commitMedia(OWNER, media.local_id, {
      attachedToType: 'monitoring_record',
      attachedToLocalId: 'srv-record-9',
      context: { recordId: 'srv-record-9' },
    });

    const pending = await syncQueue.listPending(OWNER);
    expect(pending).toHaveLength(1);
    expect(pending[0].entity_local_id).toBe(media.local_id);

    const stored = await getMedia(OWNER, media.local_id);
    expect(stored?.attached_to_type).toBe('monitoring_record');
    expect(stored?.attached_to_local_id).toBe('srv-record-9');
    expect(JSON.parse(stored?.context_json ?? '{}')).toEqual({
      fieldId: 'srv-field-1',
      module: 'soil_samples',
      kind: 'photo',
      recordId: 'srv-record-9',
    });
  });

  it('does not double-queue when commit runs twice', async () => {
    const media = await captureDraft();
    const commit = () =>
      commitMedia(OWNER, media.local_id, {
        attachedToType: 'monitoring_record',
        attachedToLocalId: 'srv-record-9',
        context: { recordId: 'srv-record-9' },
      });

    await commit();
    await commit();

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('leaves a draft out of the record attachment list until committed', async () => {
    const media = await captureDraft();

    await expect(
      listUnsentMediaFor(OWNER, 'monitoring_record', 'srv-record-9'),
    ).resolves.toHaveLength(0);

    await commitMedia(OWNER, media.local_id, {
      attachedToType: 'monitoring_record',
      attachedToLocalId: 'srv-record-9',
    });

    await expect(
      listUnsentMediaFor(OWNER, 'monitoring_record', 'srv-record-9'),
    ).resolves.toHaveLength(1);
  });

  it('uploads a committed draft against its record', async () => {
    const media = await captureDraft();
    await commitMedia(OWNER, media.local_id, {
      attachedToType: 'monitoring_record',
      attachedToLocalId: 'srv-record-9',
      context: { recordId: 'srv-record-9' },
    });

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls[0].url).toContain('/field-monitoring/fields/srv-field-1/documents');
    const stored = await getMedia(OWNER, media.local_id);
    expect(stored?.upload_status).toBe('uploaded');
    await expect(
      listUnsentMediaFor(OWNER, 'monitoring_record', 'srv-record-9'),
    ).resolves.toHaveLength(0);
  });

  it('is scoped to its owner', async () => {
    await upsertLocalUser({ id: 'other-user' });
    await captureDraft();

    await expect(
      listDraftMedia(asOwnerUserId('other-user'), 'monitoring_document', DRAFT_SCOPE),
    ).resolves.toHaveLength(0);
  });
});

describe('discard', () => {
  it('removes the row and the stored file', async () => {
    const media = await captureDraft();

    await expect(discardMedia(OWNER, media.local_id)).resolves.toBe(true);

    await expect(getMedia(OWNER, media.local_id)).resolves.toBeNull();
    await expect(RNFS.exists(media.file_path)).resolves.toBe(false);
  });

  it('cancels a queued upload that has not been sent', async () => {
    const media = await captureDraft();
    await commitMedia(OWNER, media.local_id, {
      attachedToType: 'monitoring_record',
      attachedToLocalId: 'srv-record-9',
    });

    await expect(discardMedia(OWNER, media.local_id)).resolves.toBe(true);

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('refuses to discard something already uploaded', async () => {
    const media = await capture();
    await engine().flush(OWNER);

    await expect(discardMedia(OWNER, media.local_id)).resolves.toBe(false);
    await expect(getMedia(OWNER, media.local_id)).resolves.not.toBeNull();
  });

  it('cannot reach an attachment belonging to someone else', async () => {
    await upsertLocalUser({ id: 'other-user' });
    const media = await captureDraft();

    await expect(
      discardMedia(asOwnerUserId('other-user'), media.local_id),
    ).resolves.toBe(false);
    await expect(getMedia(OWNER, media.local_id)).resolves.not.toBeNull();
  });
});

describe('abandoned drafts', () => {
  const age = async (localId: string, iso: string) => {
    await getDatabase().execute('UPDATE media_files SET created_at = ? WHERE local_id = ?', [
      iso,
      localId,
    ]);
  };

  it('keeps recent drafts', async () => {
    await captureDraft();
    await expect(purgeAbandonedDrafts(OWNER)).resolves.toBe(0);
  });

  it('clears drafts the user never saved', async () => {
    const media = await captureDraft();
    await age(media.local_id, '2020-01-01T00:00:00.000Z');

    await expect(purgeAbandonedDrafts(OWNER)).resolves.toBe(1);
    await expect(getMedia(OWNER, media.local_id)).resolves.toBeNull();
    await expect(RNFS.exists(media.file_path)).resolves.toBe(false);
  });

  it('never touches work that is queued for upload', async () => {
    const media = await captureDraft();
    await commitMedia(OWNER, media.local_id, {
      attachedToType: 'monitoring_record',
      attachedToLocalId: 'srv-record-9',
    });
    await age(media.local_id, '2020-01-01T00:00:00.000Z');

    await expect(purgeAbandonedDrafts(OWNER)).resolves.toBe(0);
    await expect(getMedia(OWNER, media.local_id)).resolves.not.toBeNull();
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });
});
