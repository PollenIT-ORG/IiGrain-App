import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import {
  clearSubmitResult,
  discardAssessmentThunk,
  fetchAssessmentReviewThunk,
  fetchFieldHistoryThunk,
  fetchAssessmentSummaryThunk,
  fetchCategoryQuestionsThunk,
  fetchCategoryFormThunk,
  saveCategoryAnswersThunk,
  addCategoryRecordThunk,
  saveCategoryRecordThunk,
  deleteCategoryRecordThunk,
  fetchFieldRegenIndexThunk,
  fetchQuestionDetailThunk,
  refreshAssessmentSummaryThunk,
  saveAssessmentAnswerThunk,
  selectAnswerVersion,
  selectAssessmentCategories,
  selectAssessmentDiscarding,
  selectAssessmentError,
  selectAssessmentProgramName,
  selectAssessmentRefreshing,
  selectAssessmentReview,
  selectAssessmentSaving,
  selectAssessmentSubmitResult,
  selectAssessmentSubmitting,
  selectAssessmentSummary,
  selectCategoryForm,
  selectCategoryFormLoading,
  selectCategoryFormSaving,
  selectCategoryQuestionList,
  selectFieldRegenIndex,
  selectLoadedRegenScope,
  selectLoadedReviewScope,
  selectLoadedSummaryScope,
  selectQuestionDetail,
  selectQuestionList,
  selectQuestionLoading,
  selectQuestionsLoading,
  selectRegenIndexLoading,
  selectReviewLoading,
  selectSummaryLoading,
  submitAssessmentThunk,
} from '../../../redux/slices/assessmentSlice';
import {
  clearResumePoint,
  selectResumePoint,
  setResumePoint,
} from '../../../redux/slices/assessmentProgressSlice';
import { selectDashboardProgramName } from '../../../redux/slices/dashboardSlice';
import { selectEnrollmentProgramName } from '../../../redux/slices/enrollmentSlice';
import {
  resetToAssessmentTab,
  resetToFieldSummary,
} from '../assessmentNavigation';
import { OPEN_ACCESS } from './flowTypes';
import type {
  AssessmentAccess,
  AssessmentFlow,
  FlowCategoryScope,
  FlowNavigation,
  FlowQuestionScope,
  FlowSaveAnswerArg,
  FlowSaveCategoryAnswersArg,
  FlowRecordScope,
  FlowSaveRecordArg,
  FlowScope,
  FlowSummaryTarget,
} from './flowTypes';

const ROUTES = {
  summary: 'AssessmentFieldSummary',
  category: 'AssessmentCategory',
  question: 'AssessmentQuestionDetail',
  review: 'AssessmentReview',
} as const;

export const useFarmerAssessmentFlow = (
  programId: string,
  fieldId: string,
): AssessmentFlow => {
  const dispatch = useAppDispatch();

  const summary = useAppSelector(selectAssessmentSummary);
  const programName = useAppSelector(
    state =>
      selectAssessmentProgramName(programId)(state) ||
      selectDashboardProgramName(programId)(state) ||
      selectEnrollmentProgramName(programId)(state),
  );
  const categories = useAppSelector(selectAssessmentCategories);
  const categoryList = useAppSelector(selectCategoryQuestionList);
  const questions = useAppSelector(selectQuestionList);
  const categoryForm = useAppSelector(selectCategoryForm);
  const questionDetail = useAppSelector(selectQuestionDetail);
  const review = useAppSelector(selectAssessmentReview);
  const submitResult = useAppSelector(selectAssessmentSubmitResult);
  const regenIndex = useAppSelector(selectFieldRegenIndex);
  const resumePoint = useAppSelector(selectResumePoint(programId, fieldId));
  const error = useAppSelector(selectAssessmentError);

  const access = useMemo<AssessmentAccess>(() => {
    if (summary && summary.program.assessmentOpen === false) {
      return {
        locked: true,
        state: 'program_not_open',
        resolved: true,
        visitId: null,
        otherFieldName: null,
      };
    }
    return OPEN_ACCESS;
  }, [summary]);

  const loadedSummaryScope = useAppSelector(selectLoadedSummaryScope);
  const loadedReviewScope = useAppSelector(selectLoadedReviewScope);
  const loadedRegenScope = useAppSelector(selectLoadedRegenScope);
  const answerVersion = useAppSelector(selectAnswerVersion);

  const loadingSummary = useAppSelector(selectSummaryLoading);
  const loadingQuestions = useAppSelector(selectQuestionsLoading);
  const loadingCategoryForm = useAppSelector(selectCategoryFormLoading);
  const savingCategoryForm = useAppSelector(selectCategoryFormSaving);
  const loadingQuestion = useAppSelector(selectQuestionLoading);
  const loadingReview = useAppSelector(selectReviewLoading);
  const loadingRegenIndex = useAppSelector(selectRegenIndexLoading);
  const refreshing = useAppSelector(selectAssessmentRefreshing);
  const saving = useAppSelector(selectAssessmentSaving);
  const submitting = useAppSelector(selectAssessmentSubmitting);
  const discarding = useAppSelector(selectAssessmentDiscarding);

  const loadSummary = useCallback(
    (scope: FlowScope) => {
      dispatch(fetchAssessmentSummaryThunk(scope));
    },
    [dispatch],
  );

  const refreshSummary = useCallback(
    (scope: FlowScope) => {
      dispatch(refreshAssessmentSummaryThunk(scope));
    },
    [dispatch],
  );

  const loadCategoryQuestions = useCallback(
    async (scope: FlowCategoryScope) => {
      await dispatch(fetchCategoryQuestionsThunk(scope));
    },
    [dispatch],
  );

  const loadCategoryForm = useCallback(
    async (scope: FlowCategoryScope) => {
      await dispatch(fetchCategoryFormThunk(scope));
    },
    [dispatch],
  );

  const saveCategoryAnswers = useCallback(
    async (arg: FlowSaveCategoryAnswersArg) => {
      const action = await dispatch(saveCategoryAnswersThunk(arg));
      if (saveCategoryAnswersThunk.fulfilled.match(action)) {
        return { ok: true, closed: false, message: null };
      }
      const closed = action.payload?.code === 'ASSESSMENT_CLOSED';
      return { ok: false, closed, message: closed ? null : action.payload?.message ?? null };
    },
    [dispatch],
  );

  const addCategoryRecord = useCallback(
    async (arg: FlowSaveCategoryAnswersArg) => {
      const action = await dispatch(addCategoryRecordThunk(arg));
      if (addCategoryRecordThunk.fulfilled.match(action)) {
        return { ok: true, closed: false, message: null };
      }
      const closed = action.payload?.code === 'ASSESSMENT_CLOSED';
      return { ok: false, closed, message: closed ? null : action.payload?.message ?? null };
    },
    [dispatch],
  );

  const saveCategoryRecord = useCallback(
    async (arg: FlowSaveRecordArg) => {
      const action = await dispatch(saveCategoryRecordThunk(arg));
      if (saveCategoryRecordThunk.fulfilled.match(action)) {
        return { ok: true, closed: false, message: null };
      }
      const closed = action.payload?.code === 'ASSESSMENT_CLOSED';
      return { ok: false, closed, message: closed ? null : action.payload?.message ?? null };
    },
    [dispatch],
  );

  const deleteCategoryRecord = useCallback(
    async (arg: FlowRecordScope) => {
      const action = await dispatch(deleteCategoryRecordThunk(arg));
      if (deleteCategoryRecordThunk.fulfilled.match(action)) {
        return { ok: true, closed: false, message: null };
      }
      const closed = action.payload?.code === 'ASSESSMENT_CLOSED';
      return { ok: false, closed, message: closed ? null : action.payload?.message ?? null };
    },
    [dispatch],
  );

  const loadQuestionDetail = useCallback(
    (scope: FlowQuestionScope) => {
      dispatch(fetchQuestionDetailThunk(scope));
    },
    [dispatch],
  );

  const saveAnswer = useCallback(
    async (arg: FlowSaveAnswerArg) => {
      const action = await dispatch(saveAssessmentAnswerThunk(arg));
      if (saveAssessmentAnswerThunk.fulfilled.match(action)) {
        return { ok: true, conflict: false, closed: false, message: null };
      }
      const conflict = action.payload?.code === 'ASSESSMENT_CONFLICT';
      const closed = action.payload?.code === 'ASSESSMENT_CLOSED';
      return {
        ok: false,
        conflict,
        closed,
        message: conflict || closed ? null : action.payload?.message ?? null,
      };
    },
    [dispatch],
  );

  const loadReview = useCallback(
    (scope: FlowScope) => {
      dispatch(fetchAssessmentReviewThunk(scope));
    },
    [dispatch],
  );

  const loadFieldHistory = useCallback(
    (scope: FlowScope) => {
      dispatch(fetchFieldHistoryThunk(scope));
    },
    [dispatch],
  );

  const submitAssessment = useCallback(
    async (scope: FlowScope) => {
      const action = await dispatch(submitAssessmentThunk(scope));
      return submitAssessmentThunk.fulfilled.match(action);
    },
    [dispatch],
  );

  const clearSubmit = useCallback(() => {
    dispatch(clearSubmitResult());
  }, [dispatch]);

  const loadRegenIndex = useCallback(
    (scope: FlowScope) => {
      dispatch(fetchFieldRegenIndexThunk(scope));
    },
    [dispatch],
  );

  const discard = useCallback(
    async (scope: FlowScope) => {
      const action = await dispatch(discardAssessmentThunk(scope));
      if (!discardAssessmentThunk.fulfilled.match(action)) {
        return null;
      }
      dispatch(clearResumePoint(scope));
      return action.payload.discardedAnswers;
    },
    [dispatch],
  );

  const rememberResumePoint = useCallback(
    (scope: FlowQuestionScope) => {
      dispatch(setResumePoint(scope));
    },
    [dispatch],
  );

  const goToAssessmentList = useCallback((navigation: FlowNavigation) => {
    resetToAssessmentTab(navigation);
  }, []);

  const goToFieldSummary = useCallback(
    (navigation: FlowNavigation, target: FlowSummaryTarget) => {
      resetToFieldSummary(navigation, target);
    },
    [],
  );

  return {
    role: 'farmer',
    routes: ROUTES,
    supportsDiscard: true,
    supportsRegenIndex: true,
    access,

    summary,
    programName,
    categories,
    categoryList,
    questions,
    categoryForm,
    questionDetail,
    review,
    submitResult,
    regenIndex,
    resumePoint,
    submitted: !!summary?.assessment.submitted,
    error,

    loadedSummaryScope,
    loadedReviewScope,
    loadedRegenScope,
    answerVersion,

    loadingSummary,
    loadingQuestions,
    loadingCategoryForm,
    savingCategoryForm,
    loadingQuestion,
    loadingReview,
    loadingRegenIndex,
    refreshing,
    saving,
    submitting,
    discarding,

    loadSummary,
    refreshSummary,
    loadCategoryQuestions,
    loadCategoryForm,
    saveCategoryAnswers,
    addCategoryRecord,
    saveCategoryRecord,
    deleteCategoryRecord,
    loadQuestionDetail,
    saveAnswer,
    loadReview,
    loadFieldHistory,
    submitAssessment,
    clearSubmitResult: clearSubmit,
    loadRegenIndex,
    discard,
    rememberResumePoint,
    goToAssessmentList,
    goToFieldSummary,
  };
};
