import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import {
  clearSubmitResult,
  discardAssessmentThunk,
  fetchAssessmentReviewThunk,
  fetchAssessmentSummaryThunk,
  fetchCategoryQuestionsThunk,
  fetchFieldRegenIndexThunk,
  fetchQuestionDetailThunk,
  refreshAssessmentSummaryThunk,
  saveAssessmentAnswerThunk,
  selectAnswerVersion,
  selectAssessmentCategories,
  selectAssessmentDiscarding,
  selectAssessmentError,
  selectAssessmentRefreshing,
  selectAssessmentReview,
  selectAssessmentSaving,
  selectAssessmentSubmitResult,
  selectAssessmentSubmitting,
  selectAssessmentSummary,
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
import {
  resetToAssessmentTab,
  resetToFieldSummary,
} from '../assessmentNavigation';
import { OPEN_ACCESS } from './flowTypes';
import type {
  AssessmentFlow,
  FlowCategoryScope,
  FlowNavigation,
  FlowQuestionScope,
  FlowSaveAnswerArg,
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
  const categories = useAppSelector(selectAssessmentCategories);
  const categoryList = useAppSelector(selectCategoryQuestionList);
  const questions = useAppSelector(selectQuestionList);
  const questionDetail = useAppSelector(selectQuestionDetail);
  const review = useAppSelector(selectAssessmentReview);
  const submitResult = useAppSelector(selectAssessmentSubmitResult);
  const regenIndex = useAppSelector(selectFieldRegenIndex);
  const resumePoint = useAppSelector(selectResumePoint(programId, fieldId));
  const error = useAppSelector(selectAssessmentError);

  const loadedSummaryScope = useAppSelector(selectLoadedSummaryScope);
  const loadedReviewScope = useAppSelector(selectLoadedReviewScope);
  const loadedRegenScope = useAppSelector(selectLoadedRegenScope);
  const answerVersion = useAppSelector(selectAnswerVersion);

  const loadingSummary = useAppSelector(selectSummaryLoading);
  const loadingQuestions = useAppSelector(selectQuestionsLoading);
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

  const loadQuestionDetail = useCallback(
    (scope: FlowQuestionScope) => {
      dispatch(fetchQuestionDetailThunk(scope));
    },
    [dispatch],
  );

  const saveAnswer = useCallback(
    async (arg: FlowSaveAnswerArg) => {
      const action = await dispatch(saveAssessmentAnswerThunk(arg));
      return saveAssessmentAnswerThunk.fulfilled.match(action);
    },
    [dispatch],
  );

  const loadReview = useCallback(
    (scope: FlowScope) => {
      dispatch(fetchAssessmentReviewThunk(scope));
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
    access: OPEN_ACCESS,

    summary,
    categories,
    categoryList,
    questions,
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
    loadQuestionDetail,
    saveAnswer,
    loadReview,
    submitAssessment,
    clearSubmitResult: clearSubmit,
    loadRegenIndex,
    discard,
    rememberResumePoint,
    goToAssessmentList,
    goToFieldSummary,
  };
};
