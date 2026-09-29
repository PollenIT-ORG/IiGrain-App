import { AxiosError } from 'axios';
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
import { setSyncLogSink, syncQueue } from '../src/services/sync';
import * as assessmentApi from '../src/api/assessmentApi';
import * as assessorApi from '../src/api/assessorApi';
import {
  fetchAssessmentReviewThunk,
  fetchAssessmentSummaryThunk,
  fetchCategoryQuestionsThunk,
  fetchFieldHistoryThunk,
  fetchQuestionDetailThunk,
  refreshAssessmentSummaryThunk,
  saveAssessmentAnswerThunk,
} from '../src/redux/thunks/assessmentThunks';
import {
  fetchAssessorReviewThunk,
  fetchAssessorSummaryThunk,
} from '../src/redux/thunks/assessorThunks';
import {
  prepareAssessmentPackage,
  readAssessmentPackage,
  settleAssessmentPackages,
} from '../src/services/sync/assessmentPackage';
import type {
  AssessmentQuestionDetail,
  AssessmentReview,
  CategoryQuestionList,
  CategoryQuestionSet,
  FieldAssessmentSummary,
  QuestionScore,
} from '../src/types/assessment';
import type { AssessorReviewResult } from '../src/redux/thunks/assessorThunks';

const USER_ID = 'farmer-package';
const OWNER = asOwnerUserId(USER_ID);
const PROGRAM_ID = 'prog-p';
const FIELD_ID = 'srv-field-p';
const FARM_ID = 'srv-farm-p';

const QUESTIONS: Record<string, string[]> = {
  'cat-a': ['a1', 'a2'],
  'cat-b': ['b1', 'b2', 'b3'],
  'cat-c': ['c1'],
};

const networkError = (): AxiosError => new AxiosError('Network Error', 'ERR_NETWORK');

const summary: FieldAssessmentSummary = {
  field: { id: FIELD_ID, name: 'Package Plot', farmId: FARM_ID, farmName: 'Package Farm' },
  assessment: {
    title: 'Regen 2026',
    year: 2026,
    status: 'IN_PROGRESS',
    totalQuestions: 6,
    answered: 1,
    percentage: 17,
    submitted: false,
    questionKind: 'mcq',
  },
  categories: Object.entries(QUESTIONS).map(([id, ids]) => ({
    id,
    name: `Category ${id}`,
    totalQuestions: ids.length,
    answered: 0,
    percentage: 0,
    records: 0,
  })),
  canEdit: true,
  reviewStatus: null,
  program: { active: true, ended: false, endDate: null, assessmentOpen: true },
};

const detail = (
  id: string,
  score: QuestionScore | null = null,
): AssessmentQuestionDetail => ({
  id,
  code: id.toUpperCase(),
  text: `Question ${id}`,
  guidance: `Guidance ${id}`,
  questionType: 'scored',
  maxScore: 3,
  options: [],
  evidenceMode: 'optional',
  commentMode: 'optional',
  scoreDescriptions: ([0, 1, 2, 3] as QuestionScore[]).map(level => ({
    score: level,
    description: `${id} level ${level}`,
  })),
  answerScore: score,
  answerOptionId: null,
  answerOptionText: null,
  answerText: null,
  answerNumber: null,
  answerDate: null,
  answerBoolean: null,
  answerComment: score === null ? null : `server ${id}`,
  answerEvidenceUrls: [],
  reviewScore: null,
  finalScore: null,
  answered: score !== null,
  locked: false,
});

const setFor = (
  categoryId: string,
  answers: Record<string, QuestionScore> = {},
  limit?: number,
): CategoryQuestionSet => {
  const ids = QUESTIONS[categoryId].slice(0, limit);
  return {
    field: { id: FIELD_ID, name: 'Package Plot' },
    category: { id: categoryId, name: `Category ${categoryId}` },
    progress: { totalQuestions: ids.length, answered: 0, percentage: 0 },
    questionKind: 'mcq',
    records: [],
    evidenceUrls: [],
    questions: ids.map(id => detail(id, answers[id] ?? null)),
  };
};

const farmerState = () => ({
  auth: { user: { id: USER_ID, role: 'farmer', fullName: 'Asha' } },
  assessment: {
    submitting: false,
    loadingQuestions: false,
    requestedCategoryScope: null,
    loadingRegenIndex: false,
    requestedRegenFieldId: null,
    summary,
    regenIndex: null,
    myFields: null,
  },
});

const assessorState = () => ({
  auth: { user: { id: USER_ID, role: 'assessor', fullName: 'Asha Assessor' } },
  assessor: { fieldsOverview: null, summary, submitting: false, loadingFieldsOverview: false },
});

interface ThunkAction<T> {
  type: string;
  payload: T;
}

const run = <T>(thunk: unknown, state: () => unknown = farmerState): Promise<ThunkAction<T>> =>
  (thunk as (d: unknown, g: unknown, e: unknown) => Promise<ThunkAction<T>>)(
    jest.fn(),
    state,
    undefined,
  );

const scope = { programId: PROGRAM_ID, fieldId: FIELD_ID };

const openSummaryOnline = async (answers: Record<string, QuestionScore> = {}) => {
  jest.spyOn(assessmentApi, 'getAssessmentSummary').mockResolvedValue(summary);
  const loader = jest
    .spyOn(assessmentApi, 'getCategoryQuestionSet')
    .mockImplementation(async (_programId, _fieldId, categoryId) => setFor(categoryId, answers));
  const action = await run(fetchAssessmentSummaryThunk(scope));
  await settleAssessmentPackages();
  return { action, loader };
};

const goOffline = () => {
  jest.spyOn(assessmentApi, 'getAssessmentSummary').mockRejectedValue(networkError());
  jest.spyOn(assessmentApi, 'getCategoryQuestions').mockRejectedValue(networkError());
  jest.spyOn(assessmentApi, 'getQuestionDetail').mockRejectedValue(networkError());
  jest.spyOn(assessmentApi, 'getAssessmentReview').mockRejectedValue(networkError());
  jest.spyOn(assessmentApi, 'getFieldHistory').mockRejectedValue(networkError());
  jest.spyOn(assessmentApi, 'getCategoryQuestionSet').mockRejectedValue(networkError());
  jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(networkError());
};

const restartApp = async () => {
  await closeDatabase();
  await initializeDatabase();
};

const offlineDetail = (categoryId: string, questionId: string) =>
  run<AssessmentQuestionDetail>(
    fetchQuestionDetailThunk({ ...scope, categoryId, questionId }),
  );

const until = async (check: () => boolean): Promise<void> => {
  for (let i = 0; i < 200 && !check(); i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 2));
  }
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

describe('opening an assessment online prepares the whole offline package', () => {
  it('downloads every category once, from the summary alone', async () => {
    const list = jest.spyOn(assessmentApi, 'getCategoryQuestions');

    const { action, loader } = await openSummaryOnline();

    expect(action.type).toBe('assessment/fetchSummary/fulfilled');
    expect(loader).toHaveBeenCalledTimes(3);
    expect(loader.mock.calls.map(call => call[2]).sort()).toEqual(['cat-a', 'cat-b', 'cat-c']);
    expect(list).not.toHaveBeenCalled();
    await expect(readAssessmentPackage(OWNER, PROGRAM_ID, FIELD_ID, 'farmer')).resolves.toMatchObject({
      status: 'READY',
      categoryCount: 3,
      questionCount: 6,
      failedCategories: 0,
    });
  });

  it('serves every category and question after a restart, none opened before', async () => {
    await openSummaryOnline({ b3: 2 });
    await restartApp();
    goOffline();

    for (const [categoryId, ids] of Object.entries(QUESTIONS)) {
      const action = await run<CategoryQuestionList>(
        fetchCategoryQuestionsThunk({ ...scope, categoryId }),
      );
      expect(action.type).toBe('assessment/fetchCategoryQuestions/fulfilled');
      expect(action.payload.questions.map(q => q.id)).toEqual(ids);
    }

    const question = await offlineDetail('cat-b', 'b3');
    expect(question.type).toBe('assessment/fetchQuestionDetail/fulfilled');
    expect(question.payload.text).toBe('Question b3');
    expect(question.payload.guidance).toBe('Guidance b3');
    expect(question.payload.scoreDescriptions.map(s => s.description)).toEqual([
      'b3 level 0',
      'b3 level 1',
      'b3 level 2',
      'b3 level 3',
    ]);
    expect(question.payload.answerScore).toBe(2);
    expect(question.payload.answerComment).toBe('server b3');
  });

  it('counts existing server answers in the offline summary', async () => {
    await openSummaryOnline({ a1: 1, b2: 3 });
    await restartApp();
    goOffline();

    const action = await run<FieldAssessmentSummary>(fetchAssessmentSummaryThunk(scope));

    expect(action.type).toBe('assessment/fetchSummary/fulfilled');
    const answered = Object.fromEntries(action.payload.categories.map(c => [c.id, c.answered]));
    expect(answered).toEqual({ 'cat-a': 1, 'cat-b': 1, 'cat-c': 0 });
  });

  it('keeps score descriptions when a category list is opened online later', async () => {
    await openSummaryOnline();
    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockResolvedValue({
      field: { id: FIELD_ID, name: 'Package Plot' },
      category: { id: 'cat-a', name: 'Category cat-a' },
      progress: { totalQuestions: 2, answered: 0, percentage: 0 },
      questions: QUESTIONS['cat-a'].map(id => ({
        id,
        code: id.toUpperCase(),
        text: `Question ${id}`,
        guidance: `Guidance ${id}`,
        answered: false,
      })),
    });
    await run(fetchCategoryQuestionsThunk({ ...scope, categoryId: 'cat-a' }));
    goOffline();

    const question = await offlineDetail('cat-a', 'a2');

    expect(question.payload.scoreDescriptions[3].description).toBe('a2 level 3');
  });

  it('serves the review offline once the package is ready', async () => {
    await openSummaryOnline({ a1: 1, c1: 0 });
    await restartApp();
    goOffline();

    const action = await run<AssessmentReview>(fetchAssessmentReviewThunk(scope));

    expect(action.type).toBe('assessment/fetchReview/fulfilled');
    expect(action.payload.submission).toMatchObject({ totalQuestions: 6, answered: 2 });
    expect(action.payload.categories.map(c => c.totalQuestions)).toEqual([2, 3, 1]);
  });

  it('serves the field history offline once the package is ready', async () => {
    await openSummaryOnline({ a1: 1, c1: 0 });
    await restartApp();
    goOffline();

    const action = await run<AssessmentReview>(fetchFieldHistoryThunk(scope));

    expect(action.type).toBe('assessment/fetchFieldHistory/fulfilled');
    expect(action.payload.submission).toMatchObject({ totalQuestions: 6, answered: 2 });
    expect(action.payload.categories.map(c => c.totalQuestions)).toEqual([2, 3, 1]);
  });
});

describe('package completeness is honest', () => {
  const prepare = (
    load: (categoryId: string) => Promise<CategoryQuestionSet>,
    force = false,
  ) =>
    prepareAssessmentPackage(
      OWNER,
      { programId: PROGRAM_ID, fieldServerId: FIELD_ID, farmServerId: FARM_ID, authorRole: 'farmer' },
      summary,
      load,
      { force },
    );

  it('is PARTIAL when a category cannot be downloaded', async () => {
    const report = await prepare(async categoryId => {
      if (categoryId === 'cat-b') {
        throw networkError();
      }
      return setFor(categoryId);
    });

    expect(report).toMatchObject({ status: 'PARTIAL', failedCategories: 1, questionCount: 3 });
  });

  it('does not offer a review from a PARTIAL package', async () => {
    await prepare(async categoryId => {
      if (categoryId === 'cat-c') {
        throw networkError();
      }
      return setFor(categoryId);
    });
    goOffline();

    const action = await run(fetchAssessmentReviewThunk(scope));

    expect(action.type).toBe('assessment/fetchReview/rejected');
  });

  it('is PARTIAL when a category returns fewer questions than the summary promised', async () => {
    const report = await prepare(async categoryId => setFor(categoryId, {}, categoryId === 'cat-b' ? 2 : undefined));

    expect(report.status).toBe('PARTIAL');
    expect(report.failedCategories).toBe(0);
  });

  it('keeps a READY package READY when a later refresh partly fails', async () => {
    const first = await prepare(async categoryId => setFor(categoryId));
    await new Promise<void>(resolve => setTimeout(resolve, 5));

    const second = await prepare(async categoryId => {
      if (categoryId === 'cat-a') {
        throw networkError();
      }
      return setFor(categoryId);
    }, true);

    expect(second.status).toBe('READY');
    expect(second.failedCategories).toBe(1);
    expect(second.preparedAt).toBe(first.preparedAt);
  });

  it('does not download again while fresh, but does when forced', async () => {
    const load = jest.fn(async (categoryId: string) => setFor(categoryId));
    await prepare(load);
    await prepare(load);
    expect(load).toHaveBeenCalledTimes(3);

    await prepare(load, true);
    expect(load).toHaveBeenCalledTimes(6);
  });

  it('shares one download between callers that ask at the same time', async () => {
    const load = jest.fn(async (categoryId: string) => setFor(categoryId));

    await Promise.all([prepare(load), prepare(load), prepare(load)]);

    expect(load).toHaveBeenCalledTimes(3);
  });

  it('writes a large package in a single transaction, quickly', async () => {
    const categories = Array.from({ length: 12 }, (_, c) => ({
      id: `big-${c}`,
      name: `Big ${c}`,
      totalQuestions: 10,
      answered: 0,
      percentage: 0,
      records: 0,
    }));
    const bigSummary = { ...summary, categories };
    const transaction = jest.spyOn(getDatabase(), 'transaction');
    const started = Date.now();

    const report = await prepareAssessmentPackage(
      OWNER,
      { programId: PROGRAM_ID, fieldServerId: FIELD_ID, farmServerId: FARM_ID, authorRole: 'farmer' },
      bigSummary,
      async categoryId => ({
        field: { id: FIELD_ID, name: 'Package Plot' },
        category: { id: categoryId, name: categoryId },
        progress: { totalQuestions: 10, answered: 0, percentage: 0 },
        questionKind: 'mcq',
        records: [],
        evidenceUrls: [],
        questions: Array.from({ length: 10 }, (_, q) =>
          detail(`${categoryId}-q${q}`, q % 2 === 0 ? 2 : null),
        ),
      }),
    );
    const elapsed = Date.now() - started;

    expect(report).toMatchObject({ status: 'READY', questionCount: 120, answerCount: 60 });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeLessThan(10000);
  });
});

describe('local work always wins over the package', () => {
  it('keeps an answer saved offline through a restart and a stale refresh', async () => {
    await openSummaryOnline({ a1: 1 });
    goOffline();
    const saved = await run(
      saveAssessmentAnswerThunk({ ...scope, questionId: 'a1', input: { score: 3, comment: 'field note' } }),
    );
    expect(saved.type).toBe('assessment/saveAnswer/fulfilled');

    await restartApp();
    jest.restoreAllMocks();
    jest.spyOn(assessmentApi, 'getAssessmentSummary').mockResolvedValue(summary);
    jest
      .spyOn(assessmentApi, 'getCategoryQuestionSet')
      .mockImplementation(async (_p, _f, categoryId) => setFor(categoryId, { a1: 1 }));
    await run(refreshAssessmentSummaryThunk(scope));
    await settleAssessmentPackages();
    goOffline();

    const question = await offlineDetail('cat-a', 'a1');

    expect(question.payload.answerScore).toBe(3);
    expect(question.payload.answerComment).toBe('field note');
    await expect(syncQueue.countPending(OWNER)).resolves.toBeGreaterThan(0);
  });

  it('ignores a server response that began before a newer local save', async () => {
    await openSummaryOnline({ a2: 0 });

    let release: ((set: CategoryQuestionSet) => void) | null = null;
    jest.spyOn(assessmentApi, 'getAssessmentSummary').mockResolvedValue(summary);
    jest.spyOn(assessmentApi, 'getCategoryQuestionSet').mockImplementation(
      (_p, _f, categoryId) =>
        categoryId === 'cat-a'
          ? new Promise<CategoryQuestionSet>(resolve => {
              release = resolve;
            })
          : Promise.resolve(setFor(categoryId, { a2: 0 })),
    );
    await run(refreshAssessmentSummaryThunk(scope));
    await until(() => release !== null);
    await new Promise<void>(resolve => setTimeout(resolve, 5));

    jest.spyOn(assessmentApi, 'saveAnswer').mockResolvedValue({
      id: 'srv-answer',
      fieldId: FIELD_ID,
      questionId: 'a2',
      questionType: 'scored' as const,
      score: 2,
      optionId: null,
      answerText: null,
      answerNumber: null,
      answerDate: null,
      answerBoolean: null,
      comment: 'newer',
      evidenceUrls: [],
      createdAtISO: '2026-09-14T00:00:00Z',
      updatedAtISO: '2026-09-14T00:00:00Z',
    });
    await run(saveAssessmentAnswerThunk({ ...scope, questionId: 'a2', input: { score: 2, comment: 'newer' } }));

    (release as unknown as (set: CategoryQuestionSet) => void)(setFor('cat-a', { a2: 0 }));
    await settleAssessmentPackages();
    goOffline();

    const question = await offlineDetail('cat-a', 'a2');

    expect(question.payload.answerScore).toBe(2);
    expect(question.payload.answerComment).toBe('newer');
  });

  it('mirrors an answer saved online so it is right offline later', async () => {
    await openSummaryOnline({ b1: 0 });
    jest.spyOn(assessmentApi, 'saveAnswer').mockResolvedValue({
      id: 'srv-b1',
      fieldId: FIELD_ID,
      questionId: 'b1',
      questionType: 'scored' as const,
      score: 3,
      optionId: null,
      answerText: null,
      answerNumber: null,
      answerDate: null,
      answerBoolean: null,
      comment: 'updated online',
      evidenceUrls: [],
      createdAtISO: '2026-09-14T00:00:00Z',
      updatedAtISO: '2026-09-14T00:00:00Z',
    });
    await run(saveAssessmentAnswerThunk({ ...scope, questionId: 'b1', input: { score: 3, comment: 'updated online' } }));
    await restartApp();
    goOffline();

    const question = await offlineDetail('cat-b', 'b1');

    expect(question.payload.answerScore).toBe(3);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
  });
});

describe('assessors get their own package', () => {
  it('prepares through the assessor endpoint and never mixes with the farmer copy', async () => {
    jest
      .spyOn(assessorApi, 'getSummary')
      .mockResolvedValue({ summary, submittedBy: null, locked: false });
    const loader = jest
      .spyOn(assessorApi, 'getCategoryQuestionSet')
      .mockImplementation(async (_p, _f, categoryId) => setFor(categoryId, { a1: 2 }));
    const farmerLoader = jest.spyOn(assessmentApi, 'getCategoryQuestionSet');

    await run(fetchAssessorSummaryThunk(scope), assessorState);
    await settleAssessmentPackages();

    expect(loader).toHaveBeenCalledTimes(3);
    expect(farmerLoader).not.toHaveBeenCalled();
    await expect(readAssessmentPackage(OWNER, PROGRAM_ID, FIELD_ID, 'assessor')).resolves.toMatchObject({ status: 'READY' });
    await expect(readAssessmentPackage(OWNER, PROGRAM_ID, FIELD_ID, 'farmer')).resolves.toMatchObject({ status: 'MISSING' });
  });

  it('serves the assessor review offline', async () => {
    jest
      .spyOn(assessorApi, 'getSummary')
      .mockResolvedValue({ summary, submittedBy: null, locked: false });
    jest
      .spyOn(assessorApi, 'getCategoryQuestionSet')
      .mockImplementation(async (_p, _f, categoryId) => setFor(categoryId, { a1: 2 }));
    await run(fetchAssessorSummaryThunk(scope), assessorState);
    await settleAssessmentPackages();
    await restartApp();
    jest.spyOn(assessorApi, 'getReview').mockRejectedValue(networkError());

    const action = await run<AssessorReviewResult>(fetchAssessorReviewThunk(scope), assessorState);

    expect(action.type).toBe('assessor/fetchReview/fulfilled');
    expect(action.payload.review.submission.answered).toBe(1);
    expect(action.payload.submittedBy).toBeNull();
  });
});

describe('the offline summary header stays in step with the answers', () => {
  const savedAnswer = (questionId: string, score: QuestionScore) => ({
    id: `srv-${questionId}`,
    fieldId: FIELD_ID,
    questionId,
    questionType: 'scored' as const,
    score,
    optionId: null,
    answerText: null,
    answerNumber: null,
    answerDate: null,
    answerBoolean: null,
    comment: '',
    evidenceUrls: [],
    createdAtISO: '2026-09-14T00:00:00Z',
    updatedAtISO: '2026-09-14T00:00:00Z',
  });

  const offlineSummary = async () => {
    goOffline();
    return run<FieldAssessmentSummary>(fetchAssessmentSummaryThunk(scope));
  };

  it('counts an answer saved online after the package was prepared', async () => {
    await openSummaryOnline({ a1: 1 });
    jest.spyOn(assessmentApi, 'saveAnswer').mockResolvedValue(savedAnswer('b1', 3));
    await run(saveAssessmentAnswerThunk({ ...scope, questionId: 'b1', input: { score: 3 } }));
    await restartApp();

    const action = await offlineSummary();

    expect(action.payload.assessment.answered).toBe(2);
    expect(action.payload.assessment.percentage).toBe(33);
  });

  it('never lowers the server count when the package could not be prepared', async () => {
    const partlyAnswered: FieldAssessmentSummary = {
      ...summary,
      assessment: { ...summary.assessment, answered: 4, percentage: 67 },
    };
    jest.spyOn(assessmentApi, 'getAssessmentSummary').mockResolvedValue(partlyAnswered);
    jest.spyOn(assessmentApi, 'getCategoryQuestionSet').mockRejectedValue(networkError());
    await run(fetchAssessmentSummaryThunk(scope));
    await settleAssessmentPackages();
    jest.spyOn(assessmentApi, 'saveAnswer').mockResolvedValue(savedAnswer('b1', 3));
    await run(saveAssessmentAnswerThunk({ ...scope, questionId: 'b1', input: { score: 3 } }));

    const action = await offlineSummary();

    expect(action.payload.assessment.answered).toBe(4);
  });

  it('catches up once a package arrives beside answers that are still unsent', async () => {
    goOffline();
    await run(saveAssessmentAnswerThunk({ ...scope, questionId: 'a1', input: { score: 2 } }));
    jest.restoreAllMocks();
    const answeredOnServer: FieldAssessmentSummary = {
      ...summary,
      assessment: { ...summary.assessment, answered: 3, percentage: 50 },
    };
    jest.spyOn(assessmentApi, 'getAssessmentSummary').mockResolvedValue(answeredOnServer);
    jest
      .spyOn(assessmentApi, 'getCategoryQuestionSet')
      .mockImplementation(async (_p, _f, categoryId) =>
        setFor(categoryId, { b1: 1, b2: 2, c1: 0 }),
      );
    await run(fetchAssessmentSummaryThunk(scope));
    await settleAssessmentPackages();

    const action = await offlineSummary();

    expect(action.payload.assessment.answered).toBe(4);
    await expect(syncQueue.countPending(OWNER)).resolves.toBeGreaterThan(0);
  });
});
