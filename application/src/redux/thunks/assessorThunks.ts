import { createAsyncThunk } from '@reduxjs/toolkit';
import * as assessorApi from '../../api/assessorApi';
import type {
  CategoryQuestionList,
  CategoryQuestionSet,
  AssessmentQuestionDetail,
  AssessmentReview,
  AssessmentSubmitResult,
  FieldAssessmentSummary,
  SaveAnswerInput,
  SaveFormAnswerInput,
  SavedAnswer,
} from '../../types/assessment';
import type {
  AssessorAssessmentSummary,
  AssessorComparison,
  AssessorFieldsOverview,
  FarmerAssessmentView,
  SubmittedBy,
} from '../../types/assessor';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';
import { saveAnswerForOffline } from '../../services/sync/assessmentOfflineFallback';
import type { OfflineAnswerContext } from '../../services/sync/assessmentOfflineFallback';
import { ensureLocalAssessmentScope } from '../../services/sync/assessmentScope';
import { submitAssessmentOffline } from '../../services/sync';
import {
  cacheCategoryQuestions,
  cacheQuestionDetail,
  readCachedCategoryQuestions,
  readCachedQuestionDetail,
  recordSavedAnswer,
} from '../../services/sync/assessmentCache';
import type { QuestionCacheScope } from '../../services/sync/assessmentCache';
import {
  cacheAssessmentSummary,
  readCachedAssessmentSummary,
} from '../../services/sync/assessmentListCache';
import {
  cacheAssessorFields,
  readCachedAssessorFields,
} from '../../services/sync/assessorFieldsCache';
import {
  prepareAssessmentPackage,
  readCachedAssessmentReview,
} from '../../services/sync/assessmentPackage';
import { asOwnerUserId, isDatabaseReady } from '../../services/db';
import type { OwnerUserId } from '../../services/db/types';

type ThunkConfig = { rejectValue: StandardizedError };

interface RootLike {
  assessor: {
    fieldsOverview: AssessorFieldsOverview | null;
    summary: FieldAssessmentSummary | null;
  };
  auth: { user: { id: string; fullName: string } | null };
}

interface AssessorAuthLike {
  auth?: { user?: { id?: string } | null } | null;
}

const assessorOwner = (getState: () => unknown): OwnerUserId | null => {
  if (!isDatabaseReady()) {
    return null;
  }
  const userId = (getState() as AssessorAuthLike).auth?.user?.id;
  return userId ? asOwnerUserId(userId) : null;
};

const isOffline = (error: unknown): boolean => handleApiError(error).kind === 'offline';

const assessorOfflineContext = (
  getState: () => unknown,
  programId: string,
  fieldId: string,
): OfflineAnswerContext => {
  const root = getState() as RootLike & AssessorAuthLike;
  const summary = root.assessor?.summary ?? null;
  const matches = summary?.field.id === fieldId;

  return {
    userId: root.auth?.user?.id,
    programId,
    fieldServerId: fieldId,
    farmServerId: (matches ? summary?.field.farmId : null) ?? null,
    authorRole: 'assessor',
    fieldName: matches ? summary?.field.name : undefined,
    farmName: matches ? summary?.field.farmName : undefined,
    totalQuestions: matches ? summary?.assessment.totalQuestions : undefined,
  };
};

const assessorQuestionScope = (
  getState: () => unknown,
  programId: string,
  fieldId: string,
  categoryId: string,
): QuestionCacheScope => {
  const context = assessorOfflineContext(getState, programId, fieldId);
  return {
    programId,
    fieldServerId: fieldId,
    farmServerId: context.farmServerId,
    authorRole: 'assessor',
    fieldName: context.fieldName,
    farmName: context.farmName,
    totalQuestions: context.totalQuestions,
    categoryId,
  };
};

const assessorStamp = (user: RootLike['auth']['user']): SubmittedBy => ({
  id: user?.id ?? '',
  name: user?.fullName ?? '',
  role: 'assessor',
});

const enrichSummary = (
  base: AssessorAssessmentSummary,
  programId: string,
  fieldId: string,
  root: RootLike,
): AssessorAssessmentSummary => {
  const entry = root.assessor.fieldsOverview?.fields.find(
    e => e.field.id === fieldId && e.program.id === programId,
  );
  const field = entry
    ? { ...base.summary.field, farmId: entry.farm.id, farmName: entry.farm.name }
    : base.summary.field;
  const locked = entry?.assessment.completed ?? false;
  return {
    summary: {
      ...base.summary,
      field,
      assessment: {
        ...base.summary.assessment,
        submitted: locked || base.summary.assessment.submitted,
      },
    },
    locked,
    submittedBy: locked ? assessorStamp(root.auth.user) : null,
  };
};

const cachedAssessorSummary = async (
  owner: OwnerUserId,
  programId: string,
  fieldId: string,
  root: RootLike,
): Promise<AssessorAssessmentSummary | null> => {
  const cached = await readCachedAssessmentSummary(owner, programId, fieldId, 'assessor');
  if (!cached) {
    return null;
  }
  const enriched = enrichSummary(
    { summary: cached, submittedBy: null, locked: false },
    programId,
    fieldId,
    root,
  );
  const locked = enriched.locked || cached.assessment.submitted;
  return {
    ...enriched,
    locked,
    submittedBy: locked ? assessorStamp(root.auth.user) : null,
  };
};

const prepareAssessorPackage = (
  owner: OwnerUserId,
  programId: string,
  fieldId: string,
  summary: FieldAssessmentSummary,
  force: boolean,
): void => {
  prepareAssessmentPackage(
    owner,
    {
      programId,
      fieldServerId: fieldId,
      farmServerId: summary.field.farmId || null,
      authorRole: 'assessor',
      fieldName: summary.field.name,
      farmName: summary.field.farmName,
    },
    summary,
    categoryId => assessorApi.getCategoryQuestionSet(programId, fieldId, categoryId),
    { force },
  ).catch(() => undefined);
};

const loadAssessorSummary = async (
  programId: string,
  fieldId: string,
  getState: () => unknown,
  force: boolean,
): Promise<AssessorAssessmentSummary> => {
  const owner = assessorOwner(getState);
  try {
    const base = await assessorApi.getSummary(programId, fieldId);
    const enriched = enrichSummary(base, programId, fieldId, getState() as RootLike);
    if (owner) {
      await cacheAssessmentSummary(owner, programId, enriched.summary, 'assessor').catch(
        () => undefined,
      );
      prepareAssessorPackage(owner, programId, fieldId, enriched.summary, force);
    }
    return enriched;
  } catch (error) {
    if (owner && isOffline(error)) {
      const cached = await cachedAssessorSummary(
        owner,
        programId,
        fieldId,
        getState() as RootLike,
      ).catch(() => null);
      if (cached) {
        return cached;
      }
    }
    throw error;
  }
};

const completedSubmission = (
  root: RootLike,
  fieldId: string,
  result: AssessmentSubmitResult,
): AssessorSubmitResult => {
  const current = root.assessor.summary;
  const totalQuestions = result.totalQuestions || current?.assessment.totalQuestions || 0;
  const base: FieldAssessmentSummary =
    current && current.field.id === fieldId
      ? current
      : {
          field: { id: result.field.id, name: result.field.name, farmId: '', farmName: '' },
          assessment: { title: '', year: 0, status: 'COMPLETED', totalQuestions, answered: totalQuestions, percentage: 100, submitted: true, questionKind: 'mcq' },
          categories: [],
          canEdit: true,
          reviewStatus: null,
          program: { active: true, ended: false, endDate: null, assessmentOpen: true },
        };
  const summary: FieldAssessmentSummary = {
    ...base,
    assessment: {
      ...base.assessment,
      status: 'COMPLETED',
      totalQuestions,
      answered: totalQuestions,
      percentage: 100,
      submitted: true,
    },
  };
  return {
    summary,
    locked: true,
    submittedBy: assessorStamp(root.auth.user),
    submittedAtISO: result.submittedAtISO,
    scorePercentage: result.percentage,
    result,
  };
};

const queueAssessorSubmit = async (
  getState: () => unknown,
  programId: string,
  fieldId: string,
): Promise<AssessorSubmitResult | null> => {
  const owner = assessorOwner(getState);
  if (!owner) {
    return null;
  }
  const context = assessorOfflineContext(getState, programId, fieldId);
  const assessment = await ensureLocalAssessmentScope(owner, {
    programId,
    fieldServerId: fieldId,
    farmServerId: context.farmServerId,
    authorRole: 'assessor',
    fieldName: context.fieldName,
    farmName: context.farmName,
    totalQuestions: context.totalQuestions,
  });

  await submitAssessmentOffline(owner, assessment.local_id);

  const totalQuestions = assessment.total_questions || context.totalQuestions || 0;
  return completedSubmission(getState() as RootLike, fieldId, {
    field: { id: fieldId, name: context.fieldName ?? '' },
    assessmentId: assessment.server_id ?? assessment.local_id,
    status: 'COMPLETED',
    totalQuestions,
    answered: assessment.answered,
    totalScore: 0,
    maxScore: 0,
    percentage: assessment.percentage,
    submittedAtISO: new Date().toISOString(),
    reviewStatus: null,
    reviewedAtISO: null,
    reviewNote: null,
  });
};

const recordAssessorAnswer = async (
  getState: () => unknown,
  programId: string,
  fieldId: string,
  questionId: string,
  input: SaveAnswerInput,
): Promise<void> => {
  const owner = assessorOwner(getState);
  if (!owner) {
    return;
  }
  const context = assessorOfflineContext(getState, programId, fieldId);
  await recordSavedAnswer(
    owner,
    {
      programId,
      fieldServerId: fieldId,
      farmServerId: context.farmServerId,
      authorRole: 'assessor',
      fieldName: context.fieldName,
      farmName: context.farmName,
      totalQuestions: context.totalQuestions,
    },
    questionId,
    input,
  ).catch(() => undefined);
};

export interface AssessorSubmitResult extends AssessorAssessmentSummary {
  submittedAtISO: string;
  scorePercentage: number;
  result: AssessmentSubmitResult;
}

export interface AssessorReviewResult {
  review: AssessmentReview;
  submittedBy: SubmittedBy | null;
}

export interface FieldScopeArg {
  programId: string;
  fieldId: string;
}
export interface CategoryQuestionsArg {
  programId: string;
  fieldId: string;
  categoryId: string;
}
export interface QuestionDetailArg {
  programId: string;
  fieldId: string;
  categoryId: string;
  questionId: string;
}
export interface SaveAnswerArg {
  programId: string;
  fieldId: string;
  questionId: string;
  input: SaveAnswerInput;
}
export interface SaveCategoryAnswersArg {
  programId: string;
  fieldId: string;
  categoryId: string;
  answers: SaveFormAnswerInput[];
}

export interface RecordArg {
  programId: string;
  fieldId: string;
  categoryId: string;
  recordId: string;
}

export interface SaveRecordArg extends RecordArg {
  answers: SaveFormAnswerInput[];
}

type FieldsThunkConfig = ThunkConfig & {
  fulfilledMeta: { capturedAt: string | null };
};

export const fetchAssessorFieldsThunk = createAsyncThunk<
  AssessorFieldsOverview,
  void,
  FieldsThunkConfig
>(
  'assessor/fetchFields',
  async (_, { getState, rejectWithValue, fulfillWithValue }) => {
    const owner = assessorOwner(getState);
    try {
      const overview = await assessorApi.getFields();
      if (owner) {
        await cacheAssessorFields(owner, overview).catch(() => undefined);
      }
      return fulfillWithValue(overview, { capturedAt: null });
    } catch (error) {
      if (owner && isOffline(error)) {
        const cached = await readCachedAssessorFields(owner).catch(() => null);
        if (cached) {
          return fulfillWithValue(cached.overview, { capturedAt: cached.capturedAt });
        }
      }
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (_arg, { getState }) =>
      !(getState() as { assessor: { loadingFieldsOverview: boolean } }).assessor
        .loadingFieldsOverview,
  },
);

export const fetchAssessorSummaryThunk = createAsyncThunk<AssessorAssessmentSummary, FieldScopeArg, ThunkConfig>(
  'assessor/fetchSummary',
  async ({ programId, fieldId }, { getState, rejectWithValue }) => {
    try {
      return await loadAssessorSummary(programId, fieldId, getState, false);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (arg, { getState }) => {
      const { assessor } = getState() as {
        assessor: { loadingSummary: boolean; requestedSummaryFieldId: string | null };
      };
      return !(
        assessor.loadingSummary &&
        assessor.requestedSummaryFieldId === `${arg.programId}:${arg.fieldId}`
      );
    },
  },
);

export const refreshAssessorSummaryThunk = createAsyncThunk<AssessorAssessmentSummary, FieldScopeArg, ThunkConfig>(
  'assessor/refreshSummary',
  async ({ programId, fieldId }, { getState, rejectWithValue }) => {
    try {
      return await loadAssessorSummary(programId, fieldId, getState, true);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const fetchAssessorCategoryQuestionsThunk = createAsyncThunk<
  CategoryQuestionList,
  CategoryQuestionsArg,
  ThunkConfig
>(
  'assessor/fetchCategoryQuestions',
  async ({ programId, fieldId, categoryId }, { getState, rejectWithValue }) => {
    const owner = assessorOwner(getState);
    const scope = assessorQuestionScope(getState, programId, fieldId, categoryId);
    try {
      const list = await assessorApi.getCategoryQuestions(programId, fieldId, categoryId);
      if (owner) {
        await cacheCategoryQuestions(owner, scope, list).catch(() => undefined);
      }
      return list;
    } catch (error) {
      if (owner && isOffline(error)) {
        const cached = await readCachedCategoryQuestions(owner, scope).catch(() => null);
        if (cached) {
          return cached;
        }
      }
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (arg, { getState }) => {
      const { assessor } = getState() as {
        assessor: { loadingQuestions: boolean; requestedCategoryScope: string | null };
      };
      return !(
        assessor.loadingQuestions &&
        assessor.requestedCategoryScope === `${arg.programId}:${arg.fieldId}:${arg.categoryId}`
      );
    },
  },
);

export const fetchAssessorQuestionDetailThunk = createAsyncThunk<
  AssessmentQuestionDetail,
  QuestionDetailArg,
  ThunkConfig
>('assessor/fetchQuestionDetail', async ({ programId, fieldId, categoryId, questionId }, { getState, rejectWithValue }) => {
  const owner = assessorOwner(getState);
  const scope = assessorQuestionScope(getState, programId, fieldId, categoryId);
  try {
    const detail = await assessorApi.getQuestion(programId, fieldId, categoryId, questionId);
    if (owner) {
      await cacheQuestionDetail(owner, scope, detail).catch(() => undefined);
    }
    return detail;
  } catch (error) {
    if (owner && isOffline(error)) {
      const cached = await readCachedQuestionDetail(owner, scope, questionId).catch(() => null);
      if (cached) {
        return cached;
      }
    }
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchAssessorCategoryFormThunk = createAsyncThunk<
  CategoryQuestionSet,
  CategoryQuestionsArg,
  ThunkConfig
>(
  'assessor/fetchCategoryForm',
  async ({ programId, fieldId, categoryId }, { rejectWithValue }) => {
    try {
      return await assessorApi.getCategoryQuestionSet(programId, fieldId, categoryId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (arg, { getState }) => {
      const { assessor } = getState() as {
        assessor: { loadingCategoryForm: boolean; requestedCategoryFormScope: string | null };
      };
      return !(
        assessor.loadingCategoryForm &&
        assessor.requestedCategoryFormScope ===
          `${arg.programId}:${arg.fieldId}:${arg.categoryId}`
      );
    },
  },
);

export const saveAssessorCategoryAnswersThunk = createAsyncThunk<
  CategoryQuestionSet,
  SaveCategoryAnswersArg,
  ThunkConfig
>(
  'assessor/saveCategoryAnswers',
  async ({ programId, fieldId, categoryId, answers }, { rejectWithValue }) => {
    try {
      return await assessorApi.saveCategoryAnswers(programId, fieldId, categoryId, { answers });
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const addAssessorCategoryRecordThunk = createAsyncThunk<
  CategoryQuestionSet,
  SaveCategoryAnswersArg,
  ThunkConfig
>(
  'assessor/addCategoryRecord',
  async ({ programId, fieldId, categoryId, answers }, { rejectWithValue }) => {
    try {
      return await assessorApi.addCategoryRecord(programId, fieldId, categoryId, { answers });
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const saveAssessorCategoryRecordThunk = createAsyncThunk<
  CategoryQuestionSet,
  SaveRecordArg,
  ThunkConfig
>(
  'assessor/saveCategoryRecord',
  async ({ programId, fieldId, categoryId, recordId, answers }, { rejectWithValue }) => {
    try {
      return await assessorApi.updateCategoryRecord(programId, fieldId, categoryId, recordId, {
        answers,
      });
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const deleteAssessorCategoryRecordThunk = createAsyncThunk<
  CategoryQuestionSet,
  RecordArg,
  ThunkConfig
>(
  'assessor/deleteCategoryRecord',
  async ({ programId, fieldId, categoryId, recordId }, { rejectWithValue }) => {
    try {
      return await assessorApi.deleteCategoryRecord(programId, fieldId, categoryId, recordId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const saveAssessorAnswerThunk = createAsyncThunk<SavedAnswer, SaveAnswerArg, ThunkConfig>(
  'assessor/saveAnswer',
  async ({ programId, fieldId, questionId, input }, { getState, rejectWithValue }) => {
    try {
      const answer = await assessorApi.saveAnswer(programId, fieldId, questionId, input);
      await recordAssessorAnswer(getState, programId, fieldId, questionId, input);
      return answer;
    } catch (error) {
      const standardized = handleApiError(error);
      if (standardized.kind === 'offline') {
        const queued = await saveAnswerForOffline(
          assessorOfflineContext(getState, programId, fieldId),
          questionId,
          input,
        ).catch(() => null);
        if (queued) {
          return queued;
        }
      }
      return rejectWithValue(standardized);
    }
  },
);

export const fetchAssessorReviewThunk = createAsyncThunk<
  AssessorReviewResult,
  FieldScopeArg,
  ThunkConfig
>(
  'assessor/fetchReview',
  async ({ programId, fieldId }, { getState, rejectWithValue }) => {
    const owner = assessorOwner(getState);
    try {
      const review = await assessorApi.getReview(programId, fieldId);
      const root = getState() as RootLike;
      return {
        review,
        submittedBy: review.submission.submittedAtISO ? assessorStamp(root.auth.user) : null,
      };
    } catch (error) {
      if (owner && isOffline(error)) {
        const cached = await readCachedAssessmentReview(
          owner,
          programId,
          fieldId,
          'assessor',
        ).catch(() => null);
        if (cached) {
          const submitted =
            Boolean(cached.submission.submittedAtISO) || cached.submission.status === 'COMPLETED';
          return {
            review: cached,
            submittedBy: submitted ? assessorStamp((getState() as RootLike).auth.user) : null,
          };
        }
      }
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (_arg, { getState }) =>
      !(getState() as { assessor: { loadingReview: boolean } }).assessor.loadingReview,
  },
);

export const submitAssessorAssessmentThunk = createAsyncThunk<AssessorSubmitResult, FieldScopeArg, ThunkConfig>(
  'assessor/submit',
  async ({ programId, fieldId }, { getState, rejectWithValue }) => {
    try {
      const result = await assessorApi.submit(programId, fieldId);
      return completedSubmission(getState() as RootLike, fieldId, result);
    } catch (error) {
      const standardized = handleApiError(error);
      if (standardized.kind === 'offline') {
        const queued = await queueAssessorSubmit(getState, programId, fieldId).catch(
          () => null,
        );
        if (queued) {
          return queued;
        }
      }
      return rejectWithValue(standardized);
    }
  },
  {
    condition: (_arg, { getState }) =>
      !(getState() as { assessor: { submitting: boolean } }).assessor.submitting,
  },
);

export const fetchFarmerAssessmentThunk = createAsyncThunk<FarmerAssessmentView, FieldScopeArg, ThunkConfig>(
  'assessor/fetchFarmerAssessment',
  async ({ programId, fieldId }, { rejectWithValue }) => {
    try {
      return await assessorApi.getFarmerAssessment(programId, fieldId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const fetchComparisonThunk = createAsyncThunk<AssessorComparison, FieldScopeArg, ThunkConfig>(
  'assessor/fetchComparison',
  async ({ programId, fieldId }, { rejectWithValue }) => {
    try {
      return await assessorApi.getComparison(programId, fieldId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);
