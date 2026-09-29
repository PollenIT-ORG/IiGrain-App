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
import { assessmentRepository, farmRepository, fieldRepository } from '../src/repositories';
import {
  ASSESSMENT_SUBMIT_ENTITY_TYPE,
  assessmentSubmitAdapter,
  createSyncEngine,
  optimisticConnectivity,
  setSyncLogSink,
  submitAssessmentOffline,
  syncQueue,
} from '../src/services/sync';
import { ensureLocalAssessmentScope } from '../src/services/sync/assessmentScope';
import { syncHttp } from '../src/services/sync/syncHttp';
import {
  cacheAssessmentSummary,
  readCachedAssessmentList,
  readCachedAssessmentSummary,
} from '../src/services/sync/assessmentListCache';
import type { FieldAssessmentSummary } from '../src/types/assessment';
import { submitAssessmentThunk } from '../src/redux/thunks/assessmentThunks';
import * as assessmentApi from '../src/api/assessmentApi';

jest.mock('../src/api/assessmentApi', () => ({
  ...jest.requireActual('../src/api/assessmentApi'),
  submitAssessment: jest.fn(),
}));

const OWNER_ID = 'farmer-submit';
const OWNER = asOwnerUserId(OWNER_ID);
const PROGRAM = 'prog-1';
const FIELD = 'srv-field-1';

const summary = {
  field: { id: FIELD, name: 'North block', farmId: 'srv-farm-1', farmName: 'Green Acres' },
  assessment: { totalQuestions: 10 },
};

const authReducer = () => ({ user: { id: OWNER_ID, role: 'farmer' } });
const assessmentReducer = () => ({ submitting: false, summary, myFields: null });
const dashboardReducer = () => ({ staleFarmIds: [] });

const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      assessment: assessmentReducer,
      dashboard: dashboardReducer,
    },
  });

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

let calls: string[] = [];

const seedScope = async () => {
  const farm = await farmRepository.create(OWNER, {
    name: 'Green Acres',
    server_id: 'srv-farm-1',
  });
  await fieldRepository.create(OWNER, {
    farm_local_id: farm.local_id,
    name: 'North block',
    server_id: FIELD,
  });
  return ensureLocalAssessmentScope(OWNER, {
    programId: PROGRAM,
    fieldServerId: FIELD,
    farmServerId: 'srv-farm-1',
    authorRole: 'farmer',
    fieldName: 'North block',
    farmName: 'Green Acres',
    totalQuestions: 10,
  });
};

beforeEach(async () => {
  setSyncLogSink(() => {});
  calls = [];
  (assessmentApi.submitAssessment as jest.Mock).mockRejectedValue(offlineError());
  syncHttp.defaults.adapter = async config => {
    calls.push(config.url ?? '');
    return {
      data: { data: { assessment: { id: 'srv-a1', submitted_at: '2026-09-11T00:00:00Z' } } },
      status: 200,
      statusText: '200',
      headers: new AxiosHeaders(),
      config,
    } as never;
  };
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
    adapters: [assessmentSubmitAdapter],
  });

describe('submitting an assessment with no connection', () => {
  it('accepts the submission instead of failing at the user', async () => {
    await seedScope();

    const action = await dispatch(submitAssessmentThunk({ programId: PROGRAM, fieldId: FIELD }));

    expect(submitAssessmentThunk.fulfilled.match(action as never)).toBe(true);
  });

  it('marks the assessment as waiting to submit and queues it', async () => {
    const assessment = await seedScope();

    await dispatch(submitAssessmentThunk({ programId: PROGRAM, fieldId: FIELD }));

    const row = await assessmentRepository.getByLocalId(OWNER, assessment.local_id);
    expect(row?.submit_pending).toBe(1);

    const pending = await syncQueue.listPending(OWNER);
    expect(pending.map(e => e.entity_type)).toContain(ASSESSMENT_SUBMIT_ENTITY_TYPE);
  });

  it('survives a restart', async () => {
    const assessment = await seedScope();
    await dispatch(submitAssessmentThunk({ programId: PROGRAM, fieldId: FIELD }));

    await closeDatabase();
    await initializeDatabase();

    const row = await assessmentRepository.getByLocalId(OWNER, assessment.local_id);
    expect(row?.submit_pending).toBe(1);
    await expect(syncQueue.countUnsent(OWNER)).resolves.toBeGreaterThan(0);
  });

  it('does not queue the same submit twice', async () => {
    await seedScope();

    await dispatch(submitAssessmentThunk({ programId: PROGRAM, fieldId: FIELD }));
    await dispatch(submitAssessmentThunk({ programId: PROGRAM, fieldId: FIELD }));

    const pending = await syncQueue.listPending(OWNER);
    const submits = pending.filter(e => e.entity_type === ASSESSMENT_SUBMIT_ENTITY_TYPE);
    expect(submits).toHaveLength(1);
  });
});

describe('sending the submission once back online', () => {
  it('posts to the real submit endpoint', async () => {
    const assessment = await seedScope();
    await submitAssessmentOffline(OWNER, assessment.local_id);

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls).toEqual([`/assessments/my/programs/${PROGRAM}/fields/${FIELD}/submit`]);
  });

  it('clears the pending flag and records when it was submitted', async () => {
    const assessment = await seedScope();
    await submitAssessmentOffline(OWNER, assessment.local_id);

    await engine().flush(OWNER);

    const row = await assessmentRepository.getByLocalId(OWNER, assessment.local_id);
    expect(row?.submit_pending).toBe(0);
    expect(row?.submitted_at).toBe('2026-09-11T00:00:00Z');
    expect(row?.status).toBe('COMPLETED');
  });

  it('waits for the field rather than posting a local id', async () => {
    const farm = await farmRepository.create(OWNER, { name: 'Offline farm' });
    const field = await fieldRepository.create(OWNER, {
      farm_local_id: farm.local_id,
      name: 'Unsynced block',
    });
    const assessment = await assessmentRepository.create(OWNER, {
      program_id: PROGRAM,
      field_local_id: field.local_id,
      author_role: 'farmer',
      status: 'in_progress',
    });
    await submitAssessmentOffline(OWNER, assessment.local_id);

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(0);
    expect(calls).toHaveLength(0);
    const row = await assessmentRepository.getByLocalId(OWNER, assessment.local_id);
    expect(row?.submit_pending).toBe(1);
  });

  it('is safe to replay when the flag is already cleared', async () => {
    const assessment = await seedScope();
    await submitAssessmentOffline(OWNER, assessment.local_id);
    await engine().flush(OWNER);
    calls = [];

    await syncQueue.enqueue(OWNER, {
      entityType: ASSESSMENT_SUBMIT_ENTITY_TYPE,
      entityLocalId: assessment.local_id,
      operation: 'update',
    });
    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it('keeps the submission out of another user reach', async () => {
    await upsertLocalUser({ id: 'other-user' });
    const assessment = await seedScope();
    await submitAssessmentOffline(OWNER, assessment.local_id);

    const other = asOwnerUserId('other-user');
    await expect(syncQueue.countUnsent(other)).resolves.toBe(0);
    const result = await engine().flush(other);
    expect(result.succeeded).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe('assessors submit to their own endpoint', () => {
  const seedAssessorScope = async () => {
    const farm = await farmRepository.create(OWNER, {
      name: 'Green Acres',
      server_id: 'srv-farm-1',
    });
    const field = await fieldRepository.create(OWNER, {
      farm_local_id: farm.local_id,
      name: 'North block',
      server_id: FIELD,
    });
    return assessmentRepository.create(OWNER, {
      program_id: PROGRAM,
      field_local_id: field.local_id,
      author_role: 'assessor',
      status: 'in_progress',
    });
  };

  it('posts to the assessor submit url, not the farmer one', async () => {
    const assessment = await seedAssessorScope();
    await submitAssessmentOffline(OWNER, assessment.local_id);

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls).toEqual([`/assessor/programs/${PROGRAM}/fields/${FIELD}/submit`]);
    expect(calls[0]).not.toContain('/assessments/my/');
  });

  it('still sends farmer submissions to the farmer url', async () => {
    const assessment = await seedScope();
    await submitAssessmentOffline(OWNER, assessment.local_id);

    await engine().flush(OWNER);

    expect(calls).toEqual([`/assessments/my/programs/${PROGRAM}/fields/${FIELD}/submit`]);
    expect(calls[0]).not.toContain('/assessor/');
  });

  it('clears the pending flag for an assessor too', async () => {
    const assessment = await seedAssessorScope();
    await submitAssessmentOffline(OWNER, assessment.local_id);

    await engine().flush(OWNER);

    const row = await assessmentRepository.getByLocalId(OWNER, assessment.local_id);
    expect(row?.submit_pending).toBe(0);
  });
});

const cachedSummary: FieldAssessmentSummary = {
  field: { id: FIELD, name: 'North block', farmId: 'srv-farm-1', farmName: 'Green Acres' },
  assessment: {
    title: 'Regen Assessment 2026',
    year: 2026,
    status: 'PENDING',
    totalQuestions: 10,
    answered: 10,
    percentage: 100,
    submitted: false,
    questionKind: 'mcq',
  },
  categories: [
    { id: 'cat-1', name: 'Soil Health', totalQuestions: 10, answered: 10, percentage: 100, records: 0 },
  ],
  canEdit: true,
  reviewStatus: null,
  program: { active: true, ended: false, endDate: null, assessmentOpen: true },
};

describe('reading an assessment back after submitting it offline', () => {
  const warm = async () => {
    const assessment = await seedScope();
    await cacheAssessmentSummary(OWNER, PROGRAM, cachedSummary, 'farmer');
    return assessment;
  };

  it('shows the summary as submitted while the submit is still queued', async () => {
    const assessment = await warm();
    await submitAssessmentOffline(OWNER, assessment.local_id);

    const cachedRead = await readCachedAssessmentSummary(OWNER, PROGRAM, FIELD, 'farmer');

    expect(cachedRead?.assessment.submitted).toBe(true);
    expect(cachedRead?.assessment.status).toBe('COMPLETED');
  });

  it('shows it as completed in the assessment list and counts it', async () => {
    const assessment = await warm();
    await submitAssessmentOffline(OWNER, assessment.local_id);

    const list = await readCachedAssessmentList(OWNER, 'farmer');

    expect(list?.fields[0].status).toBe('COMPLETED');
    expect(list?.counts.completed).toBe(1);
  });

  it('still reads as submitted once the submit has synced', async () => {
    const assessment = await warm();
    await submitAssessmentOffline(OWNER, assessment.local_id);

    await engine().flush(OWNER);

    const row = await assessmentRepository.getByLocalId(OWNER, assessment.local_id);
    expect(row?.submit_pending).toBe(0);
    const cachedRead = await readCachedAssessmentSummary(OWNER, PROGRAM, FIELD, 'farmer');
    expect(cachedRead?.assessment.submitted).toBe(true);
  });

  it('does not mark an assessment that was never submitted', async () => {
    await warm();

    const cachedRead = await readCachedAssessmentSummary(OWNER, PROGRAM, FIELD, 'farmer');

    expect(cachedRead?.assessment.submitted).toBe(false);
  });
});

describe('a submit the server already accepted', () => {
  const respondWith = (status: number, message: string) => {
    syncHttp.defaults.adapter = async config => {
      calls.push(config.url ?? '');
      const response = {
        data: { success: false, message },
        status,
        statusText: String(status),
        headers: new AxiosHeaders(),
        config,
      };
      throw new AxiosError(message, 'ERR_BAD_REQUEST', config as never, null, response as never);
    };
  };

  it('treats a 409 on replay as already submitted, not as a failure', async () => {
    const assessment = await seedScope();
    await submitAssessmentOffline(OWNER, assessment.local_id);
    respondWith(409, 'This assessment has already been submitted.');

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    await expect(syncQueue.countFailed(OWNER)).resolves.toBe(0);
    await expect(syncQueue.countUnsent(OWNER)).resolves.toBe(0);
    const row = await assessmentRepository.getByLocalId(OWNER, assessment.local_id);
    expect(row?.submit_pending).toBe(0);
    expect(row?.status).toBe('COMPLETED');
  });

  it('still fails a submit the server rejects for another reason', async () => {
    const assessment = await seedScope();
    await submitAssessmentOffline(OWNER, assessment.local_id);
    respondWith(400, 'Answer at least one question before submitting.');

    await engine().flush(OWNER);

    await expect(syncQueue.countFailed(OWNER)).resolves.toBe(1);
    const row = await assessmentRepository.getByLocalId(OWNER, assessment.local_id);
    expect(row?.submit_pending).toBe(1);
  });
});
