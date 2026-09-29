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
import {
  fetchCategoryQuestionsThunk,
  fetchQuestionDetailThunk,
  saveAssessmentAnswerThunk,
} from '../src/redux/thunks/assessmentThunks';
import type {
  AssessmentQuestionDetail,
  CategoryQuestionList,
} from '../src/types/assessment';

const USER_ID = 'farmer-read';
const OWNER = asOwnerUserId(USER_ID);
const FIELD_ID = 'srv-field-r';
const FARM_ID = 'srv-farm-r';
const PROGRAM_ID = 'prog-r';
const CATEGORY_ID = 'cat-r';

const networkError = (): AxiosError => new AxiosError('Network Error', 'ERR_NETWORK');

const state = () => ({
  auth: { user: { id: USER_ID, role: 'farmer' } },
  assessment: {
    submitting: false,
    loadingQuestions: false,
    requestedCategoryScope: null,
    loadingRegenIndex: false,
    requestedRegenFieldId: null,
    summary: {
      field: { id: FIELD_ID, name: 'Read Plot', farmId: FARM_ID, farmName: 'Read Farm' },
      assessment: { totalQuestions: 2 },
    },
    regenIndex: null,
    myFields: null,
  },
});

const serverList: CategoryQuestionList = {
  field: { id: FIELD_ID, name: 'Read Plot' },
  category: { id: CATEGORY_ID, name: 'Soil Health' },
  progress: { totalQuestions: 2, answered: 0, percentage: 0 },
  questions: [
    { id: 'q1', code: 'S1', text: 'Do you cover crop?', guidance: 'Guidance 1', answered: false },
    { id: 'q2', code: 'S2', text: 'Do you till?', guidance: 'Guidance 2', answered: false },
  ],
};

const serverDetail: AssessmentQuestionDetail = {
  id: 'q1',
  code: 'S1',
  text: 'Do you cover crop?',
  guidance: 'Guidance 1',
  questionType: 'scored',
  maxScore: 3,
  options: [],
  evidenceMode: 'optional',
  commentMode: 'optional',
  scoreDescriptions: [
    { score: 0, description: 'Never' },
    { score: 1, description: 'Rarely' },
    { score: 2, description: 'Often' },
    { score: 3, description: 'Always' },
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

const runList = () => {
  const thunk = fetchCategoryQuestionsThunk({
    programId: PROGRAM_ID,
    fieldId: FIELD_ID,
    categoryId: CATEGORY_ID,
  });
  return thunk(jest.fn(), (() => state()) as never, undefined);
};

const runDetail = (questionId = 'q1') => {
  const thunk = fetchQuestionDetailThunk({
    programId: PROGRAM_ID,
    fieldId: FIELD_ID,
    categoryId: CATEGORY_ID,
    questionId,
  });
  return thunk(jest.fn(), (() => state()) as never, undefined);
};

const runSave = (questionId: string, score: 0 | 1 | 2 | 3, comment: string) => {
  const thunk = saveAssessmentAnswerThunk({
    programId: PROGRAM_ID,
    fieldId: FIELD_ID,
    questionId,
    input: { score, comment },
  });
  return thunk(jest.fn(), (() => state()) as never, undefined);
};

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

describe('caching on successful online reads', () => {
  it('returns the server list unchanged and caches it', async () => {
    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockResolvedValue(serverList);

    const action = await runList();
    expect(action.type).toBe('assessment/fetchCategoryQuestions/fulfilled');
    expect(action.payload).toEqual(serverList);

    const { listQuestions } = require('../src/repositories');
    const cached = await listQuestions(OWNER, PROGRAM_ID, CATEGORY_ID);
    expect(cached).toHaveLength(2);
  });

  it('returns the server detail unchanged and caches score guidance', async () => {
    jest.spyOn(assessmentApi, 'getQuestionDetail').mockResolvedValue(serverDetail);

    const action = await runDetail();
    expect(action.payload).toEqual(serverDetail);

    const { listQuestions } = require('../src/repositories');
    const cached = await listQuestions(OWNER, PROGRAM_ID, CATEGORY_ID);
    expect(cached[0].score3_description).toBe('Always');
  });
});

describe('offline reads fall back to the cache', () => {
  it('serves the question list from cache when the network is down', async () => {
    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockResolvedValueOnce(serverList);
    await runList();

    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockRejectedValue(networkError());
    const action = await runList();

    expect(action.type).toBe('assessment/fetchCategoryQuestions/fulfilled');
    const payload = action.payload as CategoryQuestionList;
    expect(payload.questions.map(q => q.id)).toEqual(['q1', 'q2']);
    expect(payload.category.name).toBe('Soil Health');
  });

  it('serves the question detail with score guidance from cache', async () => {
    jest.spyOn(assessmentApi, 'getQuestionDetail').mockResolvedValueOnce(serverDetail);
    await runDetail();

    jest.spyOn(assessmentApi, 'getQuestionDetail').mockRejectedValue(networkError());
    const action = await runDetail();

    const payload = action.payload as AssessmentQuestionDetail;
    expect(payload.text).toBe('Do you cover crop?');
    expect(payload.scoreDescriptions[3].description).toBe('Always');
  });

  it('rejects when nothing has been cached yet', async () => {
    jest.spyOn(assessmentApi, 'getQuestionDetail').mockRejectedValue(networkError());

    const action = await runDetail();
    expect(action.type).toBe('assessment/fetchQuestionDetail/rejected');
  });
});

describe('an answer saved offline is visible offline', () => {
  it('shows the offline answer when the question is reopened', async () => {
    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockResolvedValueOnce(serverList);
    await runList();
    jest.spyOn(assessmentApi, 'getQuestionDetail').mockResolvedValueOnce(serverDetail);
    await runDetail();

    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(networkError());
    await runSave('q1', 3, 'answered offline');
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);

    jest.spyOn(assessmentApi, 'getQuestionDetail').mockRejectedValue(networkError());
    const action = await runDetail();

    const payload = action.payload as AssessmentQuestionDetail;
    expect(payload.answered).toBe(true);
    expect(payload.answerScore).toBe(3);
    expect(payload.answerComment).toBe('answered offline');
  });

  it('marks the question answered in the cached list', async () => {
    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockResolvedValueOnce(serverList);
    await runList();

    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(networkError());
    await runSave('q1', 2, 'offline');

    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockRejectedValue(networkError());
    const action = await runList();

    const payload = action.payload as CategoryQuestionList;
    expect(payload.questions.find(q => q.id === 'q1')?.answered).toBe(true);
    expect(payload.questions.find(q => q.id === 'q2')?.answered).toBe(false);
    expect(payload.progress.answered).toBe(1);
  });

  it('survives an app restart', async () => {
    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockResolvedValueOnce(serverList);
    await runList();
    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(networkError());
    await runSave('q1', 1, 'kept across restart');

    await closeDatabase();
    await initializeDatabase();

    jest.spyOn(assessmentApi, 'getQuestionDetail').mockRejectedValue(networkError());
    const action = await runDetail();

    const payload = action.payload as AssessmentQuestionDetail;
    expect(payload.answerComment).toBe('kept across restart');
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });
});

describe('a pending local answer is never overwritten by a server read', () => {
  it('keeps the local answer when the server returns a different one', async () => {
    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockResolvedValueOnce(serverList);
    await runList();

    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(networkError());
    await runSave('q1', 3, 'my offline answer');

    jest.spyOn(assessmentApi, 'getQuestionDetail').mockResolvedValue({
      ...serverDetail,
      answerScore: 0,
      answerComment: 'stale server answer',
      answered: true,
    });
    await runDetail();

    const { getAnswer, ensureAssessment, fieldRepository } = require('../src/repositories');
    const field = await fieldRepository.getByServerId(OWNER, FIELD_ID);
    const assessment = await ensureAssessment(OWNER, {
      programId: PROGRAM_ID,
      fieldLocalId: field.local_id,
      authorRole: 'farmer',
    });
    const stored = await getAnswer(OWNER, assessment.local_id, 'q1');

    expect(stored.score).toBe(3);
    expect(stored.comment).toBe('my offline answer');
    expect(stored.sync_state).not.toBe('synced');
  });
});
