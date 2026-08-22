import type { NavigationAction } from '@react-navigation/native';
import type {
  AssessmentCategorySummary,
  AssessmentQuestionDetail,
  AssessmentQuestionListItem,
  AssessmentReview,
  AssessmentSubmitResult,
  CategoryQuestionList,
  FieldAssessmentSummary,
  FieldRegenIndex,
  SaveAnswerInput,
} from '../../../types/assessment';
import type { ResumePoint } from '../../../redux/slices/assessmentProgressSlice';

export type AssessmentRole = 'farmer' | 'assessor';

export interface FlowScope {
  programId: string;
  fieldId: string;
}

export interface FlowCategoryScope extends FlowScope {
  categoryId: string;
}

export interface FlowQuestionScope extends FlowCategoryScope {
  questionId: string;
}

export interface FlowSummaryTarget extends FlowScope {
  fieldName?: string;
}

export interface FlowSaveAnswerArg extends FlowScope {
  questionId: string;
  input: SaveAnswerInput;
}

export interface FlowNavigation {
  navigate: (screen: string, params?: object) => void;
  setParams: (params: object) => void;
  goBack: () => void;
  dispatch: (action: NavigationAction) => void;
}

export interface FlowRoutes {
  summary: string;
  category: string;
  question: string;
  review: string;
}

export type AssessmentAccessState = 'open' | 'no_visit' | 'other_field' | 'en_route';

export interface AssessmentAccess {
  locked: boolean;
  state: AssessmentAccessState;
  resolved: boolean;
  visitId: string | null;
  otherFieldName: string | null;
}

export const OPEN_ACCESS: AssessmentAccess = {
  locked: false,
  state: 'open',
  resolved: true,
  visitId: null,
  otherFieldName: null,
};

export interface AssessmentFlow {
  role: AssessmentRole;
  routes: FlowRoutes;

  supportsDiscard: boolean;
  supportsRegenIndex: boolean;
  access: AssessmentAccess;

  summary: FieldAssessmentSummary | null;
  categories: AssessmentCategorySummary[];
  categoryList: CategoryQuestionList | null;
  questions: AssessmentQuestionListItem[];
  questionDetail: AssessmentQuestionDetail | null;
  review: AssessmentReview | null;
  submitResult: AssessmentSubmitResult | null;
  regenIndex: FieldRegenIndex | null;
  resumePoint: ResumePoint | null;
  submitted: boolean;
  error: string | null;

  loadedSummaryScope: string | null;
  loadedReviewScope: string | null;
  loadedRegenScope: string | null;
  answerVersion: number;

  loadingSummary: boolean;
  loadingQuestions: boolean;
  loadingQuestion: boolean;
  loadingReview: boolean;
  loadingRegenIndex: boolean;
  refreshing: boolean;
  saving: boolean;
  submitting: boolean;
  discarding: boolean;

  loadSummary: (scope: FlowScope) => void;
  refreshSummary: (scope: FlowScope) => void;
  loadCategoryQuestions: (scope: FlowCategoryScope) => Promise<void>;
  loadQuestionDetail: (scope: FlowQuestionScope) => void;
  saveAnswer: (arg: FlowSaveAnswerArg) => Promise<boolean>;
  loadReview: (scope: FlowScope) => void;
  submitAssessment: (scope: FlowScope) => Promise<boolean>;
  clearSubmitResult: () => void;
  loadRegenIndex: (scope: FlowScope) => void;
  discard: (scope: FlowScope) => Promise<number | null>;
  rememberResumePoint: (scope: FlowQuestionScope) => void;
  goToAssessmentList: (navigation: FlowNavigation) => void;
  goToFieldSummary: (navigation: FlowNavigation, target: FlowSummaryTarget) => void;
}
