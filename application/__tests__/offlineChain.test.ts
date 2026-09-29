import { AxiosError, AxiosHeaders } from 'axios';
import RNFS from 'react-native-fs';
import { open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  initializeDatabase,
} from '../src/services/db';
import { upsertLocalUser } from '../src/repositories/userRepository';
import {
  farmRepository,
  fieldRepository,
  monitoringRepository,
} from '../src/repositories';
import { getMedia } from '../src/repositories/mediaRepository';
import {
  MEDIA_DRAFT_TYPE,
  captureMedia,
  commitMedia,
  createFarmOffline,
  createFieldOffline,
  createMonitoringOffline,
  createSyncEngine,
  farmAdapter,
  fieldAdapter,
  mediaAdapter,
  monitoringAdapter,
  offlineConnectivity,
  optimisticConnectivity,
  pendingCreateEntryId,
  setSyncLogSink,
  syncQueue,
} from '../src/services/sync';
import { syncHttp } from '../src/services/sync/syncHttp';

const OWNER_ID = 'farmer-chain';
const OWNER = asOwnerUserId(OWNER_ID);

interface Call {
  url: string;
  method: string;
}

let calls: Call[] = [];
let failFrom: string | null = null;

const idFor = (call: Call): unknown => {
  if (call.url === '/farms/me/farms') {
    return { data: { farm: { id: 'srv-farm', updated_at: 'T1' } } };
  }
  if (call.url === '/farms/srv-farm/fields') {
    return { data: { field: { id: 'srv-field', updated_at: 'T1' } } };
  }
  if (call.url === '/field-monitoring/fields/srv-field/modules/soil_samples') {
    return { data: { record: { id: 'srv-record', updated_at: 'T1' } } };
  }
  return {
    data: {
      document: { id: 'srv-doc', url: 'https://cdn.example.com/a.jpg' },
    },
  };
};

const installAdapter = (): void => {
  syncHttp.defaults.adapter = async config => {
    const call: Call = {
      url: config.url ?? '',
      method: (config.method ?? '').toLowerCase(),
    };
    calls.push(call);
    const response = {
      data: idFor(call),
      status: 201,
      statusText: '201',
      headers: new AxiosHeaders(),
      config,
    };
    if (failFrom && call.url.includes(failFrom)) {
      throw new AxiosError('failed', 'ERR', config, null, {
        ...response,
        status: 500,
        data: {},
      } as never);
    }
    return response as never;
  };
};

const fsFiles = (RNFS as unknown as { __files: Set<string> }).__files;

const engine = () =>
  createSyncEngine({
    connectivity: optimisticConnectivity,
    adapters: [farmAdapter, fieldAdapter, monitoringAdapter, mediaAdapter],
  });

const buildOfflineChain = async () => {
  const farm = await createFarmOffline(OWNER, { name: 'Green Acres' });
  const field = await createFieldOffline(OWNER, farm.local_id, {
    name: 'North block',
    area_acres: 4.5,
  });
  const record = await createMonitoringOffline(OWNER, field.local_id, 'soil_samples', {
    status: 'completed',
    notes: 'Sampled at dawn',
    values_json: JSON.stringify({ depth_cm: 30 }),
  });

  const draft = await captureMedia(OWNER, {
    purpose: 'monitoring_document',
    file: {
      uri: 'file:///tmp/picker-cache/IMG_9.jpg',
      name: 'IMG_9.jpg',
      mime: 'image/jpeg',
      size: 4096,
    },
    attachedToType: MEDIA_DRAFT_TYPE,
    attachedToLocalId: 'draft-scope',
    draft: true,
  });

  const dependsOnId = await pendingCreateEntryId(
    OWNER,
    'monitoring_record',
    record.local_id,
  );

  await commitMedia(OWNER, draft.local_id, {
    attachedToType: 'monitoring_record',
    attachedToLocalId: record.local_id,
    context: {
      fieldLocalId: field.local_id,
      recordLocalId: record.local_id,
      module: 'soil_samples',
      kind: 'photo',
    },
    dependsOnId,
  });

  return { farm, field, record, draft };
};

beforeEach(async () => {
  setSyncLogSink(() => {});
  calls = [];
  failFrom = null;
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

describe('a full day of offline work', () => {
  it('touches the network for nothing while offline', async () => {
    await buildOfflineChain();

    expect(calls).toHaveLength(0);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(4);
  });

  it('survives being killed and restarted', async () => {
    const chain = await buildOfflineChain();

    await closeDatabase();
    await initializeDatabase();

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(4);
    await expect(farmRepository.getByLocalId(OWNER, chain.farm.local_id)).resolves.not.toBeNull();
    await expect(fieldRepository.getByLocalId(OWNER, chain.field.local_id)).resolves.not.toBeNull();
    await expect(
      monitoringRepository.getByLocalId(OWNER, chain.record.local_id),
    ).resolves.not.toBeNull();
    const media = await getMedia(OWNER, chain.draft.local_id);
    await expect(RNFS.exists(media?.file_path ?? '')).resolves.toBe(true);
  });

  it('sends everything in dependency order once back online', async () => {
    const chain = await buildOfflineChain();

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(4);
    expect(calls.map(c => c.url)).toEqual([
      '/farms/me/farms',
      '/farms/srv-farm/fields',
      '/field-monitoring/fields/srv-field/modules/soil_samples',
      '/field-monitoring/fields/srv-field/documents/upload',
    ]);

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
    const record = await monitoringRepository.getByLocalId(OWNER, chain.record.local_id);
    expect(record?.server_id).toBe('srv-record');
    const media = await getMedia(OWNER, chain.draft.local_id);
    expect(media?.upload_status).toBe('uploaded');
    expect(media?.remote_url).toBe('https://cdn.example.com/a.jpg');
  });

  it('never sends a local id to the server', async () => {
    const chain = await buildOfflineChain();

    await engine().flush(OWNER);

    const localIds = [
      chain.farm.local_id,
      chain.field.local_id,
      chain.record.local_id,
      chain.draft.local_id,
    ];
    for (const call of calls) {
      for (const localId of localIds) {
        expect(call.url).not.toContain(localId);
      }
    }
  });

  it('stops the whole chain when the first step fails and loses nothing', async () => {
    await buildOfflineChain();
    failFrom = '/farms/me/farms';

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(0);
    expect(calls).toHaveLength(1);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(4);
  });

  it('finishes the chain on the next attempt after a failure', async () => {
    await buildOfflineChain();
    failFrom = '/field-monitoring';

    await engine().flush(OWNER);
    const stalled = await syncQueue.countPending(OWNER);
    expect(stalled).toBe(2);

    failFrom = null;
    calls = [];
    await syncQueue.resetStaleInFlight(OWNER);
    for (const entry of await syncQueue.listPending(OWNER)) {
      await syncQueue.markRetry(OWNER, entry.id, new Date(0).toISOString(), 'retry');
    }

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(2);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
  });

  it('does nothing at all when there is no connection', async () => {
    await buildOfflineChain();

    const offline = createSyncEngine({
      connectivity: offlineConnectivity,
      adapters: [farmAdapter, fieldAdapter, monitoringAdapter, mediaAdapter],
    });
    const result = await offline.flush(OWNER);

    expect(result.stoppedBecause).toBe('offline');
    expect(calls).toHaveLength(0);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(4);
  });

  it('keeps the chain invisible to another user', async () => {
    await upsertLocalUser({ id: 'other-user' });
    await buildOfflineChain();

    const other = asOwnerUserId('other-user');
    await expect(syncQueue.countPending(other)).resolves.toBe(0);
    await expect(farmRepository.list(other)).resolves.toHaveLength(0);
    await expect(fieldRepository.list(other)).resolves.toHaveLength(0);
    await expect(monitoringRepository.list(other)).resolves.toHaveLength(0);

    const result = await engine().flush(other);
    expect(result.succeeded).toBe(0);
    expect(calls).toHaveLength(0);
  });
});
