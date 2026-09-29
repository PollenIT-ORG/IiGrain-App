import { open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  LATEST_SCHEMA_VERSION,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  getDatabase,
  getSchemaVersion,
  initializeDatabase,
  nowIso,
} from '../src/services/db';
import type { OwnerUserId } from '../src/services/db/types';
import {
  answerRepository,
  assessmentRepository,
  countMonitoringRecords,
  createMedia,
  createMonitoringRecord,
  documentRepository,
  ensureAssessment,
  farmRepository,
  farmsAwaitingServerId,
  fieldRepository,
  fieldsBlockedByUnsyncedFarm,
  getAnswer,
  getBoundary,
  getMedia,
  getSoil,
  listAnswers,
  listCategories,
  listEnrolledProgramsForField,
  listFieldDocuments,
  listFieldsByFarm,
  listMonitoringRecords,
  listPendingUploads,
  listPrograms,
  listQuestions,
  parseMonitoringValues,
  removeBoundary,
  saveAnswer,
  saveBoundary,
  saveSoil,
  searchFarms,
  setProgramField,
  setUploadStatus,
  upsertCategory,
  upsertProgram,
  upsertQuestion,
} from '../src/repositories';

const OWNER_A = asOwnerUserId('user-a');
const OWNER_B = asOwnerUserId('user-b');

const seedUser = async (localId: string, email: string): Promise<void> => {
  await getDatabase().execute(
    `INSERT INTO users (local_id, server_id, email, name, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [localId, null, email, 'Test', 'farmer', nowIso(), nowIso()],
  );
};

const makeFarm = (owner: OwnerUserId, name = 'North Block') =>
  farmRepository.create(owner, { name, area_acres: 12.5, location: 'Somewhere' });

const makeField = async (owner: OwnerUserId, farmLocalId: string, name = 'Plot 1') =>
  fieldRepository.create(owner, {
    farm_local_id: farmLocalId,
    name,
    crop: 'Wheat',
    area_acres: 4,
  });

beforeEach(async () => {
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
  await seedUser('user-a', 'a@example.com');
  await seedUser('user-b', 'b@example.com');
});

afterAll(async () => {
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

describe('domain schema', () => {
  it('migrates to the latest schema version', async () => {
    await expect(getSchemaVersion()).resolves.toBe(LATEST_SCHEMA_VERSION);
    expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(2);
  });

  it('creates every domain table', async () => {
    const expected = [
      'farms',
      'fields',
      'field_boundaries',
      'field_soil',
      'programs',
      'program_fields',
      'assessments',
      'assessment_categories',
      'assessment_questions',
      'assessment_answers',
      'monitoring_records',
      'documents',
      'media_files',
    ];

    const result = await getDatabase().execute(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const names = result.rows.map(row => String(row.name));
    for (const table of expected) {
      expect(names).toContain(table);
    }
  });
});

describe('farm repository', () => {
  it('creates a farm with a local id and no server id', async () => {
    const farm = await makeFarm(OWNER_A);

    expect(farm.local_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(farm.server_id).toBeNull();
    expect(farm.sync_state).toBe('local');
    expect(farm.deleted_local).toBe(0);
    expect(farm.owner_user_id).toBe('user-a');
    expect(farm.name).toBe('North Block');
  });

  it('reads back by local id and by server id', async () => {
    const farm = await makeFarm(OWNER_A);
    await farmRepository.setServerId(OWNER_A, farm.local_id, 'srv-1');

    await expect(farmRepository.getByLocalId(OWNER_A, farm.local_id)).resolves.toMatchObject(
      { local_id: farm.local_id },
    );
    await expect(farmRepository.getByServerId(OWNER_A, 'srv-1')).resolves.toMatchObject({
      local_id: farm.local_id,
    });
  });

  it('updates a farm and marks a synced row dirty again', async () => {
    const farm = await makeFarm(OWNER_A);
    await farmRepository.markSynced(OWNER_A, farm.local_id);

    const synced = await farmRepository.getByLocalId(OWNER_A, farm.local_id);
    expect(synced?.sync_state).toBe('synced');

    const updated = await farmRepository.update(OWNER_A, farm.local_id, {
      name: 'South Block',
    });

    expect(updated?.name).toBe('South Block');
    expect(updated?.sync_state).toBe('local');
  });

  it('soft deletes and hides the row from listings', async () => {
    const farm = await makeFarm(OWNER_A);

    await expect(farmRepository.softDelete(OWNER_A, farm.local_id)).resolves.toBe(true);
    await expect(farmRepository.list(OWNER_A)).resolves.toHaveLength(0);
    await expect(
      farmRepository.list(OWNER_A, { includeDeleted: true }),
    ).resolves.toHaveLength(1);
  });

  it('searches locally by name', async () => {
    await makeFarm(OWNER_A, 'North Block');
    await makeFarm(OWNER_A, 'Riverside');

    const hits = await searchFarms(OWNER_A, 'river');
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe('Riverside');
  });

  it('rejects an unknown column', async () => {
    await expect(
      farmRepository.create(OWNER_A, { nope: 'x' } as never),
    ).rejects.toThrow(/unknown column/i);
  });

  it('lists rows awaiting a server id', async () => {
    const a = await makeFarm(OWNER_A, 'Unsynced');
    const b = await makeFarm(OWNER_A, 'Synced');
    await farmRepository.setServerId(OWNER_A, b.local_id, 'srv-b');

    const waiting = await farmsAwaitingServerId(OWNER_A);
    expect(waiting.map(f => f.local_id)).toEqual([a.local_id]);
  });
});

describe('owner scoping', () => {
  it('never returns another user’s rows', async () => {
    const farmA = await makeFarm(OWNER_A, 'A Farm');
    await makeFarm(OWNER_B, 'B Farm');

    await expect(farmRepository.count(OWNER_A)).resolves.toBe(1);
    await expect(farmRepository.count(OWNER_B)).resolves.toBe(1);

    await expect(
      farmRepository.getByLocalId(OWNER_B, farmA.local_id),
    ).resolves.toBeNull();
  });

  it('cannot update or delete across owners', async () => {
    const farmA = await makeFarm(OWNER_A);

    await expect(
      farmRepository.update(OWNER_B, farmA.local_id, { name: 'hijacked' }),
    ).resolves.toBeNull();
    await expect(farmRepository.softDelete(OWNER_B, farmA.local_id)).resolves.toBe(false);
    await expect(farmRepository.hardDelete(OWNER_B, farmA.local_id)).resolves.toBe(false);

    const untouched = await farmRepository.getByLocalId(OWNER_A, farmA.local_id);
    expect(untouched?.name).toBe('North Block');
    expect(untouched?.deleted_local).toBe(0);
  });

  it('refuses an empty owner scope', () => {
    expect(() => asOwnerUserId('')).toThrow(/non-empty/i);
  });

  it('cascades a user deletion to their domain rows', async () => {
    const farm = await makeFarm(OWNER_A);
    await makeField(OWNER_A, farm.local_id);
    await makeFarm(OWNER_B, 'B Farm');

    await getDatabase().execute('DELETE FROM users WHERE local_id = ?', ['user-a']);

    await expect(farmRepository.count(OWNER_B)).resolves.toBe(1);
    const remaining = await getDatabase().execute('SELECT COUNT(*) AS c FROM fields');
    expect(Number(remaining.rows[0].c)).toBe(0);
  });
});

describe('field repository', () => {
  it('creates a field under a farm and lists it', async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);

    expect(field.farm_local_id).toBe(farm.local_id);
    await expect(listFieldsByFarm(OWNER_A, farm.local_id)).resolves.toHaveLength(1);
  });

  it('rejects a field whose farm does not exist', async () => {
    await expect(
      fieldRepository.create(OWNER_A, { farm_local_id: 'missing', name: 'Orphan' }),
    ).rejects.toThrow();
  });

  it('cascades farm deletion to fields', async () => {
    const farm = await makeFarm(OWNER_A);
    await makeField(OWNER_A, farm.local_id);

    await farmRepository.hardDelete(OWNER_A, farm.local_id);
    await expect(fieldRepository.count(OWNER_A)).resolves.toBe(0);
  });

  it('identifies fields blocked behind an unsynced farm', async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);

    const blocked = await fieldsBlockedByUnsyncedFarm(OWNER_A);
    expect(blocked.map(f => f.local_id)).toEqual([field.local_id]);

    await farmRepository.setServerId(OWNER_A, farm.local_id, 'srv-farm');
    const afterSync = await fieldsBlockedByUnsyncedFarm(OWNER_A);
    expect(afterSync).toHaveLength(0);
  });
});

describe('boundary repository', () => {
  const ring = [
    { latitude: 10, longitude: 20 },
    { latitude: 10.001, longitude: 20 },
    { latitude: 10.001, longitude: 20.001 },
    { latitude: 10, longitude: 20.001 },
  ];

  it('saves a boundary and flags the field', async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);

    const boundary = await saveBoundary(OWNER_A, {
      fieldLocalId: field.local_id,
      farmLocalId: farm.local_id,
      ring,
    });

    expect(boundary.version).toBe(1);
    expect(boundary.sync_state).toBe('local');
    expect(JSON.parse(boundary.geojson).type).toBe('Polygon');
    expect(JSON.parse(boundary.geojson).coordinates[0]).toHaveLength(5);

    const updatedField = await fieldRepository.getByLocalId(OWNER_A, field.local_id);
    expect(updatedField?.has_boundary).toBe(1);
  });

  it('bumps the version when re-saved', async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);

    await saveBoundary(OWNER_A, {
      fieldLocalId: field.local_id,
      farmLocalId: farm.local_id,
      ring,
    });
    const second = await saveBoundary(OWNER_A, {
      fieldLocalId: field.local_id,
      farmLocalId: farm.local_id,
      ring,
    });

    expect(second.version).toBe(2);
  });

  it('refuses fewer than three points', async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);

    await expect(
      saveBoundary(OWNER_A, {
        fieldLocalId: field.local_id,
        farmLocalId: farm.local_id,
        ring: ring.slice(0, 2),
      }),
    ).rejects.toThrow(/three points/i);
  });

  it('removes a boundary and clears the field flag', async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);
    await saveBoundary(OWNER_A, {
      fieldLocalId: field.local_id,
      farmLocalId: farm.local_id,
      ring,
    });

    await expect(removeBoundary(OWNER_A, field.local_id)).resolves.toBe(true);
    await expect(getBoundary(OWNER_A, field.local_id)).resolves.toBeNull();

    const updatedField = await fieldRepository.getByLocalId(OWNER_A, field.local_id);
    expect(updatedField?.has_boundary).toBe(0);
  });
});

describe('soil repository', () => {
  it('upserts a soil record for a field', async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);

    await saveSoil(OWNER_A, field.local_id, { ph: 6.4, texture: 'Loam' });
    const first = await getSoil(OWNER_A, field.local_id);
    expect(first?.ph).toBeCloseTo(6.4);

    await saveSoil(OWNER_A, field.local_id, { ph: 7.1, texture: 'Clay' });
    const second = await getSoil(OWNER_A, field.local_id);
    expect(second?.ph).toBeCloseTo(7.1);
    expect(second?.texture).toBe('Clay');

    const count = await getDatabase().execute('SELECT COUNT(*) AS c FROM field_soil');
    expect(Number(count.rows[0].c)).toBe(1);
  });
});

describe('program repository', () => {
  it('upserts programs and enrolment links', async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);

    await upsertProgram(OWNER_A, { programId: 'prog-1', name: 'Regen 2026' });
    await upsertProgram(OWNER_A, { programId: 'prog-1', name: 'Regen 2026 v2' });

    const programs = await listPrograms(OWNER_A);
    expect(programs).toHaveLength(1);
    expect(programs[0].name).toBe('Regen 2026 v2');

    await setProgramField(OWNER_A, 'prog-1', field.local_id, true);
    const links = await listEnrolledProgramsForField(OWNER_A, field.local_id);
    expect(links).toHaveLength(1);
  });

  it('scopes programs per owner', async () => {
    await upsertProgram(OWNER_A, { programId: 'prog-1', name: 'A Program' });
    await upsertProgram(OWNER_B, { programId: 'prog-1', name: 'B Program' });

    await expect(listPrograms(OWNER_A)).resolves.toHaveLength(1);
    const a = await listPrograms(OWNER_A);
    expect(a[0].name).toBe('A Program');
  });
});

describe('assessment repository', () => {
  const scope = { programId: 'prog-1', authorRole: 'farmer' as const };

  const setup = async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);
    await upsertProgram(OWNER_A, { programId: 'prog-1', name: 'Regen' });
    const assessment = await ensureAssessment(OWNER_A, {
      ...scope,
      fieldLocalId: field.local_id,
    });
    return { farm, field, assessment };
  };

  it('caches categories and questions per program', async () => {
    await setup();
    await upsertCategory(OWNER_A, 'prog-1', {
      categoryId: 'cat-1',
      name: 'Soil',
      totalQuestions: 2,
    });
    await upsertQuestion(OWNER_A, {
      questionId: 'q1',
      programId: 'prog-1',
      categoryId: 'cat-1',
      questionText: 'Do you cover crop?',
      score0: 'Never',
      score3: 'Always',
      displayOrder: 1,
    });

    await expect(listCategories(OWNER_A, 'prog-1')).resolves.toHaveLength(1);
    const questions = await listQuestions(OWNER_A, 'prog-1', 'cat-1');
    expect(questions).toHaveLength(1);
    expect(questions[0].score3_description).toBe('Always');
  });

  it('is idempotent when the same assessment is ensured twice', async () => {
    const { field } = await setup();
    const again = await ensureAssessment(OWNER_A, {
      ...scope,
      fieldLocalId: field.local_id,
    });

    await expect(assessmentRepository.count(OWNER_A)).resolves.toBe(1);
    expect(again).toBeTruthy();
  });

  it('saves an answer and updates it in place', async () => {
    const { assessment } = await setup();

    const created = await saveAnswer(OWNER_A, assessment, 'q1', {
      score: 2,
      comment: 'first',
    });
    expect(created.score).toBe(2);

    const updated = await saveAnswer(OWNER_A, assessment, 'q1', {
      score: 3,
      comment: 'second',
    });
    expect(updated.score).toBe(3);
    expect(updated.local_id).toBe(created.local_id);

    await expect(answerRepository.count(OWNER_A)).resolves.toBe(1);
  });

  it('preserves the comment when only the score is saved', async () => {
    const { assessment } = await setup();

    await saveAnswer(OWNER_A, assessment, 'q1', { score: 1, comment: 'keep me' });
    await saveAnswer(OWNER_A, assessment, 'q1', { score: 2 });

    const answer = await getAnswer(OWNER_A, assessment.local_id, 'q1');
    expect(answer?.comment).toBe('keep me');
    expect(answer?.score).toBe(2);
  });

  it('rejects an out-of-range score', async () => {
    const { assessment } = await setup();
    await expect(
      saveAnswer(OWNER_A, assessment, 'q1', { score: 7 }),
    ).rejects.toThrow(/invalid score/i);
  });

  it('refuses to edit a locked assessment', async () => {
    const { assessment } = await setup();
    await assessmentRepository.update(OWNER_A, assessment.local_id, { locked: 1 });
    const locked = await assessmentRepository.getByLocalId(OWNER_A, assessment.local_id);

    await expect(
      saveAnswer(OWNER_A, locked!, 'q1', { score: 1 }),
    ).rejects.toThrow(/locked/i);
  });

  it('derives progress locally from the saved answers', async () => {
    const { assessment } = await setup();
    await assessmentRepository.update(OWNER_A, assessment.local_id, {
      total_questions: 4,
    });
    const withTotal = await assessmentRepository.getByLocalId(
      OWNER_A,
      assessment.local_id,
    );

    await saveAnswer(OWNER_A, withTotal!, 'q1', { score: 1 });
    await saveAnswer(OWNER_A, withTotal!, 'q2', { score: 2 });

    const progressed = await assessmentRepository.getByLocalId(
      OWNER_A,
      assessment.local_id,
    );
    expect(progressed?.answered).toBe(2);
    expect(progressed?.percentage).toBe(50);
    expect(progressed?.status).toBe('IN_PROGRESS');

    await saveAnswer(OWNER_A, withTotal!, 'q3', { score: 3 });
    await saveAnswer(OWNER_A, withTotal!, 'q4', { score: 3 });

    const completed = await assessmentRepository.getByLocalId(
      OWNER_A,
      assessment.local_id,
    );
    expect(completed?.answered).toBe(4);
    expect(completed?.percentage).toBe(100);
    expect(completed?.status).toBe('COMPLETED');
  });

  it('stores evidence urls as json', async () => {
    const { assessment } = await setup();
    await saveAnswer(OWNER_A, assessment, 'q1', {
      score: 1,
      evidenceUrls: ['https://example.com/a.jpg'],
    });

    const answer = await getAnswer(OWNER_A, assessment.local_id, 'q1');
    expect(JSON.parse(answer!.evidence_urls_json)).toEqual([
      'https://example.com/a.jpg',
    ]);
  });

  it('cascades answers when the assessment is removed', async () => {
    const { assessment } = await setup();
    await saveAnswer(OWNER_A, assessment, 'q1', { score: 1 });

    await assessmentRepository.hardDelete(OWNER_A, assessment.local_id);
    await expect(listAnswers(OWNER_A, assessment.local_id)).resolves.toHaveLength(0);
  });
});

describe('monitoring repository', () => {
  it('creates and lists records per module', async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);

    await createMonitoringRecord(OWNER_A, field.local_id, 'irrigation', {
      irrigation_date: '2026-09-01',
      amount_inches: 2.5,
    });
    await createMonitoringRecord(OWNER_A, field.local_id, 'tillage', { passes: 1 });

    await expect(
      listMonitoringRecords(OWNER_A, field.local_id, 'irrigation'),
    ).resolves.toHaveLength(1);
    await expect(
      countMonitoringRecords(OWNER_A, field.local_id, 'tillage'),
    ).resolves.toBe(1);
  });

  it('round-trips dynamic values through json', async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);
    const record = await createMonitoringRecord(OWNER_A, field.local_id, 'soil_samples', {
      point_label: 'P1',
      latitude: 10.5,
      completed: true,
      note: null,
    });

    expect(parseMonitoringValues(record)).toEqual({
      point_label: 'P1',
      latitude: 10.5,
      completed: true,
      note: null,
    });
  });

  it('rejects an unknown status', async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);

    await expect(
      createMonitoringRecord(OWNER_A, field.local_id, 'tillage', {}, {
        status: 'archived' as never,
      }),
    ).rejects.toThrow();
  });
});

describe('document and media repositories', () => {
  it('creates media in a pending upload state', async () => {
    const media = await createMedia(OWNER_A, {
      purpose: 'assessment_evidence',
      filePath: '/outbox/user-a/photo.jpg',
      fileName: 'photo.jpg',
      mime: 'image/jpeg',
      sizeBytes: 1024,
    });

    expect(media.upload_status).toBe('local');
    expect(media.retry_count).toBe(0);
    await expect(listPendingUploads(OWNER_A)).resolves.toHaveLength(1);
    await expect(listPendingUploads(OWNER_B)).resolves.toHaveLength(0);
  });

  it('moves media to uploaded with a remote url', async () => {
    const media = await createMedia(OWNER_A, {
      purpose: 'field_document',
      filePath: '/outbox/user-a/doc.pdf',
      fileName: 'doc.pdf',
    });

    await setUploadStatus(OWNER_A, media.local_id, 'uploaded', {
      remoteUrl: 'https://cdn.example.com/doc.pdf',
    });

    const updated = await getMedia(OWNER_A, media.local_id);
    expect(updated?.upload_status).toBe('uploaded');
    expect(updated?.remote_url).toBe('https://cdn.example.com/doc.pdf');
    await expect(listPendingUploads(OWNER_A)).resolves.toHaveLength(0);
  });

  it('stores document metadata against a field', async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);

    await documentRepository.create(OWNER_A, {
      field_local_id: field.local_id,
      name: 'Soil report.pdf',
      mime: 'application/pdf',
      module: 'soil_samples',
    });

    const docs = await listFieldDocuments(OWNER_A, field.local_id);
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe('Soil report.pdf');
  });
});

describe('server pull semantics', () => {
  it('inserts a pulled row as synced', async () => {
    const farm = await farmRepository.upsertFromServer(OWNER_A, 'srv-1', {
      name: 'Server Farm',
      area_acres: 20,
    });

    expect(farm.server_id).toBe('srv-1');
    expect(farm.sync_state).toBe('synced');
  });

  it('updates a synced row on a later pull', async () => {
    await farmRepository.upsertFromServer(OWNER_A, 'srv-1', { name: 'Server Farm' });
    const updated = await farmRepository.upsertFromServer(OWNER_A, 'srv-1', {
      name: 'Renamed On Server',
    });

    expect(updated.name).toBe('Renamed On Server');
    expect(updated.sync_state).toBe('synced');
    await expect(farmRepository.count(OWNER_A)).resolves.toBe(1);
  });

  it('never clobbers a row with unsynced local changes', async () => {
    const pulled = await farmRepository.upsertFromServer(OWNER_A, 'srv-1', {
      name: 'Server Farm',
    });
    await farmRepository.update(OWNER_A, pulled.local_id, { name: 'My Local Name' });

    const afterPull = await farmRepository.upsertFromServer(OWNER_A, 'srv-1', {
      name: 'Server Wins?',
    });

    expect(afterPull.name).toBe('My Local Name');
    expect(afterPull.sync_state).toBe('conflict');
  });

  it('lists dirty rows for the future sync engine', async () => {
    const local = await makeFarm(OWNER_A, 'Local Only');
    const pulled = await farmRepository.upsertFromServer(OWNER_A, 'srv-1', {
      name: 'Synced',
    });

    const dirty = await farmRepository.listDirty(OWNER_A);
    expect(dirty.map(f => f.local_id)).toEqual([local.local_id]);
    expect(dirty.map(f => f.local_id)).not.toContain(pulled.local_id);
  });
});

describe('persistence', () => {
  it('retains domain rows across close and reopen', async () => {
    const farm = await makeFarm(OWNER_A);
    const field = await makeField(OWNER_A, farm.local_id);
    await saveSoil(OWNER_A, field.local_id, { ph: 6.8 });

    await closeDatabase();
    await initializeDatabase();

    await expect(farmRepository.count(OWNER_A)).resolves.toBe(1);
    await expect(fieldRepository.count(OWNER_A)).resolves.toBe(1);
    const soil = await getSoil(OWNER_A, field.local_id);
    expect(soil?.ph).toBeCloseTo(6.8);
  });
});
