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
import { setSyncLogSink, syncQueue } from '../src/services/sync';
import * as assessmentApi from '../src/api/assessmentApi';
import { settleAssessmentPackages } from '../src/services/sync/assessmentPackage';
import {
  fetchAssessmentSummaryThunk,
  fetchCategoryQuestionsThunk,
  fetchMyAssessmentFieldsThunk,
  saveAssessmentAnswerThunk,
} from '../src/redux/thunks/assessmentThunks';
import type {
  CategoryQuestionList,
  FieldAssessmentSummary,
  MyAssessmentsOverview,
} from '../src/types/assessment';

const USER_ID = 'farmer-nav';
const OWNER = asOwnerUserId(USER_ID);
const FIELD_ID = 'srv-field-n';
const FARM_ID = 'srv-farm-n';
const PROGRAM_ID = 'prog-n';
const CATEGORY_ID = 'cat-n';

const networkError = (): AxiosError => new AxiosError('Network Error', 'ERR_NETWORK');

const baseState = {
  auth: { user: { id: USER_ID, role: 'farmer' } },
  assessment: {
    submitting: false,
    loadingQuestions: false,
    requestedCategoryScope: null,
    loadingRegenIndex: false,
    requestedRegenFieldId: null,
    summary: null as unknown,
    regenIndex: null,
    myFields: null as unknown,
  },
};

const state = () => JSON.parse(JSON.stringify(baseState));

const serverList: MyAssessmentsOverview = {
  year: 2026,
  title: 'Regen Assessment 2026',
  counts: { total: 1, notStarted: 1, inProgress: 0, completed: 0 },
  fields: [
    {
      fieldId: FIELD_ID,
      fieldName: 'North Plot',
      crop: 'Wheat',
      fieldStatus: 'healthy',
      farmId: FARM_ID,
      farmName: 'Home Farm',
      programId: PROGRAM_ID,
      programName: 'Regen',
      status: 'PENDING',
      totalQuestions: 2,
      answered: 0,
      percentage: 0,
      submittedAtISO: null,
      reviewStatus: null,
    },
  ],
};

const serverSummary: FieldAssessmentSummary = {
  field: { id: FIELD_ID, name: 'North Plot', farmId: FARM_ID, farmName: 'Home Farm' },
  assessment: {
    title: 'Regen Assessment 2026',
    year: 2026,
    status: 'PENDING',
    totalQuestions: 2,
    answered: 0,
    percentage: 0,
    submitted: false,
    questionKind: 'mcq',
  },
  categories: [
    { id: CATEGORY_ID, name: 'Soil Health', totalQuestions: 2, answered: 0, percentage: 0, records: 0 },
  ],
  canEdit: true,
  reviewStatus: null,
  program: { active: true, ended: false, endDate: null, assessmentOpen: true },
};

const serverQuestions: CategoryQuestionList = {
  field: { id: FIELD_ID, name: 'North Plot' },
  category: { id: CATEGORY_ID, name: 'Soil Health' },
  progress: { totalQuestions: 2, answered: 0, percentage: 0 },
  questions: [
    { id: 'q1', code: 'S1', text: 'Cover crops?', guidance: 'g1', answered: false },
    { id: 'q2', code: 'S2', text: 'Tillage?', guidance: 'g2', answered: false },
  ],
};

const run = <T>(thunk: T) =>
  (thunk as never as (d: unknown, g: unknown, e: unknown) => Promise<{ type: string; payload: unknown }>)(
    jest.fn(),
    () => state(),
    undefined,
  );

const runList = () => run(fetchMyAssessmentFieldsThunk(undefined));
const runSummary = () => {
  jest.spyOn(assessmentApi, 'getCategoryQuestionSet').mockRejectedValue(networkError());
  return run(fetchAssessmentSummaryThunk({ programId: PROGRAM_ID, fieldId: FIELD_ID }));
};
const runQuestions = () =>
  run(
    fetchCategoryQuestionsThunk({
      programId: PROGRAM_ID,
      fieldId: FIELD_ID,
      categoryId: CATEGORY_ID,
    }),
  );

beforeEach(async () => {
  setSyncLogSink(() => {});
  jest.restoreAllMocks();
  jest.spyOn(assessmentApi, 'getCategoryQuestionSet').mockRejectedValue(networkError());
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
  await upsertLocalUser({ id: USER_ID });
});

afterEach(async () => {
  await settleAssessmentPackages();
});

afterAll(async () => {
  setSyncLogSink(null);
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

describe('online reads are unchanged and cached', () => {
  it('returns the server list verbatim', async () => {
    jest.spyOn(assessmentApi, 'getMyAssessmentFields').mockResolvedValue(serverList);
    const action = await runList();
    expect(action.type).toBe('assessment/myFields/fulfilled');
    expect(action.payload).toEqual(serverList);
  });

  it('returns the server summary verbatim', async () => {
    jest.spyOn(assessmentApi, 'getAssessmentSummary').mockResolvedValue(serverSummary);
    const action = await runSummary();
    expect(action.payload).toEqual(serverSummary);
  });
});

describe('offline navigation path', () => {
  const warmCache = async () => {
    jest.spyOn(assessmentApi, 'getMyAssessmentFields').mockResolvedValue(serverList);
    await runList();
    jest.spyOn(assessmentApi, 'getAssessmentSummary').mockResolvedValue(serverSummary);
    await runSummary();
    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockResolvedValue(serverQuestions);
    await runQuestions();
    jest.restoreAllMocks();
  };

  it('serves the assessment list from cache', async () => {
    await warmCache();
    jest.spyOn(assessmentApi, 'getMyAssessmentFields').mockRejectedValue(networkError());

    const action = await runList();
    expect(action.type).toBe('assessment/myFields/fulfilled');

    const payload = action.payload as MyAssessmentsOverview;
    expect(payload.fields).toHaveLength(1);
    expect(payload.fields[0].fieldName).toBe('North Plot');
    expect(payload.fields[0].farmName).toBe('Home Farm');
    expect(payload.fields[0].crop).toBe('Wheat');
    expect(payload.fields[0].programId).toBe(PROGRAM_ID);
    expect(payload.title).toBe('Regen Assessment 2026');
  });

  it('serves the field summary with its categories from cache', async () => {
    await warmCache();
    jest.spyOn(assessmentApi, 'getAssessmentSummary').mockRejectedValue(networkError());

    const action = await runSummary();
    const payload = action.payload as FieldAssessmentSummary;

    expect(payload.field.name).toBe('North Plot');
    expect(payload.field.farmId).toBe(FARM_ID);
    expect(payload.categories).toHaveLength(1);
    expect(payload.categories[0].name).toBe('Soil Health');
    expect(payload.categories[0].totalQuestions).toBe(2);
  });

  it('walks list to summary to questions entirely offline', async () => {
    await warmCache();
    jest.spyOn(assessmentApi, 'getMyAssessmentFields').mockRejectedValue(networkError());
    jest.spyOn(assessmentApi, 'getAssessmentSummary').mockRejectedValue(networkError());
    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockRejectedValue(networkError());

    const list = await runList();
    const summary = await runSummary();
    const questions = await runQuestions();

    expect(list.type).toBe('assessment/myFields/fulfilled');
    expect(summary.type).toBe('assessment/fetchSummary/fulfilled');
    expect(questions.type).toBe('assessment/fetchCategoryQuestions/fulfilled');
    expect((questions.payload as CategoryQuestionList).questions).toHaveLength(2);
  });

  it('rejects when nothing has been cached', async () => {
    jest.spyOn(assessmentApi, 'getMyAssessmentFields').mockRejectedValue(networkError());
    const action = await runList();
    expect(action.type).toBe('assessment/myFields/rejected');
  });
});

describe('offline progress is reflected in cached views', () => {
  it('shows an offline answer in the list and summary counts', async () => {
    jest.spyOn(assessmentApi, 'getMyAssessmentFields').mockResolvedValue(serverList);
    await runList();
    jest.spyOn(assessmentApi, 'getAssessmentSummary').mockResolvedValue(serverSummary);
    await runSummary();
    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockResolvedValue(serverQuestions);
    await runQuestions();
    jest.restoreAllMocks();

    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(networkError());
    const saveState = state();
    saveState.assessment.summary = serverSummary;
    const save = saveAssessmentAnswerThunk({
      programId: PROGRAM_ID,
      fieldId: FIELD_ID,
      questionId: 'q1',
      input: { score: 3, comment: 'offline' },
    });
    await (save as never as (d: unknown, g: unknown, e: unknown) => Promise<unknown>)(
      jest.fn(),
      () => saveState,
      undefined,
    );

    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);

    jest.restoreAllMocks();
    jest.spyOn(assessmentApi, 'getMyAssessmentFields').mockRejectedValue(networkError());
    jest.spyOn(assessmentApi, 'getAssessmentSummary').mockRejectedValue(networkError());

    const list = await runList();
    const listPayload = list.payload as MyAssessmentsOverview;
    expect(listPayload.fields[0].answered).toBe(1);
    expect(listPayload.fields[0].status).toBe('IN_PROGRESS');

    const summary = await runSummary();
    const summaryPayload = summary.payload as FieldAssessmentSummary;
    expect(summaryPayload.categories[0].answered).toBe(1);
    expect(summaryPayload.categories[0].percentage).toBe(50);
  });

  it('does not let a later server read lower locally derived progress', async () => {
    jest.spyOn(assessmentApi, 'getMyAssessmentFields').mockResolvedValue(serverList);
    await runList();
    jest.spyOn(assessmentApi, 'getAssessmentSummary').mockResolvedValue(serverSummary);
    await runSummary();
    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockResolvedValue(serverQuestions);
    await runQuestions();
    jest.restoreAllMocks();

    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(networkError());
    const saveState = state();
    saveState.assessment.summary = serverSummary;
    const save = saveAssessmentAnswerThunk({
      programId: PROGRAM_ID,
      fieldId: FIELD_ID,
      questionId: 'q1',
      input: { score: 2 },
    });
    await (save as never as (d: unknown, g: unknown, e: unknown) => Promise<unknown>)(
      jest.fn(),
      () => saveState,
      undefined,
    );

    jest.restoreAllMocks();
    jest.spyOn(assessmentApi, 'getMyAssessmentFields').mockResolvedValue(serverList);
    await runList();

    jest.spyOn(assessmentApi, 'getMyAssessmentFields').mockRejectedValue(networkError());
    const list = await runList();
    const payload = list.payload as MyAssessmentsOverview;

    expect(payload.fields[0].answered).toBe(1);
  });
});
