/**
 * fetchCategoryFormThunk and saveCategoryAnswersThunk back the input-based
 * bulk category-form flow (CategoryFormView). Unlike saveAssessmentAnswerThunk
 * they are online-only by design - no offline queue, no SQLite - so a plain
 * fake dispatch/getState is enough; the heavier op-sqlite harness used for
 * the per-question thunks isn't needed here.
 */
import { AxiosError } from 'axios';
import * as assessmentApi from '../src/api/assessmentApi';
import {
  fetchCategoryFormThunk,
  saveCategoryAnswersThunk,
} from '../src/redux/thunks/assessmentThunks';
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

const state = () => ({
  assessment: {
    loadingCategoryForm: false,
    requestedCategoryFormScope: null,
  },
});

const runFetch = () =>
  (fetchCategoryFormThunk({
    programId: PROGRAM_ID,
    fieldId: FIELD_ID,
    categoryId: CATEGORY_ID,
  }) as unknown as (d: unknown, g: unknown, e: unknown) => Promise<{ type: string; payload: unknown }>)(
    jest.fn(),
    state,
    undefined,
  );

const runSave = (answers: SaveFormAnswerInput[]) =>
  (saveCategoryAnswersThunk({
    programId: PROGRAM_ID,
    fieldId: FIELD_ID,
    categoryId: CATEGORY_ID,
    answers,
  }) as unknown as (d: unknown, g: unknown, e: unknown) => Promise<{ type: string; payload: unknown }>)(
    jest.fn(),
    state,
    undefined,
  );

afterEach(() => {
  jest.restoreAllMocks();
});

describe('fetchCategoryFormThunk', () => {
  it('resolves with the full per-field question set on success', async () => {
    jest.spyOn(assessmentApi, 'getCategoryQuestionSet').mockResolvedValue(formSet);

    const action = await runFetch();

    expect(action.type).toBe('assessment/fetchCategoryForm/fulfilled');
    expect(action.payload).toEqual(formSet);
    expect(assessmentApi.getCategoryQuestionSet).toHaveBeenCalledWith(
      PROGRAM_ID,
      FIELD_ID,
      CATEGORY_ID,
    );
  });

  it('rejects with a standardized error when the request fails', async () => {
    jest.spyOn(assessmentApi, 'getCategoryQuestionSet').mockRejectedValue(networkError());

    const action = await runFetch();

    expect(action.type).toBe('assessment/fetchCategoryForm/rejected');
  });
});

describe('saveCategoryAnswersThunk', () => {
  const answers: SaveFormAnswerInput[] = [{ questionId: 'q1', answerText: 'Dark, crumbly soil' }];

  it('sends the batch and resolves with the refreshed question set', async () => {
    jest.spyOn(assessmentApi, 'saveCategoryAnswers').mockResolvedValue(formSet);

    const action = await runSave(answers);

    expect(action.type).toBe('assessment/saveCategoryAnswers/fulfilled');
    expect(action.payload).toEqual(formSet);
    expect(assessmentApi.saveCategoryAnswers).toHaveBeenCalledWith(
      PROGRAM_ID,
      FIELD_ID,
      CATEGORY_ID,
      { answers },
    );
  });

  it('rejects the whole batch when the server rejects it (all-or-nothing)', async () => {
    jest.spyOn(assessmentApi, 'saveCategoryAnswers').mockRejectedValue(networkError());

    const action = await runSave(answers);

    expect(action.type).toBe('assessment/saveCategoryAnswers/rejected');
  });
});
