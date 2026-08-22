import ApiError from "../utils/ApiError.js";
import {
  findOwnedField,
  listMyFieldsWithAssessment,
  listMyCompletedAssessments,
  getFieldCategoryScores,
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
  discardFieldAssessment,
  getAssessmentWriteContext,
  getReviewRowsForField,
  getHistoryRowsForField,
  type QuestionWithAnswer,
  type SavedResponse,
  type FieldAssessment,
  type ReviewRow,
} from "../models/assessmentMobile.model.js";
import prisma from "../db/prisma.js";
import { notifyUser, notifyUsers } from "./notification.service.js";
import { broadcastToAdmins } from "./realtime.service.js";
import { emitSync } from "../socket/liveSync.js";
import {
  assessmentSubmittedEmail,
  assessmentSubmittedNoticeEmail,
} from "./emailTemplates.js";

function pct(answered: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((answered / total) * 1000) / 10;
}

/**
 * Gate for anything that WRITES assessment work on a (field, program).
 * Reads (history, review, comparison) are intentionally left open.
 *
 * - A closed or ended program is a hard cutoff for editing and submitting.
 *   `allowClosedProgram` lets discard through so a farmer can still delete a
 *   draft that got stranded when the program closed or ended.
 * - An inactive farm or field cannot be assessed or submitted.
 *   `allowInactiveEntity` is used by discard, which is a cleanup action and must
 *   stay possible so a draft on a deactivated farm is not stuck forever.
 */
export async function assertAssessmentWritable(
  fieldId: string,
  programId: string,
  opts: { allowInactiveEntity?: boolean; allowClosedProgram?: boolean } = {}
): Promise<void> {
  const ctx = await getAssessmentWriteContext(fieldId, programId);
  if (!ctx) throw ApiError.notFound("Field not found.");

  if (!opts.allowClosedProgram) {
    if (!ctx.program_active) {
      throw ApiError.conflict(
        "This program is closed, so its assessments can no longer be changed."
      );
    }
    if (ctx.program_ended) {
      throw ApiError.conflict(
        "This program has ended, so its assessments can no longer be changed."
      );
    }
  }
  if (!opts.allowInactiveEntity) {
    if (!ctx.farm_active) {
      throw ApiError.conflict(
        "This farm is inactive, so its assessments cannot be edited or submitted."
      );
    }
    if (!ctx.field_active) {
      throw ApiError.conflict(
        "This field is inactive, so its assessments cannot be edited or submitted."
      );
    }
  }
}

export interface MyFieldAssessmentCard {
  field: { id: string; name: string; crop: string | null };
  farm: { id: string; name: string };
  program: { id: string | null; name: string | null };
  assessment: {
    status: "not_started" | "in_progress" | "completed";
    inProgress: boolean;
    completed: boolean;
    totalQuestions: number;
    answered: number;
    percentage: number;
    submittedAt: string | null;
  };
}

export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export interface MyFieldsAssessmentList {
  year: number;
  title: string;
  counts: { total: number; notStarted: number; inProgress: number; completed: number };
  fields: MyFieldAssessmentCard[];
}

export interface MyFieldsAssessmentInput {
  userId: string;
  year: number;
  page: number;
  limit: number;
  search?: string;
}

export async function getMyFieldsAssessmentList(
  input: MyFieldsAssessmentInput
): Promise<{ result: MyFieldsAssessmentList; meta: PageMeta }> {
  const offset = (input.page - 1) * input.limit;
  const { rows, total, notStarted, inProgress } = await listMyFieldsWithAssessment({
    userId: input.userId,
    search: input.search,
    limit: input.limit,
    offset,
  });

  const fields: MyFieldAssessmentCard[] = rows.map((r) => {
    const status: MyFieldAssessmentCard["assessment"]["status"] = r.submitted
      ? "completed"
      : r.answered > 0
        ? "in_progress"
        : "not_started";

    const percentage =
      status === "completed" && r.percentage !== null
        ? Math.round(Number(r.percentage) * 10) / 10
        : pct(r.answered, r.total_questions);

    return {
      field: { id: r.id, name: r.name, crop: r.crop },
      farm: { id: r.farm_id, name: r.farm_name },
      program: { id: r.program_id, name: r.program_name },
      assessment: {
        status,
        inProgress: status === "in_progress",
        completed: status === "completed",
        totalQuestions: r.total_questions,
        answered: r.answered,
        percentage,
        submittedAt: r.submitted_at ? r.submitted_at.toISOString() : null,
      },
    };
  });

  // counts reflect the whole (search-filtered) set, not just this page.
  // The pending list never contains submitted assessments, so completed = 0.
  return {
    result: {
      year: input.year,
      title: `${input.year} Annual Assessment`,
      counts: { total, notStarted, inProgress, completed: 0 },
      fields,
    },
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export interface CompletedAssessmentCard {
  field: { id: string; name: string; crop: string | null };
  farm: { id: string; name: string };
  program: { id: string | null; name: string | null };
  assessment: {
    totalQuestions: number;
    answered: number;
    percentage: number;
    submittedAt: string | null;
  };
}

export interface MyCompletedAssessmentsList {
  count: number;
  assessments: CompletedAssessmentCard[];
}

export interface MyCompletedAssessmentsInput {
  userId: string;
  farmId: string | null;
  page: number;
  limit: number;
  search?: string;
}

export async function getMyCompletedAssessments(
  input: MyCompletedAssessmentsInput
): Promise<{ result: MyCompletedAssessmentsList; meta: PageMeta }> {
  const offset = (input.page - 1) * input.limit;
  const { rows, total } = await listMyCompletedAssessments({
    userId: input.userId,
    farmId: input.farmId,
    search: input.search,
    limit: input.limit,
    offset,
  });
  const assessments: CompletedAssessmentCard[] = rows.map((r) => ({
    field: { id: r.id, name: r.name, crop: r.crop },
    farm: { id: r.farm_id, name: r.farm_name },
    program: { id: r.program_id, name: r.program_name },
    assessment: {
      totalQuestions: r.total_questions,
      answered: r.answered,
      percentage: r.percentage !== null ? Math.round(Number(r.percentage) * 10) / 10 : 0,
      submittedAt: r.submitted_at ? r.submitted_at.toISOString() : null,
    },
  }));
  return {
    result: { count: total, assessments },
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export interface CategorySummary {
  id: string;
  name: string;
  totalQuestions: number;
  answered: number;
  percentage: number;
}

export interface FieldAssessmentSummary {
  field: { id: string; name: string; farmId: string; farmName: string };
  assessment: {
    title: string;
    year: number;
    status: "not_started" | "in_progress" | "completed";
    totalQuestions: number;
    answered: number;
    percentage: number;
  };
  // Whether this assessment can still be changed, and why not. When the program
  // has ended the field stays readable but every answer is locked; the client
  // shows a "program ended" banner and offers only a delete/discard action.
  canEdit: boolean;
  program: {
    active: boolean;
    ended: boolean;
    endDate: string | null;
  };
  categories: CategorySummary[];
}

export async function getFieldAssessmentSummary(
  fieldId: string,
  programId: string,
  userId: string,
  year: number
): Promise<FieldAssessmentSummary> {
  const field = await findOwnedField(fieldId, userId, programId);
  if (!field) throw ApiError.notFound("Field not found.");

  const rows = await getCategoryProgressForField(fieldId, programId);

  const categories: CategorySummary[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    totalQuestions: r.total_questions,
    answered: r.answered,
    percentage: pct(r.answered, r.total_questions),
  }));

  const totalQuestions = categories.reduce((s, c) => s + c.totalQuestions, 0);
  const answered = categories.reduce((s, c) => s + c.answered, 0);

  const status: "not_started" | "in_progress" | "completed" =
    answered === 0
      ? "not_started"
      : answered >= totalQuestions && totalQuestions > 0
        ? "completed"
        : "in_progress";

  // Program / entity state, so the client knows to lock the answers and show the
  // "program ended" banner while keeping the assessment readable.
  const ctx = await getAssessmentWriteContext(fieldId, programId);
  const programActive = ctx?.program_active ?? true;
  const programEnded = ctx?.program_ended ?? false;
  const canEdit =
    !!ctx &&
    ctx.program_active &&
    !ctx.program_ended &&
    ctx.farm_active &&
    ctx.field_active;

  return {
    field: {
      id: field.id,
      name: field.name,
      farmId: field.farm_id,
      farmName: field.farm_name,
    },
    assessment: {
      title: `${year} Annual Assessment`,
      year,
      status,
      totalQuestions,
      answered,
      percentage: pct(answered, totalQuestions),
    },
    canEdit,
    program: {
      active: programActive,
      ended: programEnded,
      endDate: ctx?.program_end_date ?? null,
    },
    categories,
  };
}

export interface FieldRegenIndex {
  field: { id: string; name: string; farmId: string; farmName: string };
  regenHealthIndex: number | null;
  rating: string | null;
  categories: Array<{
    id: string;
    name: string;
    score: number | null;
    answered: number;
  }>;
  topCategory: string | null;
}

function ratingFor(index: number): string {
  if (index >= 80) return "Excellent";
  if (index >= 60) return "Good";
  if (index >= 40) return "Fair";
  if (index >= 20) return "Needs work";
  return "Poor";
}

export async function getFieldRegenIndex(
  fieldId: string,
  programId: string,
  userId: string
): Promise<FieldRegenIndex> {
  const field = await findOwnedField(fieldId, userId, programId);
  if (!field) throw ApiError.notFound("Field not found.");

  const rows = await getFieldCategoryScores(fieldId, programId, "farmer");

  const categories = rows.map((r) => ({
    id: r.id,
    name: r.name,
    score: r.percentage === null ? null : Math.round(Number(r.percentage)),
    answered: r.answered,
  }));

  const totalScore = rows.reduce((s, r) => s + r.total_score, 0);
  const maxScore = rows.reduce((s, r) => s + r.max_score, 0);
  const regenHealthIndex =
    maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : null;

  const scored = rows.filter((r) => r.percentage !== null);
  const topCategory =
    scored.length > 0
      ? scored.reduce((best, r) =>
          Number(r.percentage) > Number(best.percentage) ? r : best
        ).name
      : null;

  return {
    field: {
      id: field.id,
      name: field.name,
      farmId: field.farm_id,
      farmName: field.farm_name,
    },
    regenHealthIndex,
    rating: regenHealthIndex === null ? null : ratingFor(regenHealthIndex),
    categories,
    topCategory,
  };
}

export interface CategoryQuestionsResult {
  field: { id: string; name: string };
  category: { id: string; name: string };
  progress: { totalQuestions: number; answered: number; percentage: number };
  questions: Array<{
    id: string;
    questionCode: string | null;
    questionText: string;
    guidanceNote: string | null;
    scoreDescriptions: {
      score0: string | null;
      score1: string | null;
      score2: string | null;
      score3: string | null;
    };
    answerScore: number | null;
    answerComment: string | null;
    answerEvidenceUrls: string[];
    answered: boolean;
  }>;
}

export async function getFieldCategoryQuestions(
  fieldId: string,
  programId: string,
  categoryId: string,
  userId: string
): Promise<CategoryQuestionsResult> {
  const field = await findOwnedField(fieldId, userId, programId);
  if (!field) throw ApiError.notFound("Field not found.");

  const category = await findActiveCategory(categoryId);
  if (!category) throw ApiError.notFound("Category not found.");

  const rows = await getCategoryQuestionsForField(categoryId, fieldId, programId);

  const questions = rows.map((q: QuestionWithAnswer) => ({
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

  const totalQuestions = questions.length;
  const answered = questions.filter((q) => q.answered).length;

  return {
    field: { id: field.id, name: field.name },
    category: { id: category.id, name: category.name },
    progress: { totalQuestions, answered, percentage: pct(answered, totalQuestions) },
    questions,
  };
}

export interface CategoryQuestionListResult {
  field: { id: string; name: string };
  category: { id: string; name: string };
  progress: { totalQuestions: number; answered: number; percentage: number };
  questions: Array<{
    id: string;
    questionCode: string | null;
    questionText: string;
    guidanceNote: string | null;
    answered: boolean;
  }>;
}

export async function getFieldCategoryQuestionList(
  fieldId: string,
  programId: string,
  categoryId: string,
  userId: string
): Promise<CategoryQuestionListResult> {
  const field = await findOwnedField(fieldId, userId, programId);
  if (!field) throw ApiError.notFound("Field not found.");

  const category = await findActiveCategory(categoryId);
  if (!category) throw ApiError.notFound("Category not found.");

  const rows = await listCategoryQuestionsForField(categoryId, fieldId, programId);

  const questions = rows.map((q) => ({
    id: q.id,
    questionCode: q.question_code,
    questionText: q.question_text,
    guidanceNote: q.guidance_note,
    answered: q.answered,
  }));

  const totalQuestions = questions.length;
  const answered = questions.filter((q) => q.answered).length;

  return {
    field: { id: field.id, name: field.name },
    category: { id: category.id, name: category.name },
    progress: { totalQuestions, answered, percentage: pct(answered, totalQuestions) },
    questions,
  };
}

export interface QuestionDetail {
  field: { id: string; name: string };
  category: { id: string; name: string };
  question: {
    id: string;
    questionCode: string | null;
    questionText: string;
    guidanceNote: string | null;
    scoreDescriptions: {
      score0: string | null;
      score1: string | null;
      score2: string | null;
      score3: string | null;
    };
    answerScore: number | null;
    answerComment: string | null;
    answerEvidenceUrls: string[];
    answered: boolean;
  };
  locked: boolean;
}

export async function getFieldQuestionDetail(
  fieldId: string,
  programId: string,
  categoryId: string,
  questionId: string,
  userId: string
): Promise<QuestionDetail> {
  const field = await findOwnedField(fieldId, userId, programId);
  if (!field) throw ApiError.notFound("Field not found.");

  const category = await findActiveCategory(categoryId);
  if (!category) throw ApiError.notFound("Category not found.");

  const q = await findCategoryQuestionForField(categoryId, questionId, fieldId, programId);
  if (!q) throw ApiError.notFound("Question not found.");

  const locked = await isFieldSubmitted(fieldId, programId);

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
  // null clears the stored value; undefined leaves it untouched.
  comment?: string | null;
  evidenceUrls?: string[] | null;
}

// Returns `undefined` for a field the caller did not send, so the stored value is
// left untouched. Sending "" or [] explicitly still clears it.
async function assertCanAnswer(
  fieldId: string,
  programId: string,
  questionId: string,
  userId: string,
  input: SaveAnswerInput
): Promise<{ comment?: string | null; evidenceUrls?: string[] }> {
  const field = await findOwnedField(fieldId, userId, programId);
  if (!field) throw ApiError.notFound("Field not found.");

  await assertAssessmentWritable(fieldId, programId);

  if (await isFieldSubmitted(fieldId, programId)) {
    throw ApiError.forbidden(
      "This assessment has been submitted and can no longer be edited."
    );
  }

  const question = await findActiveQuestion(questionId);
  if (!question) throw ApiError.notFound("Question not found.");

  // null means "clear the photos", so normalise it to an empty array; undefined
  // stays undefined so the stored photos are left untouched.
  const evidenceUrls =
    input.evidenceUrls === null ? [] : input.evidenceUrls;
  if (evidenceUrls !== undefined && evidenceUrls.length > 5) {
    throw ApiError.badRequest("You can attach at most 5 photos.");
  }

  // undefined -> leave; null or "" -> clear; text -> trimmed text.
  const comment =
    input.comment === undefined
      ? undefined
      : input.comment && input.comment.trim()
        ? input.comment.trim()
        : null;

  return { comment, evidenceUrls };
}

export async function saveFieldAnswer(
  fieldId: string,
  programId: string,
  questionId: string,
  userId: string,
  input: SaveAnswerInput
): Promise<SavedResponse> {
  const { comment, evidenceUrls } = await assertCanAnswer(
    fieldId,
    programId,
    questionId,
    userId,
    input
  );

  const saved = await upsertResponse({
    fieldId,
    questionId,
    score: input.score,
    comment,
    evidenceUrls,
    authorRole: "farmer",
    authorId: userId,
    programId,
  });

  // Live sync: tell this farmer's other devices an answer changed so a second
  // phone on the same assessment updates without a manual refresh.
  emitSync(userId, {
    resource: "assessment",
    action: "answer_saved",
    programId,
    fieldId,
    questionId,
  });

  return saved;
}

export interface FieldReview {
  field: { id: string; name: string };
  submission: {
    status: "not_started" | "in_progress" | "submitted";
    submittedAt: Date | null;
    totalQuestions: number;
    answered: number;
    percentage: number;
  };
  categories: Array<{
    id: string;
    name: string;
    totalQuestions: number;
    answered: number;
    percentage: number;
    questions: Array<{
      id: string;
      questionCode: string | null;
      questionText: string;
      answerScore: number | null;
      answerComment: string | null;
      answerEvidenceUrls: string[];
      answered: boolean;
    }>;
  }>;
}

export async function getFieldReview(
  fieldId: string,
  programId: string,
  userId: string
): Promise<FieldReview> {
  const field = await findOwnedField(fieldId, userId, programId);
  if (!field) throw ApiError.notFound("Field not found.");

  const rows = await getReviewRowsForField(fieldId, programId);
  const submission = await findFieldAssessment(fieldId, programId);

  const byCat = new Map<string, FieldReview["categories"][number]>();
  for (const r of rows) {
    let cat = byCat.get(r.category_id);
    if (!cat) {
      cat = {
        id: r.category_id,
        name: r.category_name,
        totalQuestions: 0,
        answered: 0,
        percentage: 0,
        questions: [],
      };
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

  const categories = [...byCat.values()].map((c) => ({
    ...c,
    percentage: pct(c.answered, c.totalQuestions),
  }));

  const totalQuestions = categories.reduce((s, c) => s + c.totalQuestions, 0);
  const answered = categories.reduce((s, c) => s + c.answered, 0);

  const status: FieldReview["submission"]["status"] =
    submission?.status === "submitted"
      ? "submitted"
      : answered === 0
        ? "not_started"
        : "in_progress";

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

export interface HistoryQuestion {
  id: string;
  questionCode: string | null;
  questionText: string;
  guidanceNote: string | null;
  scoreDescriptions: {
    score0: string | null;
    score1: string | null;
    score2: string | null;
    score3: string | null;
  };
  answerScore: number | null;
  answerScoreDescription: string | null;
  answerComment: string | null;
  answerEvidenceUrls: string[];
  answered: boolean;
}

export interface HistoryCategory {
  id: string;
  name: string;
  totalQuestions: number;
  answered: number;
  questions: HistoryQuestion[];
}

export interface FieldAssessmentHistory {
  field: { id: string; name: string };
  locked: true;
  status: "completed";
  submittedAt: string | null;
  score: {
    totalQuestions: number;
    answered: number;
    totalScore: number;
    maxScore: number;
    percentage: number;
  };
  categories: HistoryCategory[];
}

function scoreDescriptionFor(
  row: {
    score0_description: string | null;
    score1_description: string | null;
    score2_description: string | null;
    score3_description: string | null;
  },
  score: number | null
): string | null {
  switch (score) {
    case 0:
      return row.score0_description;
    case 1:
      return row.score1_description;
    case 2:
      return row.score2_description;
    case 3:
      return row.score3_description;
    default:
      return null;
  }
}

export async function getFieldAssessmentHistory(
  fieldId: string,
  programId: string,
  userId: string
): Promise<FieldAssessmentHistory> {
  const field = await findOwnedField(fieldId, userId, programId);
  if (!field) throw ApiError.notFound("Field not found.");

  const submission = await findFieldAssessment(fieldId, programId);
  if (!submission || submission.status !== "submitted") {
    throw ApiError.conflict(
      "This assessment has not been submitted yet - no history to show."
    );
  }

  const rows = await getHistoryRowsForField(fieldId, programId);

  const byCat = new Map<string, HistoryCategory>();
  for (const r of rows) {
    let cat = byCat.get(r.category_id);
    if (!cat) {
      cat = {
        id: r.category_id,
        name: r.category_name,
        totalQuestions: 0,
        answered: 0,
        questions: [],
      };
      byCat.set(r.category_id, cat);
    }
    const answered = r.answer_score !== null;
    cat.questions.push({
      id: r.question_id,
      questionCode: r.question_code,
      questionText: r.question_text,
      guidanceNote: r.guidance_note,
      scoreDescriptions: {
        score0: r.score0_description,
        score1: r.score1_description,
        score2: r.score2_description,
        score3: r.score3_description,
      },
      answerScore: r.answer_score,
      answerScoreDescription: scoreDescriptionFor(r, r.answer_score),
      answerComment: r.answer_comment,
      answerEvidenceUrls: r.answer_evidence_urls ?? [],
      answered,
    });
    cat.totalQuestions += 1;
    if (answered) cat.answered += 1;
  }

  return {
    field: { id: field.id, name: field.name },
    locked: true,
    status: "completed",
    submittedAt: submission.submitted_at
      ? submission.submitted_at.toISOString()
      : null,
    score: {
      totalQuestions: submission.total_questions,
      answered: submission.answered,
      totalScore: submission.total_score,
      maxScore: submission.max_score,
      percentage: Math.round(Number(submission.percentage) * 10) / 10,
    },
    categories: [...byCat.values()],
  };
}

export interface SubmitResult {
  field: { id: string; name: string };
  assessment: FieldAssessment;
}

export interface DiscardResult {
  field: { id: string; name: string };
  discardedAnswers: number;
}

export async function discardFieldAssessmentForUser(
  fieldId: string,
  programId: string,
  userId: string
): Promise<DiscardResult> {
  const field = await findOwnedField(fieldId, userId, programId);
  if (!field) throw ApiError.notFound("Field not found.");

  // Discard is a cleanup action, so it stays available even on an inactive
  // farm/field or a closed/ended program - the farmer can always delete a draft
  // that would otherwise be stuck (for example one left unfinished when the
  // program ended). A submitted assessment is still final and cannot be removed.
  await assertAssessmentWritable(fieldId, programId, {
    allowInactiveEntity: true,
    allowClosedProgram: true,
  });

  const existing = await findFieldAssessment(fieldId, programId, "farmer");
  if (existing?.status === "submitted") {
    throw ApiError.conflict(
      "This assessment has already been submitted and cannot be discarded."
    );
  }

  const discardedAnswers = await discardFieldAssessment(fieldId, programId, "farmer");
  emitSync(userId, {
    resource: "assessment",
    action: "discarded",
    programId,
    fieldId,
  });
  return { field: { id: field.id, name: field.name }, discardedAnswers };
}

export async function submitFieldAssessmentForUser(
  fieldId: string,
  programId: string,
  userId: string
): Promise<SubmitResult> {
  const field = await findOwnedField(fieldId, userId, programId);
  if (!field) throw ApiError.notFound("Field not found.");

  await assertAssessmentWritable(fieldId, programId);

  const existing = await findFieldAssessment(fieldId, programId, "farmer");
  if (existing?.status === "submitted") {
    throw ApiError.conflict("This assessment has already been submitted.");
  }

  const rows = await getReviewRowsForField(fieldId, programId, "farmer");
  const answeredCount = rows.filter((r) => r.answer_score !== null).length;
  if (answeredCount === 0) {
    throw ApiError.badRequest(
      "Answer at least one question before submitting."
    );
  }

  const assessment = await submitFieldAssessment(fieldId, programId, "farmer", userId);
  if (!assessment) {
    throw ApiError.conflict("This assessment has already been submitted.");
  }

  const score = Math.round(Number(assessment.percentage) * 10) / 10;
  void notifyAssessmentSubmitted(userId, programId, field.id, field.name, {
    answered: assessment.answered,
    totalQuestions: assessment.total_questions,
    percentage: score,
  });
  broadcastToAdmins("submissions", { fieldId: field.id });
  emitSync(userId, {
    resource: "assessment",
    action: "submitted",
    programId,
    fieldId,
  });

  return { field: { id: field.id, name: field.name }, assessment };
}

async function notifyAssessmentSubmitted(
  farmerId: string,
  programId: string,
  fieldId: string,
  fieldName: string,
  stats: { answered: number; totalQuestions: number; percentage: number }
): Promise<void> {
  const farmer = await prisma.users.findFirst({
    where: { id: farmerId },
    select: { full_name: true, email: true },
  });
  const who = farmer?.full_name ?? "A farmer";

  // Receipt to the farmer who submitted -> their submitted-assessment history.
  void notifyUser({
    userId: farmerId,
    type: "assessment_submitted",
    title: "Assessment submitted",
    body: `Your assessment for "${fieldName}" was submitted (${stats.percentage}%).`,
    data: { fieldId, programId, screen: "assessment_history" },
    emailFor: (r) =>
      assessmentSubmittedEmail({
        fullName: r.fullName,
        fieldName,
        answered: stats.answered,
        totalQuestions: stats.totalQuestions,
        percentage: stats.percentage,
      }),
  });

  // Notice to the assigned assessor -> their assessment for that field.
  const assignment = await prisma.assessor_assignments.findFirst({
    where: { farmer_id: farmerId, deleted_at: null },
    orderBy: { created_at: "desc" },
    select: { assessor_id: true },
  });
  if (assignment) {
    void notifyUser({
      userId: assignment.assessor_id,
      type: "assessment_submitted",
      title: "Assessment submitted",
      body: `${who} submitted an assessment for "${fieldName}".`,
      data: { fieldId, programId, screen: "assessor_field_assessment" },
      emailFor: (r) =>
        assessmentSubmittedNoticeEmail({
          fullName: r.fullName,
          farmerName: who,
          fieldName,
          percentage: stats.percentage,
        }),
    });
  }

  // In-app notice to admins (no email - avoids flooding admin inboxes).
  const admins = await prisma.users.findMany({
    where: { deleted_at: null, roles: { name: { in: ["admin", "super_admin"] } } },
    select: { id: true },
  });
  if (admins.length > 0) {
    await notifyUsers(
      admins.map((a) => a.id),
      {
        type: "assessment_submitted",
        title: "Assessment submitted",
        body: `${who} submitted an assessment for "${fieldName}".`,
        data: { fieldId, programId, screen: "assessment_comparison" },
      }
    );
  }
}

export type { ReviewRow };
