import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import {
  selectActiveVisit,
  selectAssessorVisitChecked,
} from '../../../redux/slices/visitSlice';
import {
  clearAssessorSubmitResult,
  fetchAssessorCategoryQuestionsThunk,
  fetchAssessorCategoryFormThunk,
  saveAssessorCategoryAnswersThunk,
  addAssessorCategoryRecordThunk,
  saveAssessorCategoryRecordThunk,
  deleteAssessorCategoryRecordThunk,
  fetchAssessorQuestionDetailThunk,
  fetchAssessorReviewThunk,
  fetchAssessorSummaryThunk,
  refreshAssessorSummaryThunk,
  saveAssessorAnswerThunk,
  selectAssessorAnswerVersion,
  selectAssessorCategories,
  selectAssessorCategoryForm,
  selectAssessorCategoryFormLoading,
  selectAssessorCategoryFormSaving,
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
  FlowSaveCategoryAnswersArg,
  FlowRecordScope,
  FlowSaveRecordArg,
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
  const categoryForm = useAppSelector(selectAssessorCategoryForm);
  const questionDetail = useAppSelector(selectAssessorQuestionDetail);
  const review = useAppSelector(selectAssessorReview);
  const submitResult = useAppSelector(selectAssessorSubmitResult);
  const locked = useAppSelector(selectAssessorLocked);
  const resumePoint = useAppSelector(selectResumePoint(programId, fieldId, 'assessor'));
  const error = useAppSelector(selectAssessorError);
  const activeVisit = useAppSelector(selectActiveVisit);
  const visitChecked = useAppSelector(selectAssessorVisitChecked);

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
  }, [activeVisit, fieldId, visitChecked, summary]);

  const loadedSummaryScope = useAppSelector(selectAssessorLoadedSummaryScope);
  const loadedReviewScope = useAppSelector(selectAssessorLoadedReviewScope);
  const answerVersion = useAppSelector(selectAssessorAnswerVersion);

  const loadingSummary = useAppSelector(selectAssessorSummaryLoading);
  const loadingQuestions = useAppSelector(selectAssessorQuestionsLoading);
  const loadingCategoryForm = useAppSelector(selectAssessorCategoryFormLoading);
  const savingCategoryForm = useAppSelector(selectAssessorCategoryFormSaving);
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

  const loadCategoryForm = useCallback(
    async (scope: FlowCategoryScope) => {
      await dispatch(fetchAssessorCategoryFormThunk(scope));
    },
    [dispatch],
  );

  const saveCategoryAnswers = useCallback(
    async (arg: FlowSaveCategoryAnswersArg) => {
      const action = await dispatch(saveAssessorCategoryAnswersThunk(arg));
      if (saveAssessorCategoryAnswersThunk.fulfilled.match(action)) {
        return { ok: true, closed: false, message: null };
      }
      const closed = action.payload?.code === 'ASSESSMENT_CLOSED';
      return { ok: false, closed, message: closed ? null : action.payload?.message ?? null };
    },
    [dispatch],
  );

  const addCategoryRecord = useCallback(
    async (arg: FlowSaveCategoryAnswersArg) => {
      const action = await dispatch(addAssessorCategoryRecordThunk(arg));
      if (addAssessorCategoryRecordThunk.fulfilled.match(action)) {
        return { ok: true, closed: false, message: null };
      }
      const closed = action.payload?.code === 'ASSESSMENT_CLOSED';
      return { ok: false, closed, message: closed ? null : action.payload?.message ?? null };
    },
    [dispatch],
  );

  const saveCategoryRecord = useCallback(
    async (arg: FlowSaveRecordArg) => {
      const action = await dispatch(saveAssessorCategoryRecordThunk(arg));
      if (saveAssessorCategoryRecordThunk.fulfilled.match(action)) {
        return { ok: true, closed: false, message: null };
      }
      const closed = action.payload?.code === 'ASSESSMENT_CLOSED';
      return { ok: false, closed, message: closed ? null : action.payload?.message ?? null };
    },
    [dispatch],
  );

  const deleteCategoryRecord = useCallback(
    async (arg: FlowRecordScope) => {
      const action = await dispatch(deleteAssessorCategoryRecordThunk(arg));
      if (deleteAssessorCategoryRecordThunk.fulfilled.match(action)) {
        return { ok: true, closed: false, message: null };
      }
      const closed = action.payload?.code === 'ASSESSMENT_CLOSED';
      return { ok: false, closed, message: closed ? null : action.payload?.message ?? null };
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
      if (saveAssessorAnswerThunk.fulfilled.match(action)) {
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
      dispatch(fetchAssessorReviewThunk(scope));
    },
    [dispatch],
  );

  const loadFieldHistory = loadReview;

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
    categoryForm,
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
    loadingCategoryForm,
    savingCategoryForm,
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
