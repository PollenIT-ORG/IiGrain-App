import { AxiosError, AxiosHeaders } from 'axios';
import { open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  getDatabase,
  initializeDatabase,
} from '../src/services/db';
import {
  answerRepository,
  ensureAssessment,
  farmRepository,
  fieldRepository,
  getAnswer,
} from '../src/repositories';
import { upsertLocalUser } from '../src/repositories/userRepository';
import {
  ENTITY_TYPES,
  assessmentAnswerAdapter,
  createManualConnectivity,
  createSyncEngine,
  optimisticConnectivity,
  saveAnswerOffline,
  setSyncLogSink,
  syncQueue,
} from '../src/services/sync';
import { syncHttp } from '../src/services/sync/syncHttp';
import type { DbAssessment } from '../src/services/db/types';

const OWNER_ID = 'farmer-1';
const OWNER = asOwnerUserId(OWNER_ID);

interface CapturedRequest {
  url: string;
  method: string;
  body: Record<string, unknown>;
}

let captured: CapturedRequest[] = [];
let respond: (attempt: number) => { status: number; data?: unknown } = () => ({
  status: 200,
  data: { data: { response: { id: 'srv-answer', updated_at: '2026-09-05T10:00:00Z' } } },
});

const installAdapter = (): void => {
  let attempt = 0;
  syncHttp.defaults.adapter = async config => {
    attempt += 1;
    captured.push({
      url: config.url ?? '',
      method: (config.method ?? '').toLowerCase(),
      body: typeof config.data === 'string' ? JSON.parse(config.data) : {},
    });
    const outcome = respond(attempt);
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

const setup = async (): Promise<{ assessment: DbAssessment; fieldLocalId: string }> => {
  await upsertLocalUser({ id: OWNER_ID });
  const farm = await farmRepository.create(OWNER, { name: 'Farm' });
  await farmRepository.setServerId(OWNER, farm.local_id, 'srv-farm');
  const field = await fieldRepository.create(OWNER, {
    farm_local_id: farm.local_id,
    name: 'Plot',
  });
  await fieldRepository.setServerId(OWNER, field.local_id, 'srv-field');

  const assessment = await ensureAssessment(OWNER, {
    programId: 'prog-1',
    fieldLocalId: field.local_id,
    authorRole: 'farmer',
  });
  return { assessment, fieldLocalId: field.local_id };
};

const engineWith = (online = true) =>
  createSyncEngine({
    connectivity: online ? optimisticConnectivity : createManualConnectivity(false),
    adapters: [assessmentAnswerAdapter],
  });

beforeEach(async () => {
  setSyncLogSink(() => {});
  captured = [];
  respond = () => ({
    status: 200,
    data: { data: { response: { id: 'srv-answer', updated_at: '2026-09-05T10:00:00Z' } } },
  });
  installAdapter();
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
});

afterAll(async () => {
  setSyncLogSink(null);
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

describe('offline answer write', () => {
  it('stores the answer locally and queues exactly one entry', async () => {
    const { assessment } = await setup();

    const answer = await saveAnswerOffline(OWNER, assessment, 'q1', {
      score: 2,
      comment: 'cover cropped',
    });

    expect(answer.score).toBe(2);
    expect(answer.sync_state).toBe('local');

    const pending = await syncQueue.listPending(OWNER);
    expect(pending).toHaveLength(1);
    expect(pending[0].entity_type).toBe(ENTITY_TYPES.assessmentAnswer);
    expect(pending[0].operation).toBe('create');
    expect(captured).toHaveLength(0);
  });

  it('coalesces repeated edits of the same answer into one queue entry', async () => {
    const { assessment } = await setup();

    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 1 });
    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 2 });
    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 3, comment: 'final' });

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
    await expect(answerRepository.count(OWNER)).resolves.toBe(1);

    const stored = await getAnswer(OWNER, assessment.local_id, 'q1');
    expect(stored?.score).toBe(3);
    expect(stored?.comment).toBe('final');
  });

  it('queues one entry per distinct question', async () => {
    const { assessment } = await setup();

    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 1 });
    await saveAnswerOffline(OWNER, assessment, 'q2', { score: 2 });

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(2);
  });

  it('rolls back the answer when queueing fails', async () => {
    const { assessment } = await setup();
    const db = getDatabase();
    const original = db.execute.bind(db);
    const spy = jest
      .spyOn(db, 'execute')
      .mockImplementation(((sql: string, params?: unknown) => {
        if (sql.includes('INSERT INTO sync_queue')) {
          return Promise.reject(new Error('queue insert exploded'));
        }
        return original(sql, params as never);
      }) as typeof db.execute);

    await expect(
      saveAnswerOffline(OWNER, assessment, 'q1', { score: 1 }),
    ).rejects.toThrow(/queue insert exploded/);

    spy.mockRestore();

    await expect(answerRepository.count(OWNER)).resolves.toBe(0);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
  });
});

describe('answer sync to the real endpoint', () => {
  it('sends the current local state to the farmer endpoint', async () => {
    const { assessment } = await setup();
    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 1, comment: 'first' });
    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 3, comment: 'latest' });

    const result = await engineWith().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('put');
    expect(captured[0].url).toBe(
      '/assessments/my/programs/prog-1/fields/srv-field/questions/q1/answer',
    );
    expect(captured[0].body).toEqual({
      score: 3,
      comment: 'latest',
      evidenceUrls: [],
    });
  });

  it('uses the assessor endpoint for assessor answers', async () => {
    await upsertLocalUser({ id: OWNER_ID });
    const farm = await farmRepository.create(OWNER, { name: 'Farm' });
    const field = await fieldRepository.create(OWNER, {
      farm_local_id: farm.local_id,
      name: 'Plot',
    });
    await fieldRepository.setServerId(OWNER, field.local_id, 'srv-field');
    const assessment = await ensureAssessment(OWNER, {
      programId: 'prog-9',
      fieldLocalId: field.local_id,
      authorRole: 'assessor',
    });

    await saveAnswerOffline(OWNER, assessment, 'q7', { score: 2 });
    await engineWith().flush(OWNER);

    expect(captured[0].url).toBe(
      '/assessor/programs/prog-9/fields/srv-field/questions/q7/answer',
    );
  });

  it('marks the answer synced and records the server id', async () => {
    const { assessment } = await setup();
    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 2 });
    const before = await getAnswer(OWNER, assessment.local_id, 'q1');

    await engineWith().flush(OWNER);

    const after = await getAnswer(OWNER, assessment.local_id, 'q1');
    expect(after?.local_id).toBe(before?.local_id);
    expect(after?.server_id).toBe('srv-answer');
    expect(after?.sync_state).toBe('synced');
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
  });

  it('sends evidence urls that are already uploaded', async () => {
    const { assessment } = await setup();
    await saveAnswerOffline(OWNER, assessment, 'q1', {
      score: 1,
      evidenceUrls: ['https://cdn.example.com/a.jpg'],
    });

    await engineWith().flush(OWNER);
    expect(captured[0].body.evidenceUrls).toEqual(['https://cdn.example.com/a.jpg']);
  });

  it('performs no request while offline and keeps the answer queued', async () => {
    const { assessment } = await setup();
    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 1 });

    const result = await engineWith(false).flush(OWNER);

    expect(result.stoppedBecause).toBe('offline');
    expect(captured).toHaveLength(0);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('retries a 500 without losing the answer', async () => {
    const { assessment } = await setup();
    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 1 });
    respond = () => ({ status: 500 });

    const result = await engineWith().flush(OWNER);

    expect(result.retried).toBe(1);
    const pending = await syncQueue.listPending(OWNER);
    expect(pending[0].attempt_count).toBe(1);
    await expect(answerRepository.count(OWNER)).resolves.toBe(1);
  });

  it('stops on 401 and leaves the answer recoverable', async () => {
    const { assessment } = await setup();
    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 1 });
    respond = () => ({ status: 401 });

    const result = await engineWith().flush(OWNER);

    expect(result.stoppedBecause).toBe('auth_required');
    const pending = await syncQueue.listPending(OWNER);
    expect(pending[0].status).toBe('pending');
    expect(pending[0].attempt_count).toBe(0);
    await expect(answerRepository.count(OWNER)).resolves.toBe(1);
  });

  it('is safe to replay because the endpoint is an upsert', async () => {
    const { assessment } = await setup();
    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 1 });

    await engineWith().flush(OWNER);
    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 2 });
    await engineWith().flush(OWNER);

    expect(captured).toHaveLength(2);
    expect(captured[0].url).toBe(captured[1].url);
    await expect(answerRepository.count(OWNER)).resolves.toBe(1);
  });

  it('does not send an answer whose field has no server id', async () => {
    await upsertLocalUser({ id: OWNER_ID });
    const farm = await farmRepository.create(OWNER, { name: 'Farm' });
    const field = await fieldRepository.create(OWNER, {
      farm_local_id: farm.local_id,
      name: 'Unsynced plot',
    });
    const assessment = await ensureAssessment(OWNER, {
      programId: 'prog-1',
      fieldLocalId: field.local_id,
      authorRole: 'farmer',
    });
    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 1 });

    const result = await engineWith().flush(OWNER);

    expect(captured).toHaveLength(0);
    expect(result.retried).toBe(1);
    const pending = await syncQueue.listPending(OWNER);
    expect(pending[0].last_error).toMatch(/not been synchronised/i);
  });

  it('survives a restart with the answer still queued', async () => {
    const { assessment } = await setup();
    await saveAnswerOffline(OWNER, assessment, 'q1', { score: 2, comment: 'kept' });

    await closeDatabase();
    await initializeDatabase();

    const stored = await getAnswer(OWNER, assessment.local_id, 'q1');
    expect(stored?.comment).toBe('kept');
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);

    await engineWith().flush(OWNER);
    expect(captured).toHaveLength(1);
  });

  it('records progress locally without any network call', async () => {
    const { assessment } = await setup();
    await getDatabase().execute(
      'UPDATE assessments SET total_questions = ? WHERE local_id = ?',
      [4, assessment.local_id],
    );
    const withTotal = await getDatabase().execute(
      'SELECT * FROM assessments WHERE local_id = ?',
      [assessment.local_id],
    );
    const scoped = withTotal.rows[0] as unknown as DbAssessment;

    await saveAnswerOffline(OWNER, scoped, 'q1', { score: 1 });
    await saveAnswerOffline(OWNER, scoped, 'q2', { score: 2 });

    const updated = await getDatabase().execute(
      'SELECT answered, percentage, status FROM assessments WHERE local_id = ?',
      [assessment.local_id],
    );
    expect(Number(updated.rows[0].answered)).toBe(2);
    expect(Number(updated.rows[0].percentage)).toBe(50);
    expect(updated.rows[0].status).toBe('IN_PROGRESS');
    expect(captured).toHaveLength(0);
  });
});

describe('registered adapters', () => {
  it('registers the answer and farm adapters by default', () => {
    const { DEFAULT_ADAPTERS } = require('../src/services/sync/syncBootstrap');
    const types = DEFAULT_ADAPTERS.map((a: { entityType: string }) => a.entityType);
    expect(types).toContain(ENTITY_TYPES.assessmentAnswer);
    expect(types).toContain(ENTITY_TYPES.farm);
  });

  it('fails an entry whose entity type has no adapter', async () => {
    await upsertLocalUser({ id: OWNER_ID });
    const farm = await farmRepository.create(OWNER, { name: 'Farm' });
    await syncQueue.enqueue(OWNER, {
      entityType: 'monitoring_record',
      entityLocalId: farm.local_id,
      operation: 'create',
    });

    const result = await engineWith().flush(OWNER);

    expect(captured).toHaveLength(0);
    expect(result.failed).toBe(1);
    await expect(farmRepository.count(OWNER)).resolves.toBe(1);
  });
});
