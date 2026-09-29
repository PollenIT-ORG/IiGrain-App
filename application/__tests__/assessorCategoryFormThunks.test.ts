/**
 * Mirror of categoryFormThunks.test.ts for the assessor side.
 * fetchAssessorCategoryFormThunk and saveAssessorCategoryAnswersThunk are
 * plain try/catch pass-throughs to assessorApi with no SQLite involvement,
 * so a fake dispatch/getState is enough.
 */
import { AxiosError } from 'axios';
import * as assessorApi from '../src/api/assessorApi';
import {
  fetchAssessorCategoryFormThunk,
  saveAssessorCategoryAnswersThunk,
} from '../src/redux/thunks/assessorThunks';
import type { CategoryQuestionSet, SaveFormAnswerInput } from '../src/types/assessment';

const PROGRAM_ID = 'prog-1';
const FIELD_ID = 'field-1';
const CATEGORY_ID = 'cat-1';

const networkError = (): AxiosError => new AxiosError('Network Error', 'ERR_NETWORK');

const formSet: CategoryQuestionSet = {
  field: { id: FIELD_ID, name: 'North Plot' },
  category: { id: CATEGORY_ID, name: 'Soil health' },
  progress: { totalQuestions: 2, answered: 0, percentage: 0 },
  questionKind: 'input',
  records: [],
  evidenceUrls: [],
  questions: [],
};

const idleState = () => ({
  assessor: {
    loadingCategoryForm: false,
    requestedCategoryFormScope: null,
    loadingQuestions: false,
    requestedCategoryScope: null,
  },
});

const runFetch = () =>
  (fetchAssessorCategoryFormThunk({
    programId: PROGRAM_ID,
    fieldId: FIELD_ID,
    categoryId: CATEGORY_ID,
  }) as unknown as (d: unknown, g: unknown, e: unknown) => Promise<{ type: string; payload: unknown }>)(
    jest.fn(),
    idleState,
    undefined,
  );

const runSave = (answers: SaveFormAnswerInput[]) =>
  (saveAssessorCategoryAnswersThunk({
    programId: PROGRAM_ID,
    fieldId: FIELD_ID,
    categoryId: CATEGORY_ID,
    answers,
  }) as unknown as (d: unknown, g: unknown, e: unknown) => Promise<{ type: string; payload: unknown }>)(
    jest.fn(),
    idleState,
    undefined,
  );

afterEach(() => {
  jest.restoreAllMocks();
});

describe('fetchAssessorCategoryFormThunk', () => {
  it('resolves with the full per-field question set on success', async () => {
    jest.spyOn(assessorApi, 'getCategoryQuestionSet').mockResolvedValue(formSet);

    const action = await runFetch();

    expect(action.type).toBe('assessor/fetchCategoryForm/fulfilled');
    expect(action.payload).toEqual(formSet);
    expect(assessorApi.getCategoryQuestionSet).toHaveBeenCalledWith(
      PROGRAM_ID,
      FIELD_ID,
      CATEGORY_ID,
    );
  });

  it('rejects with a standardized error when the request fails', async () => {
    jest.spyOn(assessorApi, 'getCategoryQuestionSet').mockRejectedValue(networkError());

    const action = await runFetch();

    expect(action.type).toBe('assessor/fetchCategoryForm/rejected');
  });
});

describe('saveAssessorCategoryAnswersThunk', () => {
  const answers: SaveFormAnswerInput[] = [{ questionId: 'q1', answerText: 'Dark, crumbly soil' }];

  it('sends the batch and resolves with the refreshed question set', async () => {
    jest.spyOn(assessorApi, 'saveCategoryAnswers').mockResolvedValue(formSet);

    const action = await runSave(answers);

    expect(action.type).toBe('assessor/saveCategoryAnswers/fulfilled');
    expect(action.payload).toEqual(formSet);
    expect(assessorApi.saveCategoryAnswers).toHaveBeenCalledWith(
      PROGRAM_ID,
      FIELD_ID,
      CATEGORY_ID,
      { answers },
    );
  });

  it('rejects the whole batch when the server rejects it (all-or-nothing)', async () => {
    jest.spyOn(assessorApi, 'saveCategoryAnswers').mockRejectedValue(networkError());

    const action = await runSave(answers);

    expect(action.type).toBe('assessor/saveCategoryAnswers/rejected');
  });
});
