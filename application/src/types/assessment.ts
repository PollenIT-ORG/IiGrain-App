import type { PageMeta } from './pagination';

export type AssessmentStatus =
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DRAFT'
  | 'PENDING'
  | 'FAILED';

export interface AssessmentSummary {
  id: string;
  title: string;
  status: AssessmentStatus;
  startedDateISO: string;
  completedQuestions: number;
  totalQuestions: number;
  progress: number;
  buttonTitle: string;
}

export interface AssessmentCategory {
  id: string;
  title: string;
  completed: number;
  total: number;
  percentage: number;
  icon: string;
  color: string;
}

export interface AssessmentHistoryItem {
  id: string;
  title: string;
  completedDateISO: string;
  score: number;
  status: AssessmentStatus;
}

export type QuestionScore = 0 | 1 | 2 | 3;

export type QuestionStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REVIEW_REQUIRED';

export type EvidenceType = 'image' | 'pdf' | 'video';
export type EvidenceUploadState = 'uploaded' | 'uploading' | 'failed';

export interface EvidenceFile {
  id: string;
  uri: string;
  name: string;
  type: EvidenceType;
  sizeLabel?: string;
  state: EvidenceUploadState;
}

export interface AssessmentQuestion {
  id: string;
  categoryId: string;
  index: number;
  code: string;
  title: string;
  description: string;
  score: QuestionScore | null;
  comment: string;
  attachments: EvidenceFile[];
  status: QuestionStatus;
  lastUpdatedISO: string | null;
}

export interface AssessmentProgress {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  reviewRequired: number;
  percentage: number;
}

export interface AssessmentField {
  id: string;
  name: string;
  farmId: string;
  farmName: string;
}

export interface AssessmentInfo {
  title: string;
  year: number;
  status: AssessmentStatus;
  totalQuestions: number;
  answered: number;
  percentage: number;
  /**
   * True only once the assessment has actually been SUBMITTED. `status` cannot
   * answer this: the backend's `completed` and `submitted` both map to
   * COMPLETED, and the slice also sets COMPLETED locally the moment the last
   * answer is saved.
   */
  submitted: boolean;
}

export interface AssessmentCategorySummary {
  id: string;
  name: string;
  totalQuestions: number;
  answered: number;
  percentage: number;
}

export interface FieldAssessmentSummary {
  field: AssessmentField;
  assessment: AssessmentInfo;
  categories: AssessmentCategorySummary[];
}

export interface AssessmentFieldRef {
  id: string;
  name: string;
}

export interface AssessmentCategoryRef {
  id: string;
  name: string;
}

export interface CategoryQuestionProgress {
  totalQuestions: number;
  answered: number;
  percentage: number;
}

export interface AssessmentQuestionListItem {
  id: string;
  code: string;
  text: string;
  guidance: string;
  answered: boolean;
}

export interface CategoryQuestionList {
  field: AssessmentFieldRef;
  category: AssessmentCategoryRef;
  progress: CategoryQuestionProgress;
  questions: AssessmentQuestionListItem[];
}

export interface QuestionScoreDescription {
  score: QuestionScore;
  description: string;
}

export interface AssessmentQuestionDetail {
  id: string;
  code: string;
  text: string;
  guidance: string;
  scoreDescriptions: QuestionScoreDescription[];
  answerScore: QuestionScore | null;
  answerComment: string | null;
  answerEvidenceUrls: string[];
  answered: boolean;
  locked: boolean;
}

/**
 * Save-answer body. `comment` and `evidenceUrls` are independently optional and
 * the backend distinguishes all three states, so the keys are optional AND
 * nullable on purpose:
 *
 *   key absent -> the stored value is kept
 *   null       -> the stored value is cleared
 *   a value    -> the stored value is overwritten
 *
 * Always build this with `buildAnswerPayload` so a score-only save omits the
 * keys it did not change instead of echoing them back.
 */
export interface SaveAnswerInput {
  score: QuestionScore;
  comment?: string | null;
  evidenceUrls?: string[] | null;
}

export interface SavedAnswer {
  id: string;
  fieldId: string;
  questionId: string;
  score: QuestionScore;
  comment: string;
  evidenceUrls: string[];
  createdAtISO: string;
  updatedAtISO: string;
}

export interface AssessmentReviewQuestion {
  id: string;
  code: string;
  text: string;
  score: QuestionScore | null;
  comment: string;
  evidenceUrls: string[];
  answered: boolean;
}

export interface AssessmentReviewCategory {
  id: string;
  name: string;
  totalQuestions: number;
  answered: number;
  percentage: number;
  questions: AssessmentReviewQuestion[];
}

export interface AssessmentSubmissionInfo {
  status: AssessmentStatus;
  submittedAtISO: string | null;
  totalQuestions: number;
  answered: number;
  percentage: number;
}

export interface AssessmentReview {
  field: AssessmentFieldRef;
  submission: AssessmentSubmissionInfo;
  categories: AssessmentReviewCategory[];
}

export interface MyAssessmentField {
  fieldId: string;
  fieldName: string;
  crop: string;
  fieldStatus: string;
  farmId: string;
  farmName: string;
  programId: string;
  programName: string;
  status: AssessmentStatus;
  totalQuestions: number;
  answered: number;
  percentage: number;
  submittedAtISO: string | null;
}

export interface MyAssessmentCounts {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
}

export interface MyAssessmentsOverview {
  year: number;
  title: string;
  counts: MyAssessmentCounts;
  fields: MyAssessmentField[];
  meta?: PageMeta;
}

export interface FieldRegenCategory {
  id: string;
  name: string;
  score: number | null;
  answered: number;
}

export interface FieldRegenIndex {
  field: AssessmentField;
  regenHealthIndex: number | null;
  rating: string | null;
  categories: FieldRegenCategory[];
  topCategory: string | null;
}

export interface AssessmentSubmitResult {
  field: AssessmentFieldRef;
  assessmentId: string;
  status: AssessmentStatus;
  totalQuestions: number;
  answered: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  submittedAtISO: string;
}