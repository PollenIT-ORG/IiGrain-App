/**
 * The field summary and the review are each asked for from several triggers at
 * once - mount, re-focus, a saved answer bumping answerVersion, and a sync
 * event from the socket. Without a condition on the thunk every trigger became
 * its own request, which showed up as duplicate /summary calls in the device
 * log. These pin the guard: the same scope while one is in flight is skipped,
 * a different scope is not.
 */
import * as assessmentApi from '../src/api/assessmentApi';
import * as assessorApi from '../src/api/assessorApi';
import {
  fetchAssessmentReviewThunk,
  fetchAssessmentSummaryThunk,
} from '../src/redux/thunks/assessmentThunks';
import { fetchAssessorCategoryFormThunk } from '../src/redux/thunks/assessorThunks';

const PROGRAM_ID = 'prog-1';
const FIELD_ID = 'field-1';

interface ThunkAction {
  type: string;
  meta: { condition?: boolean };
}

const state = (over: Record<string, unknown> = {}) => () => ({
  auth: { user: { id: 'u1', role: 'farmer' } },
  assessment: {
    submitting: false,
    loadingSummary: false,
    requestedSummaryFieldId: null,
    loadingReview: false,
    requestedReviewFieldId: null,
    loadingQuestions: false,
    requestedCategoryScope: null,
    loadingCategoryForm: false,
    requestedCategoryFormScope: null,
    loadingRegenIndex: false,
    requestedRegenFieldId: null,
    summary: null,
    regenIndex: null,
    myFields: null,
    ...over,
  },
});

const run = (thunk: unknown, getState: () => unknown): Promise<ThunkAction> =>
  (thunk as (d: unknown, g: unknown, e: unknown) => Promise<ThunkAction>)(
    jest.fn(),
    getState,
    undefined,
  );

const scope = { programId: PROGRAM_ID, fieldId: FIELD_ID };

afterEach(() => {
  jest.restoreAllMocks();
});

describe('summary fetch dedupe', () => {
  it('skips a second fetch for the scope already in flight', async () => {
    const api = jest.spyOn(assessmentApi, 'getAssessmentSummary');

    const action = await run(
      fetchAssessmentSummaryThunk(scope),
      state({ loadingSummary: true, requestedSummaryFieldId: `${PROGRAM_ID}:${FIELD_ID}` }),
    );

    expect(action.meta.condition).toBe(true);
    expect(api).not.toHaveBeenCalled();
  });

  it('still fetches a different field while one is in flight', async () => {
    const api = jest
      .spyOn(assessmentApi, 'getAssessmentSummary')
      .mockRejectedValue(new Error('network disabled in test'));

    const action = await run(
      fetchAssessmentSummaryThunk(scope),
      state({ loadingSummary: true, requestedSummaryFieldId: 'other-program:other-field' }),
    );

    expect(action.meta.condition).not.toBe(true);
    expect(api).toHaveBeenCalledWith(PROGRAM_ID, FIELD_ID);
  });

  it('fetches when nothing is in flight', async () => {
    const api = jest
      .spyOn(assessmentApi, 'getAssessmentSummary')
      .mockRejectedValue(new Error('network disabled in test'));

    await run(fetchAssessmentSummaryThunk(scope), state());

    expect(api).toHaveBeenCalledTimes(1);
  });
});

describe('review fetch dedupe', () => {
  it('skips a second review fetch for the scope already in flight', async () => {
    const api = jest.spyOn(assessmentApi, 'getAssessmentReview');

    const action = await run(
      fetchAssessmentReviewThunk(scope),
      state({ loadingReview: true, requestedReviewFieldId: `${PROGRAM_ID}:${FIELD_ID}` }),
    );

    expect(action.meta.condition).toBe(true);
    expect(api).not.toHaveBeenCalled();
  });

  it('fetches the review when nothing is in flight', async () => {
    const api = jest
      .spyOn(assessmentApi, 'getAssessmentReview')
      .mockRejectedValue(new Error('network disabled in test'));

    await run(fetchAssessmentReviewThunk(scope), state());

    expect(api).toHaveBeenCalledTimes(1);
  });
});

/**
 * CategoryView is one screen shared by both roles, so the assessor hits the
 * same mount-plus-focus pair. Its thunks had no guard while the farmer's did.
 */
describe('assessor category form dedupe', () => {
  const CATEGORY_ID = 'cat-1';
  const formScope = { programId: PROGRAM_ID, fieldId: FIELD_ID, categoryId: CATEGORY_ID };

  const assessorState = (over: Record<string, unknown> = {}) => () => ({
    auth: { user: { id: 'u1', role: 'assessor' } },
    assessor: {
      loadingCategoryForm: false,
      requestedCategoryFormScope: null,
      loadingQuestions: false,
      requestedCategoryScope: null,
      ...over,
    },
  });

  it('skips a second form fetch for the category already in flight', async () => {
    const api = jest.spyOn(assessorApi, 'getCategoryQuestionSet');

    const action = await run(
      fetchAssessorCategoryFormThunk(formScope),
      assessorState({
        loadingCategoryForm: true,
        requestedCategoryFormScope: `${PROGRAM_ID}:${FIELD_ID}:${CATEGORY_ID}`,
      }),
    );

    expect(action.meta.condition).toBe(true);
    expect(api).not.toHaveBeenCalled();
  });

  it('still fetches a different category while one is in flight', async () => {
    const api = jest
      .spyOn(assessorApi, 'getCategoryQuestionSet')
      .mockRejectedValue(new Error('network disabled in test'));

    await run(
      fetchAssessorCategoryFormThunk(formScope),
      assessorState({
        loadingCategoryForm: true,
        requestedCategoryFormScope: `${PROGRAM_ID}:${FIELD_ID}:another-category`,
      }),
    );

    expect(api).toHaveBeenCalledWith(PROGRAM_ID, FIELD_ID, CATEGORY_ID);
  });
});
