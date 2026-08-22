import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import {
  selectActiveVisit,
  selectAssessorVisitChecked,
} from '../../../redux/slices/visitSlice';
import {
  clearAssessorSubmitResult,
  fetchAssessorCategoryQuestionsThunk,
  fetchAssessorQuestionDetailThunk,
  fetchAssessorReviewThunk,
  fetchAssessorSummaryThunk,
  refreshAssessorSummaryThunk,
  saveAssessorAnswerThunk,
  selectAssessorAnswerVersion,
  selectAssessorCategories,
  selectAssessorCategoryQuestionList,
  selectAssessorError,
  selectAssessorLoadedReviewScope,
  selectAssessorLoadedSummaryScope,
  selectAssessorLocked,
  selectAssessorQuestionDetail,
  selectAssessorQuestionList,
  selectAssessorQuestionLoading,
  selectAssessorQuestionsLoading,
  selectAssessorRefreshing,
  selectAssessorReview,
  selectAssessorReviewLoading,
  selectAssessorSaving,
  selectAssessorSubmitResult,
  selectAssessorSubmitting,
  selectAssessorSummary,
  selectAssessorSummaryLoading,
  submitAssessorAssessmentThunk,
} from '../../../redux/slices/assessorSlice';
import {
  selectResumePoint,
  setResumePoint,
} from '../../../redux/slices/assessmentProgressSlice';
import {
  resetToAssessorFieldSummary,
  resetToAssessorHome,
  resetToAssessorVisit,
} from '../../assessor/assessorNavigation';
import type {
  AssessmentAccess,
  AssessmentFlow,
  FlowCategoryScope,
  FlowNavigation,
  FlowQuestionScope,
  FlowSaveAnswerArg,
  FlowScope,
  FlowSummaryTarget,
} from './flowTypes';

const ROUTES = {
  summary: 'AssessorAssessmentSummary',
  category: 'AssessorCategory',
  question: 'AssessorQuestion',
  review: 'AssessorReview',
} as const;

export const useAssessorAssessmentFlow = (
  programId: string,
  fieldId: string,
): AssessmentFlow => {
  const dispatch = useAppDispatch();

  const summary = useAppSelector(selectAssessorSummary);
  const categories = useAppSelector(selectAssessorCategories);
  const categoryList = useAppSelector(selectAssessorCategoryQuestionList);
  const questions = useAppSelector(selectAssessorQuestionList);
  const questionDetail = useAppSelector(selectAssessorQuestionDetail);
  const review = useAppSelector(selectAssessorReview);
  const submitResult = useAppSelector(selectAssessorSubmitResult);
  const locked = useAppSelector(selectAssessorLocked);
  const resumePoint = useAppSelector(selectResumePoint(programId, fieldId, 'assessor'));
  const error = useAppSelector(selectAssessorError);
  const activeVisit = useAppSelector(selectActiveVisit);
  const visitChecked = useAppSelector(selectAssessorVisitChecked);

  const access = useMemo<AssessmentAccess>(() => {
    if (!activeVisit) {
      return {
        locked: true,
        state: 'no_visit',
        resolved: visitChecked,
        visitId: null,
        otherFieldName: null,
      };
    }
    if (activeVisit.fieldId !== fieldId) {
      return {
        locked: true,
        state: 'other_field',
        resolved: true,
        visitId: null,
        otherFieldName: activeVisit.fieldName ?? null,
      };
    }
    if (activeVisit.status !== 'arrived') {
      return {
        locked: true,
        state: 'en_route',
        resolved: true,
        visitId: activeVisit.id,
        otherFieldName: null,
      };
    }
    return {
      locked: false,
      state: 'open',
      resolved: true,
      visitId: activeVisit.id,
      otherFieldName: null,
    };
  }, [activeVisit, fieldId, visitChecked]);

  const loadedSummaryScope = useAppSelector(selectAssessorLoadedSummaryScope);
  const loadedReviewScope = useAppSelector(selectAssessorLoadedReviewScope);
  const answerVersion = useAppSelector(selectAssessorAnswerVersion);

  const loadingSummary = useAppSelector(selectAssessorSummaryLoading);
  const loadingQuestions = useAppSelector(selectAssessorQuestionsLoading);
  const loadingQuestion = useAppSelector(selectAssessorQuestionLoading);
  const loadingReview = useAppSelector(selectAssessorReviewLoading);
  const refreshing = useAppSelector(selectAssessorRefreshing);
  const saving = useAppSelector(selectAssessorSaving);
  const submitting = useAppSelector(selectAssessorSubmitting);

  const loadSummary = useCallback(
    (scope: FlowScope) => {
      dispatch(fetchAssessorSummaryThunk(scope));
    },
    [dispatch],
  );

  const refreshSummary = useCallback(
    (scope: FlowScope) => {
      dispatch(refreshAssessorSummaryThunk(scope));
    },
    [dispatch],
  );

  const loadCategoryQuestions = useCallback(
    async (scope: FlowCategoryScope) => {
      await dispatch(fetchAssessorCategoryQuestionsThunk(scope));
    },
    [dispatch],
  );

  const loadQuestionDetail = useCallback(
    (scope: FlowQuestionScope) => {
      dispatch(fetchAssessorQuestionDetailThunk(scope));
    },
    [dispatch],
  );

  const saveAnswer = useCallback(
    async (arg: FlowSaveAnswerArg) => {
      const action = await dispatch(saveAssessorAnswerThunk(arg));
      return saveAssessorAnswerThunk.fulfilled.match(action);
    },
    [dispatch],
  );

  const loadReview = useCallback(
    (scope: FlowScope) => {
      dispatch(fetchAssessorReviewThunk(scope));
    },
    [dispatch],
  );

  const submitAssessment = useCallback(
    async (scope: FlowScope) => {
      const action = await dispatch(submitAssessorAssessmentThunk(scope));
      return submitAssessorAssessmentThunk.fulfilled.match(action);
    },
    [dispatch],
  );

  const clearSubmit = useCallback(() => {
    dispatch(clearAssessorSubmitResult());
  }, [dispatch]);

  const loadRegenIndex = useCallback(() => {}, []);

  const discard = useCallback(async () => null, []);

  const rememberResumePoint = useCallback(
    (scope: FlowQuestionScope) => {
      dispatch(setResumePoint({ ...scope, role: 'assessor' }));
    },
    [dispatch],
  );

  const liveVisitId = access.visitId;
  const goToAssessmentList = useCallback(
    (navigation: FlowNavigation) => {
      if (liveVisitId) {
        resetToAssessorVisit(navigation, liveVisitId);
        return;
      }
      resetToAssessorHome(navigation);
    },
    [liveVisitId],
  );

  const goToFieldSummary = useCallback(
    (navigation: FlowNavigation, target: FlowSummaryTarget) => {
      resetToAssessorFieldSummary(navigation, target);
    },
    [],
  );

  return {
    role: 'assessor',
    routes: ROUTES,
    supportsDiscard: false,
    supportsRegenIndex: false,
    access,

    summary,
    categories,
    categoryList,
    questions,
    questionDetail,
    review,
    submitResult,
    regenIndex: null,
    resumePoint,
    submitted: locked || !!summary?.assessment.submitted,
    error,

    loadedSummaryScope,
    loadedReviewScope,
    loadedRegenScope: null,
    answerVersion,

    loadingSummary,
    loadingQuestions,
    loadingQuestion,
    loadingReview,
    loadingRegenIndex: false,
    refreshing,
    saving,
    submitting,
    discarding: false,

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
