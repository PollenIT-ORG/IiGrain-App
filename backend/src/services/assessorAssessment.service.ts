import ApiError from "../utils/ApiError.js";
import {
  answerPayload,
  questionTypePayload,
  resolveAnswer,
  rowAnswerPayload,
  type AnswerPayload,
  type QuestionTypePayload,
} from "./assessmentAnswer.js";
import type { SaveAnswerBody } from "../validators/assessment.schema.js";
import { assertAssessmentWritable } from "./assessmentMobile.service.js";
import { emitSync } from "../socket/liveSync.js";
import {
  listAssessorFields,
  assessorCanAccessField,
  findFieldWithFarmer,
  getCategoryProgressForField,
  getProgramQuestionKind,
  getCategoryQuestionsForField,
  listCategoryQuestionsForField,
  findCategoryQuestionForField,
  findActiveCategory,
  findActiveQuestion,
  upsertResponse,
  storedAnswerExtras,
  deleteFormRecord,
  getCategoryEvidence,
  isFieldSubmitted,
  findFieldAssessment,
  submitFieldAssessment,
  getReviewRowsForField,
  getComparisonRowsForField,
  type AssessorFieldRow,
  type SavedResponse,
  type FieldAssessment,
  type RecordTarget,
} from "../models/assessmentMobile.model.js";
import { readFormRecords, saveForm, withFirstRecord, type FormAnswer } from "./assessmentForm.js";

function pct(answered: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((answered / total) * 1000) / 10;
}

const ROLE = "assessor" as const;

export interface AssessorFieldCard {
  field: { id: string; name: string; crop: string | null };
  farm: { id: string; name: string };
  farmer: { id: string; name: string | null };
  program: { id: string; name: string };
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
      field: { id: r.id, name: r.name, crop: r.crop },
      farm: { id: r.farm_id, name: r.farm_name },
      farmer: { id: r.farmer_id, name: r.farmer_name },
      program: { id: r.program_id, name: r.program_name },
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
  programId: string,
  assessorId: string
): Promise<{ id: string; name: string; farmer_id: string; farmer_name: string | null }> {
  const ok = await assessorCanAccessField(assessorId, fieldId, programId);
  if (!ok) throw ApiError.notFound("Field not found.");
  const field = await findFieldWithFarmer(fieldId);
  if (!field) throw ApiError.notFound("Field not found.");
  return field;
}

export async function getAssessorSummary(
  fieldId: string,
  programId: string,
  assessorId: string,
  year: number
) {
  const field = await assertAssessorField(fieldId, programId, assessorId);
  const rows = await getCategoryProgressForField(fieldId, programId, ROLE);
  const questionKind = await getProgramQuestionKind(programId);

  const categories = rows.map((r) => ({
    id: r.id,
    name: r.name,
    totalQuestions: r.total_questions,
    answered: r.answered,
    percentage: pct(r.answered, r.total_questions),
    records: r.records,
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
      questionKind,
    },
    categories,
  };
}

export async function getAssessorCategoryQuestionList(
  fieldId: string,
  programId: string,
  categoryId: string,
  assessorId: string
) {
  const field = await assertAssessorField(fieldId, programId, assessorId);
  const category = await findActiveCategory(categoryId, programId);
  if (!category) throw ApiError.notFound("Category not found.");
  const rows = await listCategoryQuestionsForField(categoryId, fieldId, programId, ROLE);
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
    questionKind: await getProgramQuestionKind(programId),
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
  programId: string,
  categoryId: string,
  assessorId: string
) {
  const field = await assertAssessorField(fieldId, programId, assessorId);
  const category = await findActiveCategory(categoryId, programId);
  if (!category) throw ApiError.notFound("Category not found.");
  const questionKind = await getProgramQuestionKind(programId);
  const form =
    questionKind === "input"
      ? await readFormRecords({ fieldId, programId, categoryId, authorRole: ROLE })
      : null;
  const rows = (await getCategoryQuestionsForField(categoryId, fieldId, programId, ROLE)).map((q) =>
    form ? withFirstRecord(q, form.firstByQuestion.get(q.id)) : q
  );
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
    ...questionTypePayload(q),
    ...answerPayload(q),
  }));
  const answered = questions.filter((q) => q.answered).length;
  return {
    field: { id: field.id, name: field.name },
    category: { id: category.id, name: category.name },
    questionKind,
    progress: {
      totalQuestions: questions.length,
      answered,
      percentage: pct(answered, questions.length),
    },
    questions,
    // Every filling of this form, each with its own answers; empty for multiple choice.
    records: form?.records ?? [],
    // The evidence at the end of the form: the first record's, or the category's for multiple choice.
    evidenceUrls: form
      ? form.records[0]?.evidenceUrls ?? []
      : await getCategoryEvidence(categoryId, fieldId, programId, ROLE),
  };
}

export async function getAssessorQuestionDetail(
  fieldId: string,
  programId: string,
  categoryId: string,
  questionId: string,
  assessorId: string
) {
  const field = await assertAssessorField(fieldId, programId, assessorId);
  const category = await findActiveCategory(categoryId, programId);
  if (!category) throw ApiError.notFound("Category not found.");
  const q = await findCategoryQuestionForField(categoryId, questionId, fieldId, programId, ROLE);
  if (!q) throw ApiError.notFound("Question not found.");
  const locked = await isFieldSubmitted(fieldId, programId, ROLE);
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
      ...questionTypePayload(q),
      ...answerPayload(q),
    },
    locked,
  };
}

// The answer fields the app may send; which of them a question needs depends on its type.
export type SaveAnswerInput = SaveAnswerBody;

/** Saves a whole category at once, the way an input based form is filled in. */
// The checks every assessor form save shares.
async function assertAssessorFormWritable(
  fieldId: string,
  programId: string,
  categoryId: string,
  assessorId: string
): Promise<void> {
  await assertAssessorField(fieldId, programId, assessorId);
  await assertAssessmentWritable(fieldId, programId);
  if (await isFieldSubmitted(fieldId, programId, ROLE)) {
    throw ApiError.forbidden("Your assessment has been submitted and can no longer be edited.");
  }
  const category = await findActiveCategory(categoryId, programId);
  if (!category) throw ApiError.notFound("Category not found.");
}

async function saveAssessorForm(
  fieldId: string,
  programId: string,
  categoryId: string,
  assessorId: string,
  answers: FormAnswer[],
  target: RecordTarget,
  evidenceUrls?: string[] | null
) {
  await assertAssessorFormWritable(fieldId, programId, categoryId, assessorId);
  const questions = await getCategoryQuestionsForField(categoryId, fieldId, programId, ROLE);
  await saveForm(
    { fieldId, programId, categoryId, authorRole: ROLE, authorId: assessorId },
    questions,
    answers,
    target,
    evidenceUrls
  );
  emitSync(assessorId, { resource: "assessment", action: "answer_saved", programId, fieldId });
  return getAssessorCategoryQuestions(fieldId, programId, categoryId, assessorId);
}

/** The whole form in one save; an input based form saves into its first record. */
export async function saveAssessorCategoryAnswers(
  fieldId: string,
  programId: string,
  categoryId: string,
  assessorId: string,
  input: { answers: FormAnswer[]; evidenceUrls?: string[] | null }
) {
  return saveAssessorForm(fieldId, programId, categoryId, assessorId, input.answers, { kind: "first" }, input.evidenceUrls);
}

/** One more filling of an input based form. */
export async function addAssessorRecord(
  fieldId: string,
  programId: string,
  categoryId: string,
  assessorId: string,
  input: { answers: FormAnswer[]; evidenceUrls?: string[] | null }
) {
  return saveAssessorForm(fieldId, programId, categoryId, assessorId, input.answers, { kind: "new" }, input.evidenceUrls);
}

/** Changes one record of an input based form. */
export async function saveAssessorRecord(
  fieldId: string,
  programId: string,
  categoryId: string,
  recordId: string,
  assessorId: string,
  input: { answers: FormAnswer[]; evidenceUrls?: string[] | null }
) {
  return saveAssessorForm(
    fieldId,
    programId,
    categoryId,
    assessorId,
    input.answers,
    { kind: "id", id: recordId },
    input.evidenceUrls
  );
}

/** Removes one record of an input based form, with its answers. */
export async function removeAssessorRecord(
  fieldId: string,
  programId: string,
  categoryId: string,
  recordId: string,
  assessorId: string
) {
  await assertAssessorFormWritable(fieldId, programId, categoryId, assessorId);
  const removed = await deleteFormRecord(recordId, { fieldId, programId, categoryId, authorRole: ROLE });
  if (!removed) throw ApiError.notFound("That record is no longer there.");
  emitSync(assessorId, { resource: "assessment", action: "answer_saved", programId, fieldId });
  return getAssessorCategoryQuestions(fieldId, programId, categoryId, assessorId);
}

export async function saveAssessorAnswer(
  fieldId: string,
  programId: string,
  questionId: string,
  assessorId: string,
  input: SaveAnswerInput
): Promise<SavedResponse> {
  await assertAssessorField(fieldId, programId, assessorId);
  await assertAssessmentWritable(fieldId, programId);
  if (await isFieldSubmitted(fieldId, programId, ROLE)) {
    throw ApiError.forbidden(
      "Your assessment has been submitted and can no longer be edited."
    );
  }
  const question = await findActiveQuestion(questionId, programId);
  if (!question) throw ApiError.notFound("Question not found.");

  // Fields the caller did not send stay untouched (a score-only save must not
  // wipe previously attached files or notes). null explicitly clears.
  const evidenceUrls =
    input.evidenceUrls === null ? [] : input.evidenceUrls;
  if (evidenceUrls !== undefined && evidenceUrls.length > 5) {
    throw ApiError.badRequest("You can attach at most 5 files.");
  }
  const comment =
    input.comment === undefined
      ? undefined
      : input.comment && input.comment.trim()
        ? input.comment.trim()
        : null;

  // A single answer to an input based form lands in its first record.
  if ((await getProgramQuestionKind(programId)) === "input") {
    const questions = await getCategoryQuestionsForField(question.category_id, fieldId, programId, ROLE);
    const { saved } = await saveForm(
      { fieldId, programId, categoryId: question.category_id, authorRole: ROLE, authorId: assessorId },
      questions,
      [{ ...input, questionId }],
      { kind: "first" }
    );
    emitSync(assessorId, { resource: "assessment", action: "answer_saved", programId, fieldId });
    return saved[0];
  }

  // A file or a note left out of this save is the one already stored, not nothing.
  const stored = await storedAnswerExtras(fieldId, programId, questionId, ROLE);
  const values = resolveAnswer(question, input, {
    evidenceUrls: evidenceUrls ?? stored.evidenceUrls,
    comment: comment === undefined ? stored.comment : comment,
  });

  const saved = await upsertResponse({
    fieldId,
    questionId,
    ...values,
    comment,
    evidenceUrls,
    authorRole: ROLE,
    authorId: assessorId,
    programId,
  });
  if (!saved) throw ApiError.conflict("This assessment was just changed. Refresh and try again.");

  // Live sync to the assessor's other devices.
  emitSync(assessorId, {
    resource: "assessment",
    action: "answer_saved",
    programId,
    fieldId,
    questionId,
  });

  return saved;
}

export async function getAssessorReview(
  fieldId: string,
  programId: string,
  assessorId: string
) {
  const field = await assertAssessorField(fieldId, programId, assessorId);
  const rows = await getReviewRowsForField(fieldId, programId, ROLE);
  const submission = await findFieldAssessment(fieldId, programId, ROLE);

  const byCat = new Map<string, {
    id: string; name: string; totalQuestions: number; answered: number;
    percentage: number;
    questions: Array<
      {
        id: string;
        questionCode: string | null;
        questionText: string;
        guidanceNote: string | null;
        answerOptionText: string | null;
        recordId: string | null;
      } &
        QuestionTypePayload &
        AnswerPayload
    >;
  }>();
  for (const r of rows) {
    let cat = byCat.get(r.category_id);
    if (!cat) {
      cat = { id: r.category_id, name: r.category_name, totalQuestions: 0, answered: 0, percentage: 0, questions: [] };
      byCat.set(r.category_id, cat);
    }
    const answered = r.answered;
    cat.questions.push({
      id: r.question_id,
      questionCode: r.question_code,
      questionText: r.question_text,
      guidanceNote: r.guidance_note,
      ...questionTypePayload(r),
      ...rowAnswerPayload(r),
      // Which filling of the form this answer is from; null for multiple choice.
      recordId: r.record_id,
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
  programId: string,
  assessorId: string
): Promise<SubmitResult> {
  const field = await assertAssessorField(fieldId, programId, assessorId);
  await assertAssessmentWritable(fieldId, programId);
  const existing = await findFieldAssessment(fieldId, programId, ROLE);
  if (existing?.status === "submitted") {
    throw ApiError.conflict("Your assessment has already been submitted.");
  }
  const rows = await getReviewRowsForField(fieldId, programId, ROLE);
  const answeredCount = rows.filter((r) => r.answered).length;
  if (answeredCount === 0) {
    throw ApiError.badRequest("Answer at least one question before submitting.");
  }
  const assessment = await submitFieldAssessment(fieldId, programId, ROLE, assessorId);
  if (!assessment) {
    throw ApiError.conflict("Your assessment has already been submitted.");
  }
  emitSync(assessorId, {
    resource: "assessment",
    action: "submitted",
    programId,
    fieldId,
  });
  // Also sync the field's farmer so their app reflects that the assessor finished.
  const owner = await findFieldWithFarmer(fieldId);
  if (owner) {
    emitSync(owner.farmer_id, {
      resource: "assessment",
      action: "submitted",
      programId,
      fieldId,
    });
  }
  return { field: { id: field.id, name: field.name }, assessment };
}

export async function getFarmerAssessmentForAssessor(
  fieldId: string,
  programId: string,
  assessorId: string
) {
  const field = await assertAssessorField(fieldId, programId, assessorId);
  const rows = await getReviewRowsForField(fieldId, programId, "farmer");
  const submission = await findFieldAssessment(fieldId, programId, "farmer");

  const byCat = new Map<string, {
    id: string;
    name: string;
    questions: Array<
      {
        id: string;
        questionCode: string | null;
        questionText: string;
        answerOptionText: string | null;
        recordId: string | null;
      } &
        QuestionTypePayload &
        AnswerPayload
    >;
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
      ...questionTypePayload(r),
      ...rowAnswerPayload(r),
      // Which filling of the form this answer is from; null for multiple choice.
      recordId: r.record_id,
    });
  }
  return {
    field: { id: field.id, name: field.name },
    farmerSubmitted: submission?.status === "submitted",
    submittedAt: submission?.submitted_at ?? null,
    categories: [...byCat.values()],
  };
}

export async function getComparison(
  fieldId: string,
  programId: string,
  assessorId: string
) {
  const field = await assertAssessorField(fieldId, programId, assessorId);
  const rows = await getComparisonRowsForField(fieldId, programId);
  const farmerSub = await findFieldAssessment(fieldId, programId, "farmer");
  const assessorSub = await findFieldAssessment(fieldId, programId, "assessor");

  const byCat = new Map<string, {
    id: string; name: string;
    questions: Array<{
      id: string; questionCode: string | null; questionText: string;
      maxScore: number;
      // What each side answered, every record's answer joined in record order.
      farmerAnswer: string | null; assessorAnswer: string | null;
      farmerRecords: number; assessorRecords: number;
      farmerAnswered: boolean; assessorAnswered: boolean;
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
      maxScore: r.max_score,
      farmerAnswer: r.farmer_answered ? r.farmer_written ?? "-" : null,
      assessorAnswer: r.assessor_answered ? r.assessor_written ?? "-" : null,
      farmerRecords: r.farmer_records,
      assessorRecords: r.assessor_records,
      farmerAnswered: r.farmer_answered,
      assessorAnswered: r.assessor_answered,
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
