/**
 * The record thunks back the multi-entry input form: one input-based category
 * can be filled in many times (Trainings, for example). All three endpoints
 * answer with the whole category payload, so the reducer can swap the form in
 * without a refetch - these tests pin that contract for both roles.
 */
import { AxiosError } from 'axios';
import * as assessmentApi from '../src/api/assessmentApi';
import * as assessorApi from '../src/api/assessorApi';
import {
  addCategoryRecordThunk,
  saveCategoryRecordThunk,
  deleteCategoryRecordThunk,
} from '../src/redux/thunks/assessmentThunks';
import {
  addAssessorCategoryRecordThunk,
  saveAssessorCategoryRecordThunk,
  deleteAssessorCategoryRecordThunk,
} from '../src/redux/thunks/assessorThunks';
import type {
  AssessmentRecord,
  CategoryQuestionSet,
  SaveFormAnswerInput,
} from '../src/types/assessment';

const PROGRAM_ID = 'prog-1';
const FIELD_ID = 'field-1';
const CATEGORY_ID = 'cat-1';
const RECORD_ID = 'rec-1';

const answers: SaveFormAnswerInput[] = [
  { questionId: 'q-1', answerText: 'Drip irrigation basics' },
];

const record = (id: string, number: number): AssessmentRecord => ({
  id,
  number,
  evidenceUrls: [],
  createdAtISO: '2026-01-01T00:00:00.000Z',
  updatedAtISO: '2026-01-01T00:00:00.000Z',
  answers: [
    {
      questionId: 'q-1',
      score: null,
      optionId: null,
      optionText: null,
      answerText: 'Drip irrigation basics',
      answerNumber: null,
      answerDate: null,
      answerBoolean: null,
      comment: null,
      evidenceUrls: [],
    },
  ],
});

const setWith = (records: AssessmentRecord[]): CategoryQuestionSet => ({
  field: { id: FIELD_ID, name: 'North Plot' },
  category: { id: CATEGORY_ID, name: 'Trainings' },
  progress: { totalQuestions: 1, answered: records.length > 0 ? 1 : 0, percentage: 0 },
  questionKind: 'input',
  records,
  evidenceUrls: [],
  questions: [],
});

const networkError = (): AxiosError => new AxiosError('Network Error', 'ERR_NETWORK');

type ThunkRun = (d: unknown, g: unknown, e: unknown) => Promise<{ type: string; payload: unknown }>;

const state = () => ({
  assessment: { loadingCategoryForm: false, requestedCategoryFormScope: null },
  assessor: { loadingCategoryForm: false, requestedCategoryFormScope: null },
});

const run = (action: unknown) => (action as unknown as ThunkRun)(jest.fn(), state, undefined);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('addCategoryRecordThunk', () => {
  it('posts a new record and resolves with the refreshed category', async () => {
    const payload = setWith([record(RECORD_ID, 1)]);
    const spy = jest.spyOn(assessmentApi, 'addCategoryRecord').mockResolvedValue(payload);

    const action = await run(
      addCategoryRecordThunk({
        programId: PROGRAM_ID,
        fieldId: FIELD_ID,
        categoryId: CATEGORY_ID,
        answers,
      }),
    );

    expect(spy).toHaveBeenCalledWith(PROGRAM_ID, FIELD_ID, CATEGORY_ID, { answers });
    expect(action.type).toBe(addCategoryRecordThunk.fulfilled.type);
    expect(action.payload).toBe(payload);
  });

  it('rejects with a message when the request fails', async () => {
    jest.spyOn(assessmentApi, 'addCategoryRecord').mockRejectedValue(networkError());

    const action = await run(
      addCategoryRecordThunk({
        programId: PROGRAM_ID,
        fieldId: FIELD_ID,
        categoryId: CATEGORY_ID,
        answers,
      }),
    );

    expect(action.type).toBe(addCategoryRecordThunk.rejected.type);
    expect((action.payload as { message?: string }).message).toBeTruthy();
  });
});

describe('saveCategoryRecordThunk', () => {
  it('targets the record being edited, not the first one', async () => {
    const payload = setWith([record('rec-0', 1), record(RECORD_ID, 2)]);
    const spy = jest.spyOn(assessmentApi, 'updateCategoryRecord').mockResolvedValue(payload);

    const action = await run(
      saveCategoryRecordThunk({
        programId: PROGRAM_ID,
        fieldId: FIELD_ID,
        categoryId: CATEGORY_ID,
        recordId: RECORD_ID,
        answers,
      }),
    );

    expect(spy).toHaveBeenCalledWith(PROGRAM_ID, FIELD_ID, CATEGORY_ID, RECORD_ID, { answers });
    expect(action.type).toBe(saveCategoryRecordThunk.fulfilled.type);
  });
});

describe('deleteCategoryRecordThunk', () => {
  it('resolves with the category payload the delete responded with', async () => {
    const payload = setWith([]);
    const spy = jest.spyOn(assessmentApi, 'deleteCategoryRecord').mockResolvedValue(payload);

    const action = await run(
      deleteCategoryRecordThunk({
        programId: PROGRAM_ID,
        fieldId: FIELD_ID,
        categoryId: CATEGORY_ID,
        recordId: RECORD_ID,
      }),
    );

    expect(spy).toHaveBeenCalledWith(PROGRAM_ID, FIELD_ID, CATEGORY_ID, RECORD_ID);
    expect(action.type).toBe(deleteCategoryRecordThunk.fulfilled.type);
    expect((action.payload as CategoryQuestionSet).records).toHaveLength(0);
  });
});

describe('assessor record thunks', () => {
  it('add, save and delete reach the assessor endpoints', async () => {
    const payload = setWith([record(RECORD_ID, 1)]);
    const add = jest.spyOn(assessorApi, 'addCategoryRecord').mockResolvedValue(payload);
    const update = jest.spyOn(assessorApi, 'updateCategoryRecord').mockResolvedValue(payload);
    const remove = jest.spyOn(assessorApi, 'deleteCategoryRecord').mockResolvedValue(setWith([]));

    const scope = { programId: PROGRAM_ID, fieldId: FIELD_ID, categoryId: CATEGORY_ID };

    const added = await run(addAssessorCategoryRecordThunk({ ...scope, answers }));
    const saved = await run(
      saveAssessorCategoryRecordThunk({ ...scope, recordId: RECORD_ID, answers }),
    );
    const deleted = await run(
      deleteAssessorCategoryRecordThunk({ ...scope, recordId: RECORD_ID }),
    );

    expect(add).toHaveBeenCalledWith(PROGRAM_ID, FIELD_ID, CATEGORY_ID, { answers });
    expect(update).toHaveBeenCalledWith(PROGRAM_ID, FIELD_ID, CATEGORY_ID, RECORD_ID, { answers });
    expect(remove).toHaveBeenCalledWith(PROGRAM_ID, FIELD_ID, CATEGORY_ID, RECORD_ID);
    expect(added.type).toBe(addAssessorCategoryRecordThunk.fulfilled.type);
    expect(saved.type).toBe(saveAssessorCategoryRecordThunk.fulfilled.type);
    expect(deleted.type).toBe(deleteAssessorCategoryRecordThunk.fulfilled.type);
  });
});
