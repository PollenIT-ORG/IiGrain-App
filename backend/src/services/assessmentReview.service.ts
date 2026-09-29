import ApiError from "../utils/ApiError.js";
import { isAdminLevel } from "../config/rbac.js";
import { broadcastToAdmins } from "./realtime.service.js";
import { emitSync } from "../socket/liveSync.js";
import { notifyUser } from "./notification.service.js";
import { questionTypePayload, rowAnswerPayload } from "./assessmentAnswer.js";
import {
  getReviewRowsForField,
  findFieldWithFarmer,
  listAssessmentEvidence,
} from "../models/assessmentMobile.model.js";
import {
  approveAssessment,
  findSubmittedAssessment,
  getCategoryScoreLimits,
  saveReviewScores,
  type ReviewListRow,
} from "../models/assessmentReview.model.js";

export interface ReviewActor {
  id: string;
  role: string;
}

// An admin reviews every program; a program administrator only the ones they run.
function ownerScope(actor: ReviewActor): string | null {
  return isAdminLevel(actor.role) ? null : actor.id;
}

export interface ReviewCard {
  id: string;
  field: { id: string; name: string; farmName: string };
  program: { id: string; name: string };
  author: { id: string | null; name: string | null; role: "farmer" | "assessor" };
  totalQuestions: number;
  answered: number;
  unscored: number;
  totalScore: number;
  maxScore: number;
  // Everything this assessment can score, for a score given as a whole.
  possibleScore: number;
  percentage: number;
  reviewStatus: "in_review" | "approved";
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewerName: string | null;
}

function toCard(r: ReviewListRow): ReviewCard {
  return {
    id: r.id,
    field: { id: r.field_id, name: r.field_name, farmName: r.farm_name },
    program: { id: r.program_id, name: r.program_name },
    author: { id: r.author_id, name: r.author_name, role: r.author_role },
    totalQuestions: r.total_questions,
    answered: r.answered,
    unscored: r.unscored,
    totalScore: r.total_score,
    maxScore: r.max_score,
    possibleScore: r.possible_score,
    percentage: Math.round(Number(r.percentage) * 10) / 10,
    reviewStatus: r.review_status,
    submittedAt: r.submitted_at,
    reviewedAt: r.reviewed_at,
    reviewerName: r.reviewer_name,
  };
}

async function loadReview(id: string, actor: ReviewActor): Promise<ReviewListRow> {
  const row = await findSubmittedAssessment(id, ownerScope(actor));
  if (!row) throw ApiError.notFound("Submitted assessment not found.");
  return row;
}

export async function getReviewDetail(id: string, actor: ReviewActor) {
  const row = await loadReview(id, actor);
  const answers = await getReviewRowsForField(row.field_id, row.program_id, row.author_role);

  const evidence = await listAssessmentEvidence(row.field_id, row.program_id, row.author_role);

  // What each category can score, so a reviewer can score it as one.
  const limits = new Map(
    (await getCategoryScoreLimits(row.program_id)).map((c) => [c.id, c.max_score])
  );

  // Each category in order, with its questions in order and its rows as they came.
  const byCategory = new Map<
    string,
    { id: string; name: string; questionIds: string[]; rows: typeof answers }
  >();
  for (const a of answers) {
    let category = byCategory.get(a.category_id);
    if (!category) {
      category = { id: a.category_id, name: a.category_name, questionIds: [], rows: [] };
      byCategory.set(a.category_id, category);
    }
    if (!category.questionIds.includes(a.question_id)) category.questionIds.push(a.question_id);
    category.rows.push(a);
  }

  // A form filled in several times reads as its records; a multiple choice
  // category reads as one set of answers, with no record.
  const categories = [...byCategory.values()].map((category) => {
    const recordIds: string[] = [];
    for (const r of category.rows) {
      if (r.record_id && !recordIds.includes(r.record_id)) recordIds.push(r.record_id);
    }
    const answerFor = (questionId: string, recordId: string | null) => {
      const found = category.rows.find(
        (r) => r.question_id === questionId && (r.record_id ?? null) === recordId && r.answered
      );
      if (found) return toReviewQuestion(found);
      // A field this record left empty still shows, unanswered.
      const any = category.rows.find((r) => r.question_id === questionId);
      return toReviewQuestion({ ...any!, ...UNANSWERED });
    };
    const sets: Array<string | null> = recordIds.length ? recordIds : [null];
    const records = sets.map((recordId, index) => ({
      id: recordId,
      number: recordId ? index + 1 : null,
      // The evidence uploaded at the end of the form.
      evidenceUrls: recordId
        ? evidence.byRecord.get(recordId) ?? []
        : evidence.byCategory.get(category.id) ?? [],
      questions: category.questionIds.map((questionId) => answerFor(questionId, recordId)),
    }));
    return {
      id: category.id,
      name: category.name,
      possibleScore: limits.get(category.id) ?? 0,
      records,
      // Every answer of the category, one after another, for screens that list them flat.
      questions: records.flatMap((r) => r.questions),
    };
  });

  return {
    review: toCard(row),
    categories,
  };
}

// The answer columns of a field nobody filled in.
const UNANSWERED = {
  answered: false,
  answer_score: null,
  review_score: null,
  answer_option_id: null,
  answer_option_text: null,
  answer_text: null,
  answer_number: null,
  answer_date: null,
  answer_boolean: null,
  answer_comment: null,
  answer_evidence_urls: null,
  answer_id: null,
  record_id: null,
  record_sort: null,
};

function toReviewQuestion(a: Awaited<ReturnType<typeof getReviewRowsForField>>[number]) {
  return {
    recordId: a.record_id,
    id: a.question_id,
    questionCode: a.question_code,
    questionText: a.question_text,
    guidanceNote: a.guidance_note,
    ...questionTypePayload(a),
    ...rowAnswerPayload(a),
  };
}

function assertOpen(row: ReviewListRow): void {
  if (row.review_status === "approved") {
    throw ApiError.conflict("This assessment has already been approved.");
  }
}

export interface ReviewScoresInput {
  scores?: { questionId: string; recordId?: string | null; score: number }[];
  // One score per category, used in place of scoring every answer.
  categoryScores?: { categoryId: string; score: number }[];
  // One score for the whole assessment, used in place of scoring every answer.
  overallScore?: number;
  note?: string | null;
}

export async function saveReview(
  id: string,
  actor: ReviewActor,
  input: ReviewScoresInput
): Promise<ReviewCard> {
  const row = await loadReview(id, actor);
  assertOpen(row);
  await assertScoresFit(row, input.scores ?? []);
  await saveReviewScores(id, row, actor.id, input.scores ?? []);
  const fresh = await findSubmittedAssessment(id, ownerScope(actor));
  if (!fresh) throw ApiError.notFound("Submitted assessment not found.");
  return toCard(fresh);
}

export async function approveReview(
  id: string,
  actor: ReviewActor,
  input: ReviewScoresInput
): Promise<ReviewCard> {
  const row = await loadReview(id, actor);
  assertOpen(row);
  await assertScoresFit(row, input.scores ?? []);
  await saveReviewScores(id, row, actor.id, input.scores ?? []);

  const approved = await approveAssessment(
    id,
    actor.id,
    input.note?.trim() || null,
    input.overallScore,
    input.categoryScores
  );
  if (!approved.ok) {
    if (approved.reason === "category") {
      throw ApiError.badRequest(
        approved.max > 0
          ? `"${approved.category}" can score at most ${approved.max}.`
          : "One of those categories is not part of this assessment."
      );
    }
    if (approved.reason === "range") {
      throw ApiError.badRequest(
        `The score for the whole assessment must be between 0 and ${approved.max}.`
      );
    }
    throw approved.reason === "unscored"
      ? ApiError.badRequest(
          "Give every answer a score, or score it by category or as a whole, before approving it."
        )
      : ApiError.conflict("This assessment was just changed by someone else. Refresh and try again.");
  }

  const fresh = await findSubmittedAssessment(id, ownerScope(actor));
  if (!fresh) throw ApiError.notFound("Submitted assessment not found.");

  await notifyFarmer(fresh);
  broadcastToAdmins("submissions", { fieldId: fresh.field_id });
  if (fresh.author_id) {
    emitSync(fresh.author_id, {
      resource: "assessment",
      action: "reviewed",
      programId: fresh.program_id,
      fieldId: fresh.field_id,
    });
  }
  return toCard(fresh);
}

/** A score cannot beat the highest score its question allows. */
async function assertScoresFit(
  row: ReviewListRow,
  scores: { questionId: string; score: number }[]
): Promise<void> {
  if (!scores.length) return;
  const answers = await getReviewRowsForField(row.field_id, row.program_id, row.author_role);
  const limits = new Map(answers.map((a) => [a.question_id, a]));
  for (const s of scores) {
    const question = limits.get(s.questionId);
    if (!question) {
      throw ApiError.badRequest("One of the questions is not part of this assessment.");
    }
    if (!question.answered) {
      throw ApiError.badRequest("A question that was not answered cannot be scored.");
    }
    if (s.score > question.max_score) {
      throw ApiError.badRequest(
        `A score cannot be more than ${question.max_score} for "${question.question_text}".`
      );
    }
  }
}

async function notifyFarmer(row: ReviewListRow): Promise<void> {
  const field = await findFieldWithFarmer(row.field_id);
  if (!field) return;
  await notifyUser({
    userId: field.farmer_id,
    type: "assessment_reviewed",
    title: "Assessment reviewed",
    body: `Your assessment for "${field.name}" has been reviewed. Score: ${Math.round(
      Number(row.percentage)
    )}%.`,
    data: { screen: "assessment_history", fieldId: row.field_id, programId: row.program_id },
  });
}
