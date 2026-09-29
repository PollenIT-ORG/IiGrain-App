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
import {
  answerRepository,
  assessmentRepository,
  documentRepository,
  farmRepository,
  fieldRepository,
  monitoringRepository,
} from '../src/repositories';
import { saveBoundary } from '../src/repositories/fieldBoundaryRepository';
import { saveSoil } from '../src/repositories/fieldSoilRepository';
import { createMedia, listPendingUploads } from '../src/repositories/mediaRepository';
import { listFieldDocuments } from '../src/repositories/documentRepository';
import { listFieldsByFarm } from '../src/repositories/fieldRepository';
import { listMonitoringRecords } from '../src/repositories/monitoringRepository';
import { getBoundary } from '../src/repositories/fieldBoundaryRepository';
import { getSoil } from '../src/repositories/fieldSoilRepository';
import {
  PROGRAMS_SCOPE,
  createFarmOffline,
  readSnapshot,
  saveSnapshot,
  setSyncLogSink,
  syncQueue,
} from '../src/services/sync';
import { readCachedFarmList, readCachedFieldList } from '../src/services/sync/farmCache';
import { readCachedMonitoringRecords } from '../src/services/sync/monitoringCache';
import { readCachedFieldDocuments } from '../src/services/sync/documentCache';

const MINE = 'user-a';
const THEIRS = 'user-b';
const A = asOwnerUserId(MINE);
const B = asOwnerUserId(THEIRS);

interface Seeded {
  farmLocalId: string;
  fieldLocalId: string;
  assessmentLocalId: string;
}

const OWNER_SCOPED_TABLES = [
  'farms',
  'fields',
  'field_boundaries',
  'field_soil',
  'assessments',
  'assessment_answers',
  'monitoring_records',
  'documents',
  'media_files',
  'sync_queue',
  'dashboard_snapshots',
  'assessment_packages',
];

const seedEverythingFor = async (owner: ReturnType<typeof asOwnerUserId>): Promise<Seeded> => {
  const farm = await createFarmOffline(owner, { name: 'Green Acres' });
  const field = await fieldRepository.create(owner, {
    farm_local_id: farm.local_id,
    name: 'North block',
  });

  await saveBoundary(owner, {
    fieldLocalId: field.local_id,
    farmLocalId: farm.local_id,
    ring: [
      { latitude: 1, longitude: 1 },
      { latitude: 1, longitude: 2 },
      { latitude: 2, longitude: 2 },
    ],
  });
  await saveSoil(owner, field.local_id, { ph: 6.5, notes: 'private' });

  const assessment = await assessmentRepository.create(owner, {
    program_id: 'prog-1',
    field_local_id: field.local_id,
    author_role: 'farmer',
    status: 'in_progress',
  });
  await answerRepository.create(owner, {
    assessment_local_id: assessment.local_id,
    question_id: 'q1',
    field_local_id: field.local_id,
    program_id: 'prog-1',
    author_role: 'farmer',
    score: 2,
    comment: 'private note',
    evidence_urls_json: '[]',
  });
  await getDatabase().execute(
    `INSERT INTO assessment_packages (owner_user_id, assessment_local_id, status, prepared_at)
     VALUES (?, ?, 'READY', ?)`,
    [owner, assessment.local_id, new Date().toISOString()],
  );

  await monitoringRepository.create(owner, {
    field_local_id: field.local_id,
    module: 'soil_samples',
    status: 'completed',
    values_json: '{}',
  });
  await documentRepository.create(owner, {
    field_local_id: field.local_id,
    name: 'Private report.pdf',
  });
  await createMedia(owner, {
    purpose: 'monitoring_document',
    filePath: '/tmp/private.jpg',
    fileName: 'private.jpg',
  });
  await saveSnapshot(owner, PROGRAMS_SCOPE, { secret: owner });

  return {
    farmLocalId: farm.local_id,
    fieldLocalId: field.local_id,
    assessmentLocalId: assessment.local_id,
  };
};

let mine: Seeded;

beforeEach(async () => {
  setSyncLogSink(() => {});
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
  await upsertLocalUser({ id: MINE });
  await upsertLocalUser({ id: THEIRS });
  mine = await seedEverythingFor(A);
});

afterAll(async () => {
  setSyncLogSink(null);
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

describe('every owner-scoped table actually carries the owner', () => {
  it('has an owner_user_id column on each one', async () => {
    for (const table of OWNER_SCOPED_TABLES) {
      const columns = await getDatabase().execute(`PRAGMA table_info('${table}')`);
      const names = columns.rows.map(r => String(r.name));
      expect(names).toContain('owner_user_id');
    }
  });

  it('wrote every seeded row against the seeding user', async () => {
    for (const table of OWNER_SCOPED_TABLES) {
      const rows = await getDatabase().execute(
        `SELECT COUNT(*) AS c FROM ${table} WHERE owner_user_id = ?`,
        [MINE],
      );
      expect({ table, count: Number(rows.rows[0].c) }).toEqual({
        table,
        count: expect.any(Number),
      });
      expect(Number(rows.rows[0].c)).toBeGreaterThan(0);
    }
  });

  it('leaves the other user with nothing anywhere', async () => {
    for (const table of OWNER_SCOPED_TABLES) {
      const rows = await getDatabase().execute(
        `SELECT COUNT(*) AS c FROM ${table} WHERE owner_user_id = ?`,
        [THEIRS],
      );
      expect(`${table}:${Number(rows.rows[0].c)}`).toBe(`${table}:0`);
    }
  });
});

describe('the other user cannot read any of it through the repositories', () => {
  it('sees no farms or fields', async () => {
    await expect(farmRepository.list(B)).resolves.toHaveLength(0);
    await expect(fieldRepository.list(B)).resolves.toHaveLength(0);
    await expect(farmRepository.getByLocalId(B, mine.farmLocalId)).resolves.toBeNull();
    await expect(fieldRepository.getByLocalId(B, mine.fieldLocalId)).resolves.toBeNull();
    await expect(listFieldsByFarm(B, mine.farmLocalId)).resolves.toHaveLength(0);
  });

  it('sees no boundary or soil, even given the exact field id', async () => {
    await expect(getBoundary(B, mine.fieldLocalId)).resolves.toBeNull();
    await expect(getSoil(B, mine.fieldLocalId)).resolves.toBeNull();
  });

  it('sees no assessments or answers', async () => {
    await expect(assessmentRepository.list(B)).resolves.toHaveLength(0);
    await expect(answerRepository.list(B)).resolves.toHaveLength(0);
    await expect(
      assessmentRepository.getByLocalId(B, mine.assessmentLocalId),
    ).resolves.toBeNull();
  });

  it('sees no monitoring records, documents or media', async () => {
    await expect(monitoringRepository.list(B)).resolves.toHaveLength(0);
    await expect(
      listMonitoringRecords(B, mine.fieldLocalId, 'soil_samples'),
    ).resolves.toHaveLength(0);
    await expect(documentRepository.list(B)).resolves.toHaveLength(0);
    await expect(listFieldDocuments(B, mine.fieldLocalId)).resolves.toHaveLength(0);
    await expect(listPendingUploads(B)).resolves.toHaveLength(0);
  });

  it('sees no queued work', async () => {
    await expect(syncQueue.countPending(B)).resolves.toBe(0);
    await expect(syncQueue.countUnsent(B)).resolves.toBe(0);
    await expect(syncQueue.listPending(B)).resolves.toHaveLength(0);
    await expect(syncQueue.listFailed(B)).resolves.toHaveLength(0);
  });

  it('sees no cached reads', async () => {
    await expect(readCachedFarmList(B)).resolves.toBeNull();
    await expect(readCachedFieldList(B, mine.farmLocalId)).resolves.toBeNull();
    await expect(
      readCachedMonitoringRecords(B, mine.fieldLocalId, 'soil_samples'),
    ).resolves.toBeNull();
    await expect(readCachedFieldDocuments(B, mine.fieldLocalId)).resolves.toBeNull();
    await expect(readSnapshot(B, PROGRAMS_SCOPE)).resolves.toBeNull();
  });
});

describe('the other user cannot write over any of it', () => {
  it('cannot update a row it does not own', async () => {
    await expect(
      farmRepository.update(B, mine.farmLocalId, { name: 'Hijacked' }),
    ).resolves.toBeNull();

    const still = await farmRepository.getByLocalId(A, mine.farmLocalId);
    expect(still?.name).toBe('Green Acres');
  });

  it('cannot delete a row it does not own', async () => {
    await expect(farmRepository.softDelete(B, mine.farmLocalId)).resolves.toBe(false);
    await expect(farmRepository.hardDelete(B, mine.farmLocalId)).resolves.toBe(false);
    await expect(farmRepository.getByLocalId(A, mine.farmLocalId)).resolves.not.toBeNull();
  });

  it('cannot claim a server id onto someone else row', async () => {
    await farmRepository.setServerId(B, mine.farmLocalId, 'stolen');

    const row = await farmRepository.getByLocalId(A, mine.farmLocalId);
    expect(row?.server_id).toBeNull();
  });

  it('cannot cancel work it does not own', async () => {
    const [entry] = await syncQueue.listPending(A);
    await expect(syncQueue.cancel(B, entry.id)).resolves.toBe(false);
    await expect(syncQueue.countPending(A)).resolves.toBeGreaterThan(0);
  });

  it('cannot retry or purge across owners', async () => {
    const [entry] = await syncQueue.listPending(A);
    await syncQueue.markFailed(A, entry.id, 'boom');

    await expect(syncQueue.retryFailed(B)).resolves.toBe(0);
    await expect(syncQueue.countFailed(A)).resolves.toBe(1);

    const future = new Date(Date.now() + 60000).toISOString();
    await expect(syncQueue.purgeCompleted(B, future)).resolves.toBe(0);
  });
});

describe('both users can hold their own copy side by side', () => {
  it('keeps two separate sets of everything', async () => {
    await seedEverythingFor(B);

    for (const table of OWNER_SCOPED_TABLES) {
      const rows = await getDatabase().execute(
        `SELECT owner_user_id, COUNT(*) AS c FROM ${table} GROUP BY owner_user_id`,
      );
      const owners = rows.rows.map(r => String(r.owner_user_id)).sort();
      expect(`${table}:${owners.join(',')}`).toBe(`${table}:${[MINE, THEIRS].sort().join(',')}`);
    }
  });

  it('gives each user back only their own snapshot', async () => {
    await seedEverythingFor(B);

    const a = await readSnapshot<{ secret: string }>(A, PROGRAMS_SCOPE);
    const b = await readSnapshot<{ secret: string }>(B, PROGRAMS_SCOPE);
    expect(a?.payload.secret).toBe(MINE);
    expect(b?.payload.secret).toBe(THEIRS);
  });
});
