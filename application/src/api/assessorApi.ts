import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import type {
  AssessmentCategorySummary,
  AssessmentQuestionDetail,
  AssessmentQuestionListItem,
  AssessmentReview,
  AssessmentReviewCategory,
  AssessmentReviewQuestion,
  AssessmentStatus,
  AssessmentSubmissionInfo,
  AssessmentSubmitResult,
  CategoryQuestionList,
  FieldAssessmentSummary,
  QuestionScore,
  QuestionScoreDescription,
  SaveAnswerInput,
  SavedAnswer,
} from '../types/assessment';
import type {
  AssessorAssessmentSummary,
  AssessorComparison,
  AssessorFieldEntry,
  AssessorFieldsOverview,
  ComparisonCategory,
  ComparisonQuestion,
  FarmerAssessmentAnswer,
  FarmerAssessmentCategory,
  FarmerAssessmentView,
} from '../types/assessor';

interface Envelope<T> {
  data: T;
}

const toQuestionScore = (raw: number | null | undefined): QuestionScore | null =>
  raw === 0 || raw === 1 || raw === 2 || raw === 3 ? raw : null;

const mapAssessmentStatus = (raw: string): AssessmentStatus => {
  switch (raw) {
    case 'in_progress':
      return 'IN_PROGRESS';
    case 'completed':
    case 'submitted':
      return 'COMPLETED';
    case 'not_started':
    default:
      return 'PENDING';
  }
};

const toPercentage = (raw: string | number | null | undefined): number => {
  const n = typeof raw === 'string' ? Number.parseFloat(raw) : raw ?? 0;
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(Math.max(n, 0), 100);
};

const mapScoreDescriptions = (
  raw: RawScoreDescriptions | undefined,
): QuestionScoreDescription[] => [
  { score: 0, description: raw?.score0 ?? '' },
  { score: 1, description: raw?.score1 ?? '' },
  { score: 2, description: raw?.score2 ?? '' },
  { score: 3, description: raw?.score3 ?? '' },
];

interface RawRef {
  id: string;
  name: string;
}

const mapRef = (raw: RawRef): { id: string; name: string } => ({
  id: raw.id,
  name: raw.name ?? '',
});

interface RawFieldEntry {
  field: {
    id: string;
    name: string;
    crop: string;
    status: string;
    location?: string | null;
    address?: string | null;
    areaAcres?: number | string | null;
    area_acres?: number | string | null;
  };
  farm: RawRef;
  farmer: RawRef;
  program?: { id: string | null; name: string | null } | null;
  assessment: {
    status: string;
    inProgress: boolean;
    completed: boolean;
    totalQuestions: number;
    answered: number;
    percentage: number;
    submittedAt: string | null;
    farmerSubmitted: boolean;
  };
}

interface FieldsPayload {
  year: number;
  title: string;
  counts: { total: number; notStarted: number; inProgress: number; completed: number };
  fields: RawFieldEntry[];
}

const toAcres = (raw: number | string | null | undefined): number | null => {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const n = typeof raw === 'string' ? Number.parseFloat(raw) : raw;
  return Number.isFinite(n) && n > 0 ? n : null;
};

const toText = (raw: string | null | undefined): string | null => {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
};

const mapFieldEntry = (raw: RawFieldEntry): AssessorFieldEntry => ({
  field: {
    id: raw.field.id,
    name: raw.field.name ?? '',
    crop: raw.field.crop ?? '',
    status: raw.field.status ?? '',
    location: toText(raw.field.location) ?? toText(raw.field.address),
    areaAcres: toAcres(raw.field.areaAcres ?? raw.field.area_acres),
  },
  farm: mapRef(raw.farm),
  farmer: mapRef(raw.farmer),
  program: { id: raw.program?.id ?? '', name: raw.program?.name ?? '' },
  assessment: {
    status: mapAssessmentStatus(raw.assessment.status),
    inProgress: !!raw.assessment.inProgress,
    completed: !!raw.assessment.completed,
    totalQuestions: raw.assessment.totalQuestions ?? 0,
    answered: raw.assessment.answered ?? 0,
    percentage: toPercentage(raw.assessment.percentage),
    submittedAtISO: raw.assessment.submittedAt ?? null,
    farmerSubmitted: !!raw.assessment.farmerSubmitted,
  },
});

const mapFieldsOverview = (payload: FieldsPayload): AssessorFieldsOverview => ({
  year: payload.year ?? 0,
  title: payload.title ?? '',
  counts: {
    total: payload.counts?.total ?? 0,
    notStarted: payload.counts?.notStarted ?? 0,
    inProgress: payload.counts?.inProgress ?? 0,
    completed: payload.counts?.completed ?? 0,
  },
  fields: (payload.fields ?? []).map(mapFieldEntry),
});

interface SummaryPayload {
  field: RawRef;
  farmer: RawRef;
  assessment: {
    title: string;
    year: number;
    status: string;
    totalQuestions: number;
    answered: number;
    percentage: number;
  };
  categories: {
    id: string;
    name: string;
    totalQuestions: number;
    answered: number;
    percentage: number;
  }[];
}

const mapAssessorSummary = (payload: SummaryPayload): AssessorAssessmentSummary => {
  const status = mapAssessmentStatus(payload.assessment.status);
  const categories: AssessmentCategorySummary[] = (payload.categories ?? []).map(c => ({
    id: c.id,
    name: c.name ?? '',
    totalQuestions: c.totalQuestions ?? 0,
    answered: c.answered ?? 0,
    percentage: toPercentage(c.percentage),
  }));
  const summary: FieldAssessmentSummary = {
    field: { id: payload.field.id, name: payload.field.name ?? '', farmId: '', farmName: '' },
    assessment: {
      title: payload.assessment.title ?? '',
      year: payload.assessment.year ?? 0,
      status,
      totalQuestions: payload.assessment.totalQuestions ?? 0,
      answered: payload.assessment.answered ?? 0,
      percentage: toPercentage(payload.assessment.percentage),
      submitted: payload.assessment.status === 'submitted',
    },
    categories,
  };
  return { summary, submittedBy: null, locked: false };
};

interface RawQuestionListItem {
  id: string;
  questionCode: string;
  questionText: string;
  guidanceNote: string | null;
  answered: boolean;
}

interface CategoryQuestionsPayload {
  field: RawRef;
  category: RawRef;
  progress: { totalQuestions: number; answered: number; percentage: number };
  questions: RawQuestionListItem[];
}

const mapQuestionListItem = (raw: RawQuestionListItem): AssessmentQuestionListItem => ({
  id: raw.id,
  code: raw.questionCode ?? '',
  text: raw.questionText ?? '',
  guidance: raw.guidanceNote ?? '',
  answered: !!raw.answered,
});

const mapCategoryQuestionList = (payload: CategoryQuestionsPayload): CategoryQuestionList => ({
  field: mapRef(payload.field),
  category: mapRef(payload.category),
  progress: {
    totalQuestions: payload.progress?.totalQuestions ?? 0,
    answered: payload.progress?.answered ?? 0,
    percentage: toPercentage(payload.progress?.percentage),
  },
  questions: (payload.questions ?? []).map(mapQuestionListItem),
});

interface RawScoreDescriptions {
  score0?: string;
  score1?: string;
  score2?: string;
  score3?: string;
}

interface RawQuestionDetail {
  id: string;
  questionCode: string;
  questionText: string;
  guidanceNote: string | null;
  scoreDescriptions: RawScoreDescriptions;
  answerScore: number | null;
  answerComment: string | null;
  answerEvidenceUrls: string[];
  answered: boolean;
}

interface QuestionDetailPayload {
  field: RawRef;
  category: RawRef;
  question: RawQuestionDetail;
  locked: boolean;
}

const mapQuestionDetail = (payload: QuestionDetailPayload): AssessmentQuestionDetail => {
  const q = payload.question;
  return {
    id: q.id,
    code: q.questionCode ?? '',
    text: q.questionText ?? '',
    guidance: q.guidanceNote ?? '',
    scoreDescriptions: mapScoreDescriptions(q.scoreDescriptions),
    answerScore: toQuestionScore(q.answerScore),
    answerComment: q.answerComment ?? null,
    answerEvidenceUrls: q.answerEvidenceUrls ?? [],
    answered: !!q.answered,
    locked: !!payload.locked,
  };
};

interface RawSavedAnswer {
  id: string;
  field_id: string;
  question_id: string;
  score: number;
  comment: string | null;
  evidence_urls: string[];
  created_at: string;
  updated_at: string;
}

interface SaveAnswerPayload {
  response: RawSavedAnswer;
}

const mapSavedAnswer = (raw: RawSavedAnswer): SavedAnswer => ({
  id: raw.id,
  fieldId: raw.field_id,
  questionId: raw.question_id,
  score: toQuestionScore(raw.score) ?? 0,
  comment: raw.comment ?? '',
  evidenceUrls: raw.evidence_urls ?? [],
  createdAtISO: raw.created_at,
  updatedAtISO: raw.updated_at,
});

interface RawReviewQuestion {
  id: string;
  questionCode: string;
  questionText: string;
  answerScore: number | null;
  answerComment: string | null;
  answerEvidenceUrls: string[];
  answered: boolean;
}

interface RawReviewCategory {
  id: string;
  name: string;
  totalQuestions: number;
  answered: number;
  percentage: number;
  questions: RawReviewQuestion[];
}

interface RawSubmission {
  status: string;
  submittedAt: string | null;
  totalQuestions: number;
  answered: number;
  percentage: number;
}

interface ReviewPayload {
  field: RawRef;
  submission: RawSubmission;
  categories: RawReviewCategory[];
}

const mapReviewQuestion = (raw: RawReviewQuestion): AssessmentReviewQuestion => ({
  id: raw.id,
  code: raw.questionCode ?? '',
  text: raw.questionText ?? '',
  score: toQuestionScore(raw.answerScore),
  comment: raw.answerComment ?? '',
  evidenceUrls: raw.answerEvidenceUrls ?? [],
  answered: !!raw.answered,
});

const mapReviewCategory = (raw: RawReviewCategory): AssessmentReviewCategory => ({
  id: raw.id,
  name: raw.name ?? '',
  totalQuestions: raw.totalQuestions ?? 0,
  answered: raw.answered ?? 0,
  percentage: toPercentage(raw.percentage),
  questions: (raw.questions ?? []).map(mapReviewQuestion),
});

const mapSubmission = (raw: RawSubmission): AssessmentSubmissionInfo => ({
  status: mapAssessmentStatus(raw.status),
  submittedAtISO: raw.submittedAt ?? null,
  totalQuestions: raw.totalQuestions ?? 0,
  answered: raw.answered ?? 0,
  percentage: toPercentage(raw.percentage),
});

const mapReview = (payload: ReviewPayload): AssessmentReview => ({
  field: mapRef(payload.field),
  submission: mapSubmission(payload.submission),
  categories: (payload.categories ?? []).map(mapReviewCategory),
});

interface RawSubmitAssessment {
  id: string;
  field_id: string;
  status: string;
  total_questions: number;
  answered: number;
  total_score: number;
  max_score: number;
  percentage: string | number;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

interface SubmitPayload {
  field: RawRef;
  assessment: RawSubmitAssessment;
}

const mapSubmitResult = (payload: SubmitPayload): AssessmentSubmitResult => {
  const a = payload.assessment;
  return {
    field: mapRef(payload.field),
    assessmentId: a.id,
    status: mapAssessmentStatus(a.status),
    totalQuestions: a.total_questions ?? 0,
    answered: a.answered ?? 0,
    totalScore: a.total_score ?? 0,
    maxScore: a.max_score ?? 0,
    percentage: toPercentage(a.percentage),
    submittedAtISO: a.submitted_at,
  };
};

interface RawFarmerQuestion {
  id: string;
  questionCode: string;
  questionText: string;
  answerScore: number | null;
  answerComment: string | null;
  answerEvidenceUrls: string[];
  answered: boolean;
}

interface RawFarmerCategory {
  id: string;
  name: string;
  questions: RawFarmerQuestion[];
}

interface FarmerAssessmentPayload {
  field: RawRef;
  farmerSubmitted: boolean;
  submittedAt: string | null;
  categories: RawFarmerCategory[];
}

const mapFarmerQuestion = (raw: RawFarmerQuestion): FarmerAssessmentAnswer => ({
  id: raw.id,
  code: raw.questionCode ?? '',
  text: raw.questionText ?? '',
  score: toQuestionScore(raw.answerScore),
  comment: raw.answerComment ?? '',
  evidenceUrls: raw.answerEvidenceUrls ?? [],
  answered: !!raw.answered,
});

const mapFarmerCategory = (raw: RawFarmerCategory): FarmerAssessmentCategory => ({
  id: raw.id,
  name: raw.name ?? '',
  questions: (raw.questions ?? []).map(mapFarmerQuestion),
});

const mapFarmerAssessment = (payload: FarmerAssessmentPayload): FarmerAssessmentView => ({
  field: mapRef(payload.field),
  farmerSubmitted: !!payload.farmerSubmitted,
  submittedAtISO: payload.submittedAt ?? null,
  categories: (payload.categories ?? []).map(mapFarmerCategory),
});

interface RawComparisonQuestion {
  id: string;
  questionCode: string;
  questionText: string;
  farmerScore: number | null;
  assessorScore: number | null;
  difference: number | null;
}

interface RawComparisonCategory {
  id: string;
  name: string;
  questions: RawComparisonQuestion[];
}

interface ComparisonPayload {
  field: RawRef;
  farmer: { submitted: boolean; percentage: number };
  assessor: { submitted: boolean; percentage: number };
  categories: RawComparisonCategory[];
}

const mapComparisonQuestion = (raw: RawComparisonQuestion): ComparisonQuestion => ({
  id: raw.id,
  code: raw.questionCode ?? '',
  text: raw.questionText ?? '',
  farmerScore: toQuestionScore(raw.farmerScore),
  assessorScore: toQuestionScore(raw.assessorScore),
  difference: raw.difference ?? null,
});

const mapComparisonCategory = (raw: RawComparisonCategory): ComparisonCategory => ({
  id: raw.id,
  name: raw.name ?? '',
  questions: (raw.questions ?? []).map(mapComparisonQuestion),
});

const mapComparison = (payload: ComparisonPayload): AssessorComparison => ({
  field: mapRef(payload.field),
  farmer: { submitted: !!payload.farmer?.submitted, percentage: toPercentage(payload.farmer?.percentage) },
  assessor: { submitted: !!payload.assessor?.submitted, percentage: toPercentage(payload.assessor?.percentage) },
  categories: (payload.categories ?? []).map(mapComparisonCategory),
});

const trace = (label: string, payload: Record<string, unknown>): void => {
  if (__DEV__) {
    console.log(`[assessorApi] ${label} →`, payload);
  }
};

export const getFields = async (): Promise<AssessorFieldsOverview> => {
  trace('GET fields', { url: Endpoints.assessor.fields });
  const res = await http.get<Envelope<FieldsPayload>>(Endpoints.assessor.fields);
  return mapFieldsOverview(res.data.data);
};

export const getSummary = async (
  programId: string,
  fieldId: string,
): Promise<AssessorAssessmentSummary> => {
  trace('GET summary', { programId, fieldId });
  const res = await http.get<Envelope<SummaryPayload>>(
    Endpoints.assessor.summary(programId, fieldId),
  );
  return mapAssessorSummary(res.data.data);
};

export const getCategoryQuestions = async (
  programId: string,
  fieldId: string,
  categoryId: string,
): Promise<CategoryQuestionList> => {
  trace('GET categoryQuestions', { programId, fieldId, categoryId });
  const res = await http.get<Envelope<CategoryQuestionsPayload>>(
    Endpoints.assessor.categoryQuestions(programId, fieldId, categoryId),
  );
  return mapCategoryQuestionList(res.data.data);
};

export const getQuestion = async (
  programId: string,
  fieldId: string,
  categoryId: string,
  questionId: string,
): Promise<AssessmentQuestionDetail> => {
  trace('GET question', { programId, fieldId, categoryId, questionId });
  const res = await http.get<Envelope<QuestionDetailPayload>>(
    Endpoints.assessor.question(programId, fieldId, categoryId, questionId),
  );
  return mapQuestionDetail(res.data.data);
};

export const saveAnswer = async (
  programId: string,
  fieldId: string,
  questionId: string,
  input: SaveAnswerInput,
): Promise<SavedAnswer> => {
  trace('PUT saveAnswer', {
    url: Endpoints.assessor.saveAnswer(programId, fieldId, questionId),
    programId,
    fieldId,
    questionId,
    body: input,
  });
  const res = await http.put<Envelope<SaveAnswerPayload>>(
    Endpoints.assessor.saveAnswer(programId, fieldId, questionId),
    input,
  );
  return mapSavedAnswer(res.data.data.response);
};

export const getReview = async (
  programId: string,
  fieldId: string,
): Promise<AssessmentReview> => {
  trace('GET review', { programId, fieldId });
  const res = await http.get<Envelope<ReviewPayload>>(
    Endpoints.assessor.review(programId, fieldId),
  );
  return mapReview(res.data.data);
};

export const submit = async (
  programId: string,
  fieldId: string,
): Promise<AssessmentSubmitResult> => {
  trace('POST submit', { programId, fieldId, url: Endpoints.assessor.submit(programId, fieldId) });
  const res = await http.post<Envelope<SubmitPayload>>(
    Endpoints.assessor.submit(programId, fieldId),
  );
  return mapSubmitResult(res.data.data);
};

export const getFarmerAssessment = async (
  programId: string,
  fieldId: string,
): Promise<FarmerAssessmentView> => {
  trace('GET farmerAssessment', { programId, fieldId });
  const res = await http.get<Envelope<FarmerAssessmentPayload>>(
    Endpoints.assessor.farmerAssessment(programId, fieldId),
  );
  return mapFarmerAssessment(res.data.data);
};

export const getComparison = async (
  programId: string,
  fieldId: string,
): Promise<AssessorComparison> => {
  trace('GET comparison', { programId, fieldId });
  const res = await http.get<Envelope<ComparisonPayload>>(
    Endpoints.assessor.comparison(programId, fieldId),
  );
  return mapComparison(res.data.data);
};
