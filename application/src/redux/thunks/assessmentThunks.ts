import { createAsyncThunk } from '@reduxjs/toolkit';
import * as assessmentApi from '../../api/assessmentApi';
import type {
  AssessmentQuestionDetail,
  AssessmentReview,
  AssessmentSubmitResult,
  CategoryQuestionList,
  CategoryQuestionSet,
  FieldAssessmentSummary,
  FieldRegenIndex,
  MyAssessmentsOverview,
  SaveAnswerInput,
  SaveFormAnswerInput,
  SavedAnswer,
} from '../../types/assessment';
import type {
  DiscardAssessmentResult,
  MyAssessmentHistory,
} from '../../api/assessmentApi';
import type { PageQuery } from '../../types/pagination';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';
import { saveAnswerForOffline } from '../../services/sync/assessmentOfflineFallback';
import { ensureLocalAssessmentScope } from '../../services/sync/assessmentScope';
import { submitAssessmentOffline } from '../../services/sync';
import type { OfflineAnswerContext } from '../../services/sync/assessmentOfflineFallback';
import {
  cacheCategoryQuestions,
  cacheQuestionDetail,
  readCachedCategoryQuestions,
  readCachedQuestionDetail,
  recordSavedAnswer,
} from '../../services/sync/assessmentCache';
import type { QuestionCacheScope } from '../../services/sync/assessmentCache';
import { asOwnerUserId, isDatabaseReady } from '../../services/db';
import {
  cacheAssessmentList,
  cacheAssessmentSummary,
  readCachedAssessmentList,
  readCachedAssessmentSummary,
} from '../../services/sync/assessmentListCache';
import {
  prepareAssessmentPackage,
  readCachedAssessmentReview,
} from '../../services/sync/assessmentPackage';
import {
  snapshotOwner,
  throughOfflineSnapshot,
} from '../../services/sync/offlineSnapshot';

type ThunkConfig = { rejectValue: StandardizedError };

interface AssessmentStateSlice {
  assessment: {
    submitting: boolean;
    loadingSummary: boolean;
    requestedSummaryFieldId: string | null;
    loadingReview: boolean;
    requestedReviewFieldId: string | null;
    loadingQuestions: boolean;
    requestedCategoryScope: string | null;
    loadingCategoryForm: boolean;
    requestedCategoryFormScope: string | null;
    loadingRegenIndex: boolean;
    requestedRegenFieldId: string | null;
    summary: FieldAssessmentSummary | null;
    regenIndex: FieldRegenIndex | null;
    myFields: MyAssessmentsOverview | null;
  };
}

interface AuthStateSlice {
  auth?: { user?: { id?: string; role?: string } | null };
}

const reviewNotAlreadyLoading = (
  arg: FieldScopeArg,
  { getState }: { getState: () => unknown },
): boolean => {
  const { assessment } = getState() as AssessmentStateSlice;
  return !(
    assessment.loadingReview &&
    assessment.requestedReviewFieldId === `${arg.programId}:${arg.fieldId}`
  );
};

const offlineAnswerContext = (
  getState: () => unknown,
  programId: string,
  fieldId: string,
): OfflineAnswerContext => {
  const state = getState() as AssessmentStateSlice & AuthStateSlice;
  const summary = state.assessment.summary;
  const matchesField = summary?.field.id === fieldId;
  const row = state.assessment.myFields?.fields.find(f => f.fieldId === fieldId) ?? null;

  return {
    userId: state.auth?.user?.id,
    programId,
    fieldServerId: fieldId,
    farmServerId: (matchesField ? summary?.field.farmId : row?.farmId) ?? null,
    authorRole: state.auth?.user?.role === 'assessor' ? 'assessor' : 'farmer',
    fieldName: matchesField ? summary?.field.name : row?.fieldName,
    farmName: matchesField ? summary?.field.farmName : row?.farmName,
    totalQuestions: matchesField
      ? summary?.assessment.totalQuestions
      : row?.totalQuestions,
  };
};


const questionCacheScope = (
  getState: () => unknown,
  programId: string,
  fieldId: string,
  categoryId: string,
): { owner: ReturnType<typeof asOwnerUserId>; scope: QuestionCacheScope } | null => {
  if (!isDatabaseReady()) {
    return null;
  }
  const context = offlineAnswerContext(getState, programId, fieldId);
  if (!context.userId) {
    return null;
  }
  return {
    owner: asOwnerUserId(context.userId),
    scope: {
      programId,
      fieldServerId: fieldId,
      farmServerId: context.farmServerId,
      authorRole: context.authorRole,
      fieldName: context.fieldName,
      farmName: context.farmName,
      totalQuestions: context.totalQuestions,
      categoryId,
    },
  };
};


const queueOfflineSubmit = async (
  getState: () => unknown,
  programId: string,
  fieldId: string,
): Promise<AssessmentSubmitResult | null> => {
  if (!isDatabaseReady()) {
    return null;
  }
  const context = offlineAnswerContext(getState, programId, fieldId);
  if (!context.userId) {
    return null;
  }

  const owner = asOwnerUserId(context.userId);
  const assessment = await ensureLocalAssessmentScope(owner, {
    programId,
    fieldServerId: fieldId,
    farmServerId: context.farmServerId,
    authorRole: context.authorRole,
    fieldName: context.fieldName,
    farmName: context.farmName,
    totalQuestions: context.totalQuestions,
  });

  await submitAssessmentOffline(owner, assessment.local_id);

  const total = assessment.total_questions || context.totalQuestions || 0;
  return {
    field: { id: fieldId, name: context.fieldName ?? '' },
    assessmentId: assessment.server_id ?? assessment.local_id,
    status: 'COMPLETED',
    totalQuestions: total,
    answered: assessment.answered,
    totalScore: 0,
    maxScore: 0,
    percentage: assessment.percentage,
    submittedAtISO: new Date().toISOString(),
    reviewStatus: null,
    reviewedAtISO: null,
    reviewNote: null,
  };
};

interface OwnerScope {
  readonly owner: ReturnType<typeof asOwnerUserId>;
  readonly role: 'farmer' | 'assessor';
}

const ownerScopeOnly = (getState: () => unknown): OwnerScope | null => {
  if (!isDatabaseReady()) {
    return null;
  }
  const state = getState() as AuthStateSlice;
  const userId = state.auth?.user?.id;
  if (!userId) {
    return null;
  }
  return {
    owner: asOwnerUserId(userId),
    role: state.auth?.user?.role === 'assessor' ? 'assessor' : 'farmer',
  };
};

const storeSummary = async (
  scope: OwnerScope | null,
  programId: string,
  fieldId: string,
  summary: FieldAssessmentSummary,
  force: boolean,
): Promise<void> => {
  if (!scope) {
    return;
  }
  await cacheAssessmentSummary(scope.owner, programId, summary, scope.role).catch(
    () => undefined,
  );
  prepareAssessmentPackage(
    scope.owner,
    {
      programId,
      fieldServerId: fieldId,
      farmServerId: summary.field.farmId || null,
      authorRole: scope.role,
      fieldName: summary.field.name,
      farmName: summary.field.farmName,
    },
    summary,
    categoryId => assessmentApi.getCategoryQuestionSet(programId, fieldId, categoryId),
    { force },
  ).catch(() => undefined);
};

const loadSummary = async (
  programId: string,
  fieldId: string,
  getState: () => unknown,
  force: boolean,
): Promise<FieldAssessmentSummary> => {
  const scope = ownerScopeOnly(getState);
  try {
    const summary = await assessmentApi.getAssessmentSummary(programId, fieldId);
    await storeSummary(scope, programId, fieldId, summary, force);
    return summary;
  } catch (error) {
    if (scope && handleApiError(error).kind === 'offline') {
      const cached = await readCachedAssessmentSummary(
        scope.owner,
        programId,
        fieldId,
        scope.role,
      ).catch(() => null);
      if (cached) {
        return cached;
      }
    }
    throw error;
  }
};

const recordOnlineAnswer = async (
  getState: () => unknown,
  programId: string,
  fieldId: string,
  questionId: string,
  input: SaveAnswerInput,
): Promise<void> => {
  if (!isDatabaseReady()) {
    return;
  }
  const context = offlineAnswerContext(getState, programId, fieldId);
  if (!context.userId) {
    return;
  }
  await recordSavedAnswer(
    asOwnerUserId(context.userId),
    {
      programId,
      fieldServerId: fieldId,
      farmServerId: context.farmServerId,
      authorRole: context.authorRole,
      fieldName: context.fieldName,
      farmName: context.farmName,
      totalQuestions: context.totalQuestions,
    },
    questionId,
    input,
  ).catch(() => undefined);
};

const firstPageOnly = (query: object | undefined): boolean =>
  Object.entries(query ?? {}).every(([key, value]) =>
    key === 'page' ? value === undefined || value === 1 : value === undefined || value === '',
  );

export const HISTORY_SNAPSHOT_SCOPE = 'assessment:history';

export const regenSnapshotScope = (programId: string, fieldId: string): string =>
  `assessment:regen:${programId}:${fieldId}`;

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

export interface RecordArg {
  programId: string;
  fieldId: string;
  categoryId: string;
  recordId: string;
}

export interface SaveRecordArg extends RecordArg {
  answers: SaveFormAnswerInput[];
}

export interface SaveCategoryAnswersArg {
  programId: string;
  fieldId: string;
  categoryId: string;
  answers: SaveFormAnswerInput[];
}

export const fetchAssessmentSummaryThunk = createAsyncThunk<
  FieldAssessmentSummary,
  FieldScopeArg,
  ThunkConfig
>(
  'assessment/fetchSummary',
  async ({ programId, fieldId }, { getState, rejectWithValue }) => {
    try {
      return await loadSummary(programId, fieldId, getState, false);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (arg, { getState }) => {
      const { assessment } = getState() as AssessmentStateSlice;
      return !(
        assessment.loadingSummary &&
        assessment.requestedSummaryFieldId === `${arg.programId}:${arg.fieldId}`
      );
    },
  },
);

export const refreshAssessmentSummaryThunk = createAsyncThunk<
  FieldAssessmentSummary,
  FieldScopeArg,
  ThunkConfig
>('assessment/refreshSummary', async ({ programId, fieldId }, { getState, rejectWithValue }) => {
  try {
    return await loadSummary(programId, fieldId, getState, true);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchCategoryQuestionsThunk = createAsyncThunk<
  CategoryQuestionList,
  CategoryQuestionsArg,
  ThunkConfig
>(
  'assessment/fetchCategoryQuestions',
  async ({ programId, fieldId, categoryId }, { getState, rejectWithValue }) => {
    const cache = questionCacheScope(getState, programId, fieldId, categoryId);
    try {
      const list = await assessmentApi.getCategoryQuestions(programId, fieldId, categoryId);
      if (cache) {
        await cacheCategoryQuestions(cache.owner, cache.scope, list).catch(() => undefined);
      }
      return list;
    } catch (error) {
      const standardized = handleApiError(error);
      if (standardized.kind === 'offline' && cache) {
        const cached = await readCachedCategoryQuestions(cache.owner, cache.scope).catch(
          () => null,
        );
        if (cached) {
          return cached;
        }
      }
      return rejectWithValue(standardized);
    }
  },
  {
    condition: (arg, { getState }) => {
      const { assessment } = getState() as AssessmentStateSlice;
      return !(
        assessment.loadingQuestions &&
        assessment.requestedCategoryScope ===
          `${arg.programId}:${arg.fieldId}:${arg.categoryId}`
      );
    },
  },
);

export const fetchQuestionDetailThunk = createAsyncThunk<
  AssessmentQuestionDetail,
  QuestionDetailArg,
  ThunkConfig
>('assessment/fetchQuestionDetail', async ({ programId, fieldId, categoryId, questionId }, { getState, rejectWithValue }) => {
  const cache = questionCacheScope(getState, programId, fieldId, categoryId);
  try {
    const detail = await assessmentApi.getQuestionDetail(
      programId,
      fieldId,
      categoryId,
      questionId,
    );
    if (cache) {
      await cacheQuestionDetail(cache.owner, cache.scope, detail).catch(() => undefined);
    }
    return detail;
  } catch (error) {
    const standardized = handleApiError(error);
    if (standardized.kind === 'offline' && cache) {
      const cached = await readCachedQuestionDetail(
        cache.owner,
        cache.scope,
        questionId,
      ).catch(() => null);
      if (cached) {
        return cached;
      }
    }
    return rejectWithValue(standardized);
  }
});

export const fetchCategoryFormThunk = createAsyncThunk<
  CategoryQuestionSet,
  CategoryQuestionsArg,
  ThunkConfig
>(
  'assessment/fetchCategoryForm',
  async ({ programId, fieldId, categoryId }, { rejectWithValue }) => {
    try {
      return await assessmentApi.getCategoryQuestionSet(programId, fieldId, categoryId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (arg, { getState }) => {
      const { assessment } = getState() as AssessmentStateSlice;
      return !(
        assessment.loadingCategoryForm &&
        assessment.requestedCategoryFormScope ===
          `${arg.programId}:${arg.fieldId}:${arg.categoryId}`
      );
    },
  },
);

export const saveCategoryAnswersThunk = createAsyncThunk<
  CategoryQuestionSet,
  SaveCategoryAnswersArg,
  ThunkConfig
>(
  'assessment/saveCategoryAnswers',
  async ({ programId, fieldId, categoryId, answers }, { rejectWithValue }) => {
    try {
      return await assessmentApi.saveCategoryAnswers(programId, fieldId, categoryId, {
        answers,
      });
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const addCategoryRecordThunk = createAsyncThunk<
  CategoryQuestionSet,
  SaveCategoryAnswersArg,
  ThunkConfig
>(
  'assessment/addCategoryRecord',
  async ({ programId, fieldId, categoryId, answers }, { rejectWithValue }) => {
    try {
      return await assessmentApi.addCategoryRecord(programId, fieldId, categoryId, { answers });
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const saveCategoryRecordThunk = createAsyncThunk<
  CategoryQuestionSet,
  SaveRecordArg,
  ThunkConfig
>(
  'assessment/saveCategoryRecord',
  async ({ programId, fieldId, categoryId, recordId, answers }, { rejectWithValue }) => {
    try {
      return await assessmentApi.updateCategoryRecord(programId, fieldId, categoryId, recordId, {
        answers,
      });
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const deleteCategoryRecordThunk = createAsyncThunk<
  CategoryQuestionSet,
  RecordArg,
  ThunkConfig
>(
  'assessment/deleteCategoryRecord',
  async ({ programId, fieldId, categoryId, recordId }, { rejectWithValue }) => {
    try {
      return await assessmentApi.deleteCategoryRecord(programId, fieldId, categoryId, recordId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const saveAssessmentAnswerThunk = createAsyncThunk<
  SavedAnswer,
  SaveAnswerArg,
  ThunkConfig
>(
  'assessment/saveAnswer',
  async ({ programId, fieldId, questionId, input }, { getState, rejectWithValue }) => {
    try {
      const answer = await assessmentApi.saveAnswer(programId, fieldId, questionId, input);
      await recordOnlineAnswer(getState, programId, fieldId, questionId, input);
      return answer;
    } catch (error) {
      const standardized = handleApiError(error);
      if (standardized.kind === 'offline') {
        const queued = await saveAnswerForOffline(
          offlineAnswerContext(getState, programId, fieldId),
          questionId,
          input,
        );
        if (queued) {
          return queued;
        }
      }
      return rejectWithValue(standardized);
    }
  },
);

export const fetchAssessmentReviewThunk = createAsyncThunk<
  AssessmentReview,
  FieldScopeArg,
  ThunkConfig
>(
  'assessment/fetchReview',
  async ({ programId, fieldId }, { getState, rejectWithValue }) => {
    const scope = ownerScopeOnly(getState);
    try {
      return await assessmentApi.getAssessmentReview(programId, fieldId);
    } catch (error) {
      const standardized = handleApiError(error);
      if (standardized.kind === 'offline' && scope) {
        const cached = await readCachedAssessmentReview(
          scope.owner,
          programId,
          fieldId,
          scope.role,
        ).catch(() => null);
        if (cached) {
          return cached;
        }
      }
      return rejectWithValue(standardized);
    }
  },
  { condition: reviewNotAlreadyLoading },
);

export const fetchFieldHistoryThunk = createAsyncThunk<
  AssessmentReview,
  FieldScopeArg,
  ThunkConfig
>(
  'assessment/fetchFieldHistory',
  async ({ programId, fieldId }, { getState, rejectWithValue }) => {
    const scope = ownerScopeOnly(getState);
    try {
      return await assessmentApi.getFieldHistory(programId, fieldId);
    } catch (error) {
      const standardized = handleApiError(error);
      if (standardized.kind === 'offline' && scope) {
        const cached = await readCachedAssessmentReview(
          scope.owner,
          programId,
          fieldId,
          scope.role,
        ).catch(() => null);
        if (cached) {
          return cached;
        }
      }
      return rejectWithValue(standardized);
    }
  },
  { condition: reviewNotAlreadyLoading },
);

export const submitAssessmentThunk = createAsyncThunk<
  AssessmentSubmitResult,
  FieldScopeArg,
  ThunkConfig
>(
  'assessment/submit',
  async ({ programId, fieldId }, { getState, rejectWithValue }) => {
    try {
      const result = await assessmentApi.submitAssessment(programId, fieldId);
      return result;
    } catch (error) {
      const standardized = handleApiError(error);
      if (standardized.kind === 'offline') {
        const queued = await queueOfflineSubmit(getState, programId, fieldId).catch(
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
    condition: (_arg, { getState }) => {
      const state = getState() as AssessmentStateSlice;
      return !state.assessment.submitting;
    },
  },
);

export const discardAssessmentThunk = createAsyncThunk<
  DiscardAssessmentResult,
  FieldScopeArg,
  ThunkConfig
>(
  'assessment/discard',
  async ({ programId, fieldId }, { rejectWithValue }) => {
    try {
      return await assessmentApi.discardAssessment(programId, fieldId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export type MyAssessmentFieldsArg = PageQuery | undefined;

export const fetchMyAssessmentFieldsThunk = createAsyncThunk<
  MyAssessmentsOverview,
  MyAssessmentFieldsArg,
  ThunkConfig
>('assessment/myFields', async (query, { getState, rejectWithValue }) => {
  const scope = ownerScopeOnly(getState);
  try {
    const overview = await assessmentApi.getMyAssessmentFields(query);
    if (scope) {
      await cacheAssessmentList(scope.owner, overview, scope.role).catch(() => undefined);
    }
    return overview;
  } catch (error) {
    const standardized = handleApiError(error);
    if (standardized.kind === 'offline' && scope) {
      const cached = await readCachedAssessmentList(scope.owner, scope.role).catch(
        () => null,
      );
      if (cached) {
        return cached;
      }
    }
    return rejectWithValue(standardized);
  }
});

export interface MyAssessmentHistoryArg extends PageQuery {
  farmId?: string;
}

export const fetchMyAssessmentHistoryThunk = createAsyncThunk<
  MyAssessmentHistory,
  MyAssessmentHistoryArg | undefined,
  ThunkConfig
>('assessment/myHistory', async (arg, { getState, rejectWithValue }) => {
  try {
    return await throughOfflineSnapshot(
      snapshotOwner(getState),
      firstPageOnly(arg) ? HISTORY_SNAPSHOT_SCOPE : null,
      () => assessmentApi.getMyAssessmentHistory(arg?.farmId, arg),
    );
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchFieldRegenIndexThunk = createAsyncThunk<
  FieldRegenIndex,
  FieldScopeArg,
  ThunkConfig
>(
  'assessment/fetchRegenIndex',
  async ({ programId, fieldId }, { getState, rejectWithValue }) => {
    try {
      return await throughOfflineSnapshot(
        snapshotOwner(getState),
        regenSnapshotScope(programId, fieldId),
        () => assessmentApi.getFieldRegenIndex(programId, fieldId),
      );
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: ({ programId, fieldId }, { getState }) => {
      const { assessment } = getState() as AssessmentStateSlice;
      return !(
        assessment.loadingRegenIndex &&
        assessment.requestedRegenFieldId === `${programId}:${fieldId}`
      );
    },
  },
);
