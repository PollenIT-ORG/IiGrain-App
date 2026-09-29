import { AxiosError, AxiosHeaders } from 'axios';
import { open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  initializeDatabase,
} from '../src/services/db';
import { upsertLocalUser } from '../src/repositories/userRepository';
import { answerRepository, assessmentRepository } from '../src/repositories';
import {
  ASSESSMENT_SUBMIT_ENTITY_TYPE,
  assessmentAnswerAdapter,
  assessmentSubmitAdapter,
  createSyncEngine,
  optimisticConnectivity,
  setSyncLogSink,
  syncQueue,
} from '../src/services/sync';
import { cacheAssessmentSummary } from '../src/services/sync/assessmentListCache';
import { settleAssessmentPackages } from '../src/services/sync/assessmentPackage';
import { syncHttp } from '../src/services/sync/syncHttp';
import * as assessorApi from '../src/api/assessorApi';
import {
  fetchAssessorCategoryQuestionsThunk,
  fetchAssessorQuestionDetailThunk,
  fetchAssessorSummaryThunk,
  refreshAssessorSummaryThunk,
  saveAssessorAnswerThunk,
  submitAssessorAssessmentThunk,
} from '../src/redux/thunks/assessorThunks';
import type { AssessorSubmitResult } from '../src/redux/thunks/assessorThunks';
import type {
  AssessmentQuestionDetail,
  AssessmentSubmitResult,
  CategoryQuestionList,
  FieldAssessmentSummary,
} from '../src/types/assessment';
import type { AssessorAssessmentSummary } from '../src/types/assessor';

const USER_ID = 'assessor-field';
const OWNER = asOwnerUserId(USER_ID);
const FIELD_ID = 'srv-field-a';
const FARM_ID = 'srv-farm-a';
const PROGRAM_ID = 'prog-a';
const CATEGORY_ID = 'cat-a';

const networkError = (): AxiosError => new AxiosError('Network Error', 'ERR_NETWORK');

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

const assessorSummary: AssessorAssessmentSummary = {
  summary: serverSummary,
  submittedBy: null,
  locked: false,
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

const serverDetail: AssessmentQuestionDetail = {
  id: 'q1',
  code: 'S1',
  text: 'Cover crops?',
  guidance: 'g1',
  questionType: 'scored',
  maxScore: 3,
  options: [],
  evidenceMode: 'optional',
  commentMode: 'optional',
  scoreDescriptions: [
    { score: 0, description: 'None' },
    { score: 3, description: 'All year' },
  ],
  answerScore: null,
  answerOptionId: null,
  answerOptionText: null,
  answerText: null,
  answerNumber: null,
  answerDate: null,
  answerBoolean: null,
  answerComment: null,
  answerEvidenceUrls: [],
  reviewScore: null,
  finalScore: null,
  answered: false,
  locked: false,
};

const submitResult: AssessmentSubmitResult = {
  field: { id: FIELD_ID, name: 'North Plot' },
  assessmentId: 'srv-assessment-a',
  status: 'COMPLETED',
  totalQuestions: 2,
  answered: 2,
  totalScore: 5,
  maxScore: 6,
  percentage: 83,
  submittedAtISO: '2026-09-14T00:00:00Z',
  reviewStatus: null,
  reviewedAtISO: null,
  reviewNote: null,
};

const baseState = {
  auth: { user: { id: USER_ID, fullName: 'Asha Assessor', role: 'assessor' } },
  assessor: {
    fieldsOverview: null,
    summary: serverSummary,
    submitting: false,
    loadingFieldsOverview: false,
  },
};

const state = () => JSON.parse(JSON.stringify(baseState));

const run = <T>(thunk: T) =>
  (thunk as never as (d: unknown, g: unknown, e: unknown) => Promise<{
    type: string;
    payload: unknown;
  }>)(jest.fn(), () => state(), undefined);

const scope = { programId: PROGRAM_ID, fieldId: FIELD_ID };

let calls: { url: string; method: string }[] = [];

const installSyncAdapter = (): void => {
  syncHttp.defaults.adapter = async config => {
    const method = (config.method ?? '').toLowerCase();
    calls.push({ url: config.url ?? '', method });
    const data =
      method === 'put'
        ? { data: { response: { id: 'srv-answer-a', updated_at: '2026-09-14T00:00:00Z' } } }
        : { data: { assessment: { id: 'srv-assessment-a', submitted_at: '2026-09-14T00:00:00Z' } } };
    return {
      data,
      status: 200,
      statusText: 'ok',
      headers: new AxiosHeaders(),
      config,
    } as never;
  };
};

const engine = () =>
  createSyncEngine({
    connectivity: optimisticConnectivity,
    adapters: [assessmentAnswerAdapter, assessmentSubmitAdapter],
  });

const saveOffline = async () => {
  jest.spyOn(assessorApi, 'saveAnswer').mockRejectedValue(networkError());
  return run(
    saveAssessorAnswerThunk({
      programId: PROGRAM_ID,
      fieldId: FIELD_ID,
      questionId: 'q1',
      input: { score: 2, comment: 'Seen on site' },
    }),
  );
};

const submitOffline = async () => {
  jest.spyOn(assessorApi, 'submit').mockRejectedValue(networkError());
  return run(submitAssessorAssessmentThunk(scope));
};

beforeEach(async () => {
  setSyncLogSink(() => {});
  jest.restoreAllMocks();
  jest.spyOn(assessorApi, 'getCategoryQuestionSet').mockRejectedValue(networkError());
  calls = [];
  installSyncAdapter();
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

describe('an assessor saving answers in the field', () => {
  it('accepts an answer with no connection', async () => {
    const action = await saveOffline();

    expect(action.type).toBe('assessor/saveAnswer/fulfilled');
  });

  it('records the answer under the assessor role and queues it', async () => {
    await saveOffline();

    const [answer] = await answerRepository.list(OWNER);
    expect(answer.author_role).toBe('assessor');
    expect(answer.score).toBe(2);

    const pending = await syncQueue.listPending(OWNER);
    expect(pending.map(e => e.entity_type)).toContain('assessment_answer');
  });

  it('syncs the answer to the assessor endpoint, not the farmer one', async () => {
    await saveOffline();

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls.map(c => c.url)).toEqual([
      `/assessor/programs/${PROGRAM_ID}/fields/${FIELD_ID}/questions/q1/answer`,
    ]);
  });
});

describe('an assessor submitting with no connection', () => {
  it('accepts the submission and locks the assessment', async () => {
    const action = await submitOffline();

    expect(action.type).toBe('assessor/submit/fulfilled');
    const payload = action.payload as AssessorSubmitResult;
    expect(payload.locked).toBe(true);
    expect(payload.summary.assessment.submitted).toBe(true);
    expect(payload.submittedBy?.role).toBe('assessor');
  });

  it('marks the assessor assessment as waiting to submit and queues it', async () => {
    await submitOffline();

    const [assessment] = await assessmentRepository.list(OWNER);
    expect(assessment.author_role).toBe('assessor');
    expect(assessment.submit_pending).toBe(1);

    const pending = await syncQueue.listPending(OWNER);
    expect(pending.map(e => e.entity_type)).toContain(ASSESSMENT_SUBMIT_ENTITY_TYPE);
  });

  it('syncs the submission to the assessor submit endpoint', async () => {
    await submitOffline();

    const result = await engine().flush(OWNER);

    expect(result.succeeded).toBe(1);
    expect(calls.map(c => c.url)).toEqual([
      `/assessor/programs/${PROGRAM_ID}/fields/${FIELD_ID}/submit`,
    ]);
  });

  it('keeps the online submit result unchanged', async () => {
    jest.spyOn(assessorApi, 'submit').mockResolvedValue(submitResult);

    const action = await run(submitAssessorAssessmentThunk(scope));

    const payload = action.payload as AssessorSubmitResult;
    expect(payload.scorePercentage).toBe(83);
    expect(payload.submittedAtISO).toBe('2026-09-14T00:00:00Z');
    expect(payload.locked).toBe(true);
    expect(payload.summary.assessment.percentage).toBe(100);
    expect(payload.result).toEqual(submitResult);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
  });
});

describe('an assessor reading an assessment offline', () => {
  const warmSummary = async () => {
    jest.spyOn(assessorApi, 'getSummary').mockResolvedValueOnce(assessorSummary);
    await run(fetchAssessorSummaryThunk(scope));
  };

  it('serves the summary seen online', async () => {
    await warmSummary();
    jest.spyOn(assessorApi, 'getSummary').mockRejectedValue(networkError());

    const action = await run(fetchAssessorSummaryThunk(scope));

    expect(action.type).toBe('assessor/fetchSummary/fulfilled');
    const payload = action.payload as AssessorAssessmentSummary;
    expect(payload.summary.field.name).toBe('North Plot');
    expect(payload.locked).toBe(false);
  });

  it('serves the same cache on pull to refresh', async () => {
    await warmSummary();
    jest.spyOn(assessorApi, 'getSummary').mockRejectedValue(networkError());

    const action = await run(refreshAssessorSummaryThunk(scope));

    expect(action.type).toBe('assessor/refreshSummary/fulfilled');
  });

  it('reads a summary submitted offline back as locked', async () => {
    await warmSummary();
    await submitOffline();
    jest.spyOn(assessorApi, 'getSummary').mockRejectedValue(networkError());

    const action = await run(fetchAssessorSummaryThunk(scope));

    const payload = action.payload as AssessorAssessmentSummary;
    expect(payload.locked).toBe(true);
    expect(payload.submittedBy?.role).toBe('assessor');
  });

  it('never serves the farmer cached summary to the assessor', async () => {
    await cacheAssessmentSummary(OWNER, PROGRAM_ID, serverSummary, 'farmer');
    jest.spyOn(assessorApi, 'getSummary').mockRejectedValue(networkError());

    const action = await run(fetchAssessorSummaryThunk(scope));

    expect(action.type).toBe('assessor/fetchSummary/rejected');
  });

  it('rejects when nothing has been cached', async () => {
    jest.spyOn(assessorApi, 'getSummary').mockRejectedValue(networkError());

    const action = await run(fetchAssessorSummaryThunk(scope));

    expect(action.type).toBe('assessor/fetchSummary/rejected');
  });

  it('serves the category questions seen online', async () => {
    const args = { ...scope, categoryId: CATEGORY_ID };
    jest.spyOn(assessorApi, 'getCategoryQuestions').mockResolvedValueOnce(serverQuestions);
    await run(fetchAssessorCategoryQuestionsThunk(args));
    jest.spyOn(assessorApi, 'getCategoryQuestions').mockRejectedValue(networkError());

    const action = await run(fetchAssessorCategoryQuestionsThunk(args));

    expect(action.type).toBe('assessor/fetchCategoryQuestions/fulfilled');
    expect((action.payload as CategoryQuestionList).questions).toHaveLength(2);
  });

  it('serves the question detail seen online', async () => {
    const args = { ...scope, categoryId: CATEGORY_ID, questionId: 'q1' };
    jest.spyOn(assessorApi, 'getQuestion').mockResolvedValueOnce(serverDetail);
    await run(fetchAssessorQuestionDetailThunk(args));
    jest.spyOn(assessorApi, 'getQuestion').mockRejectedValue(networkError());

    const action = await run(fetchAssessorQuestionDetailThunk(args));

    expect(action.type).toBe('assessor/fetchQuestionDetail/fulfilled');
    expect((action.payload as AssessmentQuestionDetail).text).toBe('Cover crops?');
  });
});
