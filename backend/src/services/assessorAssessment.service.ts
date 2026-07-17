import ApiError from "../utils/ApiError.js";
import {
  listAssessorFields,
  assessorCanAccessField,
  resolveProgramForField,
  findFieldWithFarmer,
  getCategoryProgressForField,
  getCategoryQuestionsForField,
  listCategoryQuestionsForField,
  findCategoryQuestionForField,
  findActiveCategory,
  findActiveQuestion,
  upsertResponse,
  isFieldSubmitted,
  findFieldAssessment,
  submitFieldAssessment,
  getReviewRowsForField,
  getComparisonRowsForField,
  type AssessorFieldRow,
  type SavedResponse,
  type FieldAssessment,
} from "../models/assessmentMobile.model.js";

function pct(answered: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((answered / total) * 1000) / 10;
}

const ROLE = "assessor" as const;

export interface AssessorFieldCard {
  field: { id: string; name: string; crop: string | null; status: string };
  farm: { id: string; name: string };
  farmer: { id: string; name: string | null };
  assessment: {
    status: "not_started" | "in_progress" | "completed";
    inProgress: boolean;
    completed: boolean;
    totalQuestions: number;
    answered: number;
    percentage: number;
    submittedAt: string | null;
    farmerSubmitted: boolean;
  };
}

export async function getAssessorFieldList(
  assessorId: string,
  year: number
): Promise<{
  year: number;
  title: string;
  counts: { total: number; notStarted: number; inProgress: number; completed: number };
  fields: AssessorFieldCard[];
}> {
  const rows = await listAssessorFields(assessorId);

  let notStarted = 0;
  let inProgress = 0;
  let completed = 0;

  const fields: AssessorFieldCard[] = rows.map((r: AssessorFieldRow) => {
    const status: AssessorFieldCard["assessment"]["status"] = r.assessor_submitted
      ? "completed"
      : r.assessor_answered > 0
        ? "in_progress"
        : "not_started";
    if (status === "completed") completed += 1;
    else if (status === "in_progress") inProgress += 1;
    else notStarted += 1;

    const percentage =
      status === "completed" && r.assessor_percentage !== null
        ? Math.round(Number(r.assessor_percentage) * 10) / 10
        : pct(r.assessor_answered, r.total_questions);

    return {
      field: { id: r.id, name: r.name, crop: r.crop, status: r.status },
      farm: { id: r.farm_id, name: r.farm_name },
      farmer: { id: r.farmer_id, name: r.farmer_name },
      assessment: {
        status,
        inProgress: status === "in_progress",
        completed: status === "completed",
        totalQuestions: r.total_questions,
        answered: r.assessor_answered,
        percentage,
        submittedAt: r.assessor_submitted_at
          ? r.assessor_submitted_at.toISOString()
          : null,
        farmerSubmitted: r.farmer_submitted,
      },
    };
  });

  return {
    year,
    title: `${year} Annual Assessment`,
    counts: { total: fields.length, notStarted, inProgress, completed },
    fields,
  };
}

async function assertAssessorField(
  fieldId: string,
  assessorId: string
): Promise<{ id: string; name: string; farmer_id: string; farmer_name: string | null }> {
  const ok = await assessorCanAccessField(assessorId, fieldId);
  if (!ok) throw ApiError.notFound("Field not found.");
  const field = await findFieldWithFarmer(fieldId);
  if (!field) throw ApiError.notFound("Field not found.");
  return field;
}

export async function getAssessorSummary(
  fieldId: string,
  assessorId: string,
  year: number
) {
  const field = await assertAssessorField(fieldId, assessorId);
  const rows = await getCategoryProgressForField(fieldId, ROLE);

  const categories = rows.map((r) => ({
    id: r.id,
    name: r.name,
    totalQuestions: r.total_questions,
    answered: r.answered,
    percentage: pct(r.answered, r.total_questions),
  }));
  const totalQuestions = categories.reduce((s, c) => s + c.totalQuestions, 0);
  const answered = categories.reduce((s, c) => s + c.answered, 0);
  const status =
    answered === 0
      ? "not_started"
      : answered >= totalQuestions && totalQuestions > 0
        ? "completed"
        : "in_progress";

  return {
    field: { id: field.id, name: field.name },
    farmer: { id: field.farmer_id, name: field.farmer_name },
    assessment: {
      title: `${year} Annual Assessment (Assessor)`,
      year,
      status,
      totalQuestions,
      answered,
      percentage: pct(answered, totalQuestions),
    },
    categories,
  };
}

export async function getAssessorCategoryQuestionList(
  fieldId: string,
  categoryId: string,
  assessorId: string
) {
  const field = await assertAssessorField(fieldId, assessorId);
  const category = await findActiveCategory(categoryId);
  if (!category) throw ApiError.notFound("Category not found.");
  const rows = await listCategoryQuestionsForField(categoryId, fieldId, ROLE);
  const questions = rows.map((q) => ({
    id: q.id,
    questionCode: q.question_code,
    questionText: q.question_text,
    guidanceNote: q.guidance_note,
    answered: q.answered,
  }));
  const answered = questions.filter((q) => q.answered).length;
  return {
    field: { id: field.id, name: field.name },
    category: { id: category.id, name: category.name },
    progress: {
      totalQuestions: questions.length,
      answered,
      percentage: pct(answered, questions.length),
    },
    questions,
  };
}

export async function getAssessorCategoryQuestions(
  fieldId: string,
  categoryId: string,
  assessorId: string
) {
  const field = await assertAssessorField(fieldId, assessorId);
  const category = await findActiveCategory(categoryId);
  if (!category) throw ApiError.notFound("Category not found.");
  const rows = await getCategoryQuestionsForField(categoryId, fieldId, ROLE);
  const questions = rows.map((q) => ({
    id: q.id,
    questionCode: q.question_code,
    questionText: q.question_text,
    guidanceNote: q.guidance_note,
    scoreDescriptions: {
      score0: q.score0_description,
      score1: q.score1_description,
      score2: q.score2_description,
      score3: q.score3_description,
    },
    answerScore: q.answer_score,
    answerComment: q.answer_comment,
    answerEvidenceUrls: q.answer_evidence_urls ?? [],
    answered: q.answer_score !== null,
  }));
  const answered = questions.filter((q) => q.answered).length;
  return {
    field: { id: field.id, name: field.name },
    category: { id: category.id, name: category.name },
    progress: {
      totalQuestions: questions.length,
      answered,
      percentage: pct(answered, questions.length),
    },
    questions,
  };
}

export async function getAssessorQuestionDetail(
  fieldId: string,
  categoryId: string,
  questionId: string,
  assessorId: string
) {
  const field = await assertAssessorField(fieldId, assessorId);
  const category = await findActiveCategory(categoryId);
  if (!category) throw ApiError.notFound("Category not found.");
  const q = await findCategoryQuestionForField(categoryId, questionId, fieldId, ROLE);
  if (!q) throw ApiError.notFound("Question not found.");
  const locked = await isFieldSubmitted(fieldId, ROLE);
  return {
    field: { id: field.id, name: field.name },
    category: { id: category.id, name: category.name },
    question: {
      id: q.id,
      questionCode: q.question_code,
      questionText: q.question_text,
      guidanceNote: q.guidance_note,
      scoreDescriptions: {
        score0: q.score0_description,
        score1: q.score1_description,
        score2: q.score2_description,
        score3: q.score3_description,
      },
      answerScore: q.answer_score,
      answerComment: q.answer_comment,
      answerEvidenceUrls: q.answer_evidence_urls ?? [],
      answered: q.answer_score !== null,
    },
    locked,
  };
}

export interface SaveAnswerInput {
  score: number;
  comment?: string;
  evidenceUrls?: string[];
}

export async function saveAssessorAnswer(
  fieldId: string,
  questionId: string,
  assessorId: string,
  input: SaveAnswerInput
): Promise<SavedResponse> {
  await assertAssessorField(fieldId, assessorId);
  if (await isFieldSubmitted(fieldId, ROLE)) {
    throw ApiError.forbidden(
      "Your assessment has been submitted and can no longer be edited."
    );
  }
  const question = await findActiveQuestion(questionId);
  if (!question) throw ApiError.notFound("Question not found.");
  const evidenceUrls = input.evidenceUrls ?? [];
  if (evidenceUrls.length > 5) {
    throw ApiError.badRequest("You can attach at most 5 files.");
  }
  const programId = await resolveProgramForField(fieldId);
  return upsertResponse({
    fieldId,
    questionId,
    score: input.score,
    comment: input.comment?.trim() ? input.comment.trim() : null,
    evidenceUrls,
    authorRole: ROLE,
    authorId: assessorId,
    programId,
  });
}

export async function getAssessorReview(fieldId: string, assessorId: string) {
  const field = await assertAssessorField(fieldId, assessorId);
  const rows = await getReviewRowsForField(fieldId, ROLE);
  const submission = await findFieldAssessment(fieldId, ROLE);

  const byCat = new Map<string, {
    id: string; name: string; totalQuestions: number; answered: number;
    percentage: number;
    questions: Array<{ id: string; questionCode: string | null; questionText: string; answerScore: number | null; answerComment: string | null; answerEvidenceUrls: string[]; answered: boolean }>;
  }>();
  for (const r of rows) {
    let cat = byCat.get(r.category_id);
    if (!cat) {
      cat = { id: r.category_id, name: r.category_name, totalQuestions: 0, answered: 0, percentage: 0, questions: [] };
      byCat.set(r.category_id, cat);
    }
    const answered = r.answer_score !== null;
    cat.questions.push({
      id: r.question_id,
      questionCode: r.question_code,
      questionText: r.question_text,
      answerScore: r.answer_score,
      answerComment: r.answer_comment,
      answerEvidenceUrls: r.answer_evidence_urls ?? [],
      answered,
    });
    cat.totalQuestions += 1;
    if (answered) cat.answered += 1;
  }
  const categories = [...byCat.values()].map((c) => ({ ...c, percentage: pct(c.answered, c.totalQuestions) }));
  const totalQuestions = categories.reduce((s, c) => s + c.totalQuestions, 0);
  const answered = categories.reduce((s, c) => s + c.answered, 0);
  const status = submission?.status === "submitted" ? "submitted" : answered === 0 ? "not_started" : "in_progress";

  return {
    field: { id: field.id, name: field.name },
    submission: {
      status,
      submittedAt: submission?.submitted_at ?? null,
      totalQuestions,
      answered,
      percentage: pct(answered, totalQuestions),
    },
    categories,
  };
}

export interface SubmitResult {
  field: { id: string; name: string };
  assessment: FieldAssessment;
}

export async function submitAssessorAssessment(
  fieldId: string,
  assessorId: string
): Promise<SubmitResult> {
  const field = await assertAssessorField(fieldId, assessorId);
  const existing = await findFieldAssessment(fieldId, ROLE);
  if (existing?.status === "submitted") {
    throw ApiError.conflict("Your assessment has already been submitted.");
  }
  const rows = await getReviewRowsForField(fieldId, ROLE);
  const answeredCount = rows.filter((r) => r.answer_score !== null).length;
  if (answeredCount === 0) {
    throw ApiError.badRequest("Answer at least one question before submitting.");
  }
  const programId = await resolveProgramForField(fieldId);
  const assessment = await submitFieldAssessment(fieldId, ROLE, assessorId, programId);
  if (!assessment) {
    throw ApiError.conflict("Your assessment has already been submitted.");
  }
  return { field: { id: field.id, name: field.name }, assessment };
}

export async function getFarmerAssessmentForAssessor(
  fieldId: string,
  assessorId: string
) {
  const field = await assertAssessorField(fieldId, assessorId);
  const rows = await getReviewRowsForField(fieldId, "farmer");
  const submission = await findFieldAssessment(fieldId, "farmer");

  const byCat = new Map<string, {
    id: string; name: string; questions: Array<{ id: string; questionCode: string | null; questionText: string; answerScore: number | null; answerComment: string | null; answerEvidenceUrls: string[]; answered: boolean }>;
  }>();
  for (const r of rows) {
    let cat = byCat.get(r.category_id);
    if (!cat) {
      cat = { id: r.category_id, name: r.category_name, questions: [] };
      byCat.set(r.category_id, cat);
    }
    cat.questions.push({
      id: r.question_id,
      questionCode: r.question_code,
      questionText: r.question_text,
      answerScore: r.answer_score,
      answerComment: r.answer_comment,
      answerEvidenceUrls: r.answer_evidence_urls ?? [],
      answered: r.answer_score !== null,
    });
  }
  return {
    field: { id: field.id, name: field.name },
    farmerSubmitted: submission?.status === "submitted",
    submittedAt: submission?.submitted_at ?? null,
    categories: [...byCat.values()],
  };
}

export async function getComparison(fieldId: string, assessorId: string) {
  const field = await assertAssessorField(fieldId, assessorId);
  const rows = await getComparisonRowsForField(fieldId);
  const farmerSub = await findFieldAssessment(fieldId, "farmer");
  const assessorSub = await findFieldAssessment(fieldId, "assessor");

  const byCat = new Map<string, {
    id: string; name: string;
    questions: Array<{
      id: string; questionCode: string | null; questionText: string;
      farmerScore: number | null; assessorScore: number | null;
      difference: number | null;
    }>;
  }>();
  for (const r of rows) {
    let cat = byCat.get(r.category_id);
    if (!cat) {
      cat = { id: r.category_id, name: r.category_name, questions: [] };
      byCat.set(r.category_id, cat);
    }
    const diff =
      r.farmer_score !== null && r.assessor_score !== null
        ? r.assessor_score - r.farmer_score
        : null;
    cat.questions.push({
      id: r.question_id,
      questionCode: r.question_code,
      questionText: r.question_text,
      farmerScore: r.farmer_score,
      assessorScore: r.assessor_score,
      difference: diff,
    });
  }

  return {
    field: { id: field.id, name: field.name },
    farmer: {
      submitted: farmerSub?.status === "submitted",
      percentage: farmerSub ? Number(farmerSub.percentage) : null,
    },
    assessor: {
      submitted: assessorSub?.status === "submitted",
      percentage: assessorSub ? Number(assessorSub.percentage) : null,
    },
    categories: [...byCat.values()],
  };
}
