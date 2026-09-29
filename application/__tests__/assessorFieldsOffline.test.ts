import { AxiosError } from 'axios';
import { open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  initializeDatabase,
} from '../src/services/db';
import { upsertLocalUser } from '../src/repositories/userRepository';
import { setSyncLogSink, submitAssessmentOffline } from '../src/services/sync';
import { ensureLocalAssessmentScope } from '../src/services/sync/assessmentScope';
import { readCachedAssessorFields } from '../src/services/sync/assessorFieldsCache';
import * as assessorApi from '../src/api/assessorApi';
import {
  fetchAssessorFieldsThunk,
  saveAssessorAnswerThunk,
} from '../src/redux/thunks/assessorThunks';
import assessorReducer, {
  selectAssessorFieldsCapturedAt,
} from '../src/redux/slices/assessorSlice';
import type { FieldAssessmentSummary } from '../src/types/assessment';
import type { AssessorFieldEntry, AssessorFieldsOverview } from '../src/types/assessor';

const USER_ID = 'assessor-list';
const OWNER = asOwnerUserId(USER_ID);
const PROGRAM_ID = 'prog-l';
const FARM_ID = 'srv-farm-l';
const OPEN_FIELD = 'srv-field-open';
const DONE_FIELD = 'srv-field-done';

const networkError = (): AxiosError => new AxiosError('Network Error', 'ERR_NETWORK');

const entry = (
  fieldId: string,
  name: string,
  completed: boolean,
): AssessorFieldEntry => ({
  field: { id: fieldId, name, crop: 'Wheat', status: 'healthy', location: null, areaAcres: 4 },
  farm: { id: FARM_ID, name: 'Home Farm' },
  farmer: { id: 'farmer-1', name: 'Ravi' },
  program: { id: PROGRAM_ID, name: 'Regen' },
  assessment: {
    status: completed ? 'COMPLETED' : 'PENDING',
    inProgress: false,
    completed,
    totalQuestions: 4,
    answered: completed ? 4 : 0,
    percentage: completed ? 100 : 0,
    submittedAtISO: completed ? '2026-09-01T00:00:00Z' : null,
    farmerSubmitted: false,
  },
});

const serverOverview: AssessorFieldsOverview = {
  year: 2026,
  title: 'Regen Assessment 2026',
  counts: { total: 2, notStarted: 1, inProgress: 0, completed: 1 },
  fields: [entry(OPEN_FIELD, 'North Plot', false), entry(DONE_FIELD, 'South Plot', true)],
};

const openFieldSummary: FieldAssessmentSummary = {
  field: { id: OPEN_FIELD, name: 'North Plot', farmId: FARM_ID, farmName: 'Home Farm' },
  assessment: {
    title: 'Regen Assessment 2026',
    year: 2026,
    status: 'PENDING',
    totalQuestions: 4,
    answered: 0,
    percentage: 0,
    submitted: false,
    questionKind: 'mcq',
  },
  categories: [{ id: 'cat-l', name: 'Soil Health', totalQuestions: 4, answered: 0, percentage: 0, records: 0 }],
  canEdit: true,
  reviewStatus: null,
  program: { active: true, ended: false, endDate: null, assessmentOpen: true },
};

const makeState = (summary: FieldAssessmentSummary | null = null) => ({
  auth: { user: { id: USER_ID, fullName: 'Asha Assessor', role: 'assessor' } },
  assessor: {
    fieldsOverview: null,
    summary,
    submitting: false,
    loadingFieldsOverview: false,
  },
});

interface ThunkAction {
  type: string;
  payload: unknown;
  meta: { capturedAt?: string | null };
}

const run = <T>(thunk: T, summary: FieldAssessmentSummary | null = null) =>
  (thunk as never as (d: unknown, g: unknown, e: unknown) => Promise<ThunkAction>)(
    jest.fn(),
    () => JSON.parse(JSON.stringify(makeState(summary))),
    undefined,
  );

const warmList = async () => {
  jest.spyOn(assessorApi, 'getFields').mockResolvedValueOnce(serverOverview);
  await run(fetchAssessorFieldsThunk());
};

const readOffline = async () => {
  jest.spyOn(assessorApi, 'getFields').mockRejectedValue(networkError());
  return run(fetchAssessorFieldsThunk());
};

const openFieldScope = (authorRole: 'assessor' | 'farmer') =>
  ensureLocalAssessmentScope(OWNER, {
    programId: PROGRAM_ID,
    fieldServerId: OPEN_FIELD,
    farmServerId: FARM_ID,
    authorRole,
    fieldName: 'North Plot',
    farmName: 'Home Farm',
    totalQuestions: 4,
  });

const openEntry = (action: ThunkAction): AssessorFieldEntry | undefined =>
  (action.payload as AssessorFieldsOverview).fields.find(f => f.field.id === OPEN_FIELD);

beforeEach(async () => {
  setSyncLogSink(() => {});
  jest.restoreAllMocks();
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
  await upsertLocalUser({ id: USER_ID });
});

afterAll(async () => {
  setSyncLogSink(null);
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

describe('the assessor field list offline', () => {
  it('serves the list seen online and says how old it is', async () => {
    await warmList();

    const action = await readOffline();

    expect(action.type).toBe('assessor/fetchFields/fulfilled');
    expect((action.payload as AssessorFieldsOverview).fields).toHaveLength(2);
    expect(action.meta.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('reports a list fetched live as current', async () => {
    jest.spyOn(assessorApi, 'getFields').mockResolvedValue(serverOverview);

    const action = await run(fetchAssessorFieldsThunk());

    expect(action.type).toBe('assessor/fetchFields/fulfilled');
    expect(action.meta.capturedAt).toBeNull();
  });

  it('rejects when nothing has been cached', async () => {
    const action = await readOffline();

    expect(action.type).toBe('assessor/fetchFields/rejected');
  });

  it('keeps the server counts when nothing changed on the device', async () => {
    await warmList();

    const action = await readOffline();

    expect((action.payload as AssessorFieldsOverview).counts).toEqual(serverOverview.counts);
  });

  it('keeps each owner list separate', async () => {
    await upsertLocalUser({ id: 'other-user' });
    await warmList();

    await expect(readCachedAssessorFields(asOwnerUserId('other-user'))).resolves.toBeNull();
  });
});

describe('work done offline shows up in the cached list', () => {
  it('shows an assessment submitted offline as completed and recounts', async () => {
    await warmList();
    const assessment = await openFieldScope('assessor');
    await submitAssessmentOffline(OWNER, assessment.local_id);

    const action = await readOffline();

    const openField = openEntry(action);
    expect(openField?.assessment.completed).toBe(true);
    expect(openField?.assessment.status).toBe('COMPLETED');
    expect((action.payload as AssessorFieldsOverview).counts).toEqual({
      total: 2,
      notStarted: 0,
      inProgress: 0,
      completed: 2,
    });
  });

  it('shows answers saved offline as in progress', async () => {
    await warmList();
    jest.spyOn(assessorApi, 'saveAnswer').mockRejectedValue(networkError());
    await run(
      saveAssessorAnswerThunk({
        programId: PROGRAM_ID,
        fieldId: OPEN_FIELD,
        questionId: 'q1',
        input: { score: 2 },
      }),
      openFieldSummary,
    );

    const action = await readOffline();

    const openField = openEntry(action);
    expect(openField?.assessment.inProgress).toBe(true);
    expect(openField?.assessment.status).toBe('IN_PROGRESS');
    expect(openField?.assessment.answered).toBe(1);
    expect(openField?.assessment.percentage).toBe(25);
    expect((action.payload as AssessorFieldsOverview).counts.inProgress).toBe(1);
  });

  it('never shows the farmer progress on the assessor list', async () => {
    await warmList();
    const farmerAssessment = await openFieldScope('farmer');
    await submitAssessmentOffline(OWNER, farmerAssessment.local_id);

    const action = await readOffline();

    expect(openEntry(action)?.assessment.completed).toBe(false);
  });
});

describe('the dashboard knows when the list is stale', () => {
  const pending = (requestId: string) => ({
    type: fetchAssessorFieldsThunk.pending.type,
    meta: { requestId, arg: undefined, requestStatus: 'pending' },
  });

  const fulfilled = (requestId: string, capturedAt: string | null) => ({
    type: fetchAssessorFieldsThunk.fulfilled.type,
    payload: serverOverview,
    meta: { requestId, arg: undefined, requestStatus: 'fulfilled', capturedAt },
  });

  it('remembers when an offline list was captured', () => {
    const start = assessorReducer(undefined, pending('r1') as never);
    const next = assessorReducer(start, fulfilled('r1', '2026-09-14T08:00:00.000Z') as never);

    expect(selectAssessorFieldsCapturedAt({ assessor: next } as never)).toBe(
      '2026-09-14T08:00:00.000Z',
    );
  });

  it('clears the note once a live list arrives', () => {
    const offline = assessorReducer(
      assessorReducer(undefined, pending('r1') as never),
      fulfilled('r1', '2026-09-14T08:00:00.000Z') as never,
    );
    const live = assessorReducer(
      assessorReducer(offline, pending('r2') as never),
      fulfilled('r2', null) as never,
    );

    expect(selectAssessorFieldsCapturedAt({ assessor: live } as never)).toBeNull();
  });
});
