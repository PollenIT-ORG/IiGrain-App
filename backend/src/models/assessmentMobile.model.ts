import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import type { AnswerableQuestion } from "../services/assessmentAnswer.js";
import type { AnswerExtra, QuestionType } from "../validators/assessment.schema.js";

export interface OwnedField {
  id: string;
  name: string;
  farm_id: string;
  farm_name: string;
}

export async function findOwnedField(
  fieldId: string,
  userId: string,
  programId: string
): Promise<OwnedField | null> {
  const today = new Date();
  const f = await prisma.fields.findFirst({
    where: {
      id: fieldId,
      deleted_at: null,
      farms: { deleted_at: null, owner_id: userId },
      program_enrollment_fields: {
        some: {
          deleted_at: null,
          program_enrollments: {
            deleted_at: null,
            farmer_id: userId,
            program_id: programId,
            programs: {
              deleted_at: null,
              OR: [{ start_date: null }, { start_date: { lte: today } }],
            },
          },
        },
      },
    },
    select: { id: true, name: true, farm_id: true, farms: { select: { name: true } } },
  });
  if (!f) return null;
  return { id: f.id, name: f.name, farm_id: f.farm_id, farm_name: f.farms.name };
}

export interface MyFieldAssessmentRow {
  id: string;
  name: string;
  farm_id: string;
  farm_name: string;
  crop: string | null;
  program_id: string | null;
  program_name: string | null;
  total_questions: number;
  answered: number;
  submitted: boolean;
  submitted_at: Date | null;
  percentage: string | null;
}

export interface MyFieldsAssessmentFilters {
  userId: string;
  search?: string;
  limit: number;
  offset: number;
}

export interface MyFieldsAssessmentResult {
  rows: MyFieldAssessmentRow[];
  total: number;
  notStarted: number;
  inProgress: number;
}

// The program's own assessment template, which decides which questions it asks.
const programTemplate = (programId: string) =>
  Prisma.sql`(SELECT assessment_template_id FROM programs WHERE id = ${programId}::uuid)`;

// Prisma filter for categories that belong to the program's assessment template.
function inProgramTemplate(programId: string) {
  return {
    template: { linked_programs: { some: { id: programId } } },
  } satisfies Prisma.assessment_categoriesWhereInput;
}

export async function listMyFieldsWithAssessment(
  filters: MyFieldsAssessmentFilters
): Promise<MyFieldsAssessmentResult> {
  const userId = filters.userId;
  const search = filters.search?.trim();
  const searchSql = search
    ? Prisma.sql`AND (f.name ILIKE ${"%" + search + "%"} OR f.crop ILIKE ${"%" + search + "%"})`
    : Prisma.empty;

  // Shared: one row per (field, program) the farmer is enrolled in, for STARTED
  // programs, that is NOT yet submitted, with the current answered count.
  const enrolledCte = Prisma.sql`
    enrolled AS (
      SELECT pef.field_id, pe.program_id, p.name AS program_name,
             p.assessment_template_id,
             -- When this field joined the program: the field's own row, or the enrollment it came with.
             MAX(GREATEST(pef.created_at, pe.enrolled_at)) AS joined_at
        FROM program_enrollment_fields pef
        JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
        JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
       WHERE pef.deleted_at IS NULL
         AND pe.farmer_id = ${userId}::uuid
         AND (p.start_date IS NULL OR p.start_date <= org_today())
       GROUP BY pef.field_id, pe.program_id, p.name, p.assessment_template_id
    )`;
  const answeredLateral = Prisma.sql`
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT ar.question_id)::int AS answered,
             MAX(ar.updated_at) AS last_answer_at
        FROM assessment_responses ar
        JOIN assessment_questions q  ON q.id = ar.question_id
        JOIN assessment_categories c ON c.id = q.category_id
       WHERE ar.field_id = f.id
         AND ar.program_id = en.program_id
         AND ar.deleted_at IS NULL
         AND ar.author_role = 'farmer'
         AND q.deleted_at IS NULL AND q.is_active = true
         AND c.deleted_at IS NULL AND c.is_active = true
         AND c.template_id = en.assessment_template_id
    ) ans ON true
    LEFT JOIN field_assessments fa
           ON fa.field_id = f.id AND fa.program_id = en.program_id
          AND fa.author_role = 'farmer'`;

  const rows = await prisma.$queryRaw<MyFieldAssessmentRow[]>(Prisma.sql`
    WITH ${enrolledCte}
    SELECT f.id,
           f.name,
           f.farm_id,
           fm.name AS farm_name,
           f.crop,
           en.program_id,
           en.program_name,
           aq.total_questions,
           COALESCE(ans.answered, 0)::int AS answered,
           (fa.status = 'submitted')      AS submitted,
           fa.submitted_at,
           fa.percentage
      FROM enrolled en
      JOIN fields f ON f.id = en.field_id AND f.deleted_at IS NULL
      JOIN farms fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS total_questions
          FROM assessment_questions q
          JOIN assessment_categories c ON c.id = q.category_id
         WHERE q.deleted_at IS NULL AND q.is_active = true
           AND c.deleted_at IS NULL AND c.is_active = true
           AND c.template_id = en.assessment_template_id
      ) aq ON true
      ${answeredLateral}
     -- Only PENDING work here: not_started + in_progress. Completed (submitted)
     -- assessments are excluded - they live in the history endpoint instead.
     WHERE (fa.status IS NULL OR fa.status <> 'submitted')
       ${searchSql}
     -- Most recently worked on first: the last answer saved, or joining when there is none.
     ORDER BY GREATEST(en.joined_at, COALESCE(ans.last_answer_at, en.joined_at)) DESC,
              f.created_at DESC, f.id
     LIMIT ${filters.limit} OFFSET ${filters.offset};`);

  // Whole-set status breakdown (search-filtered, not paginated) for tab counts.
  const agg = await prisma.$queryRaw<
    { total: number; in_progress: number; not_started: number }[]
  >(Prisma.sql`
    WITH ${enrolledCte}
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE COALESCE(ans.answered, 0) > 0)::int AS in_progress,
           COUNT(*) FILTER (WHERE COALESCE(ans.answered, 0) = 0)::int AS not_started
      FROM enrolled en
      JOIN fields f ON f.id = en.field_id AND f.deleted_at IS NULL
      JOIN farms fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL
      ${answeredLateral}
     WHERE (fa.status IS NULL OR fa.status <> 'submitted')
       ${searchSql};`);

  return {
    rows,
    total: agg[0]?.total ?? 0,
    notStarted: agg[0]?.not_started ?? 0,
    inProgress: agg[0]?.in_progress ?? 0,
  };
}

export interface CompletedAssessmentRow {
  id: string;
  name: string;
  farm_id: string;
  farm_name: string;
  crop: string | null;
  program_id: string | null;
  program_name: string | null;
  total_questions: number;
  answered: number;
  total_score: number;
  max_score: number;
  percentage: string | null;
  review_status: string;
  submitted_at: Date | null;
}

export interface CompletedAssessmentsFilters {
  userId: string;
  farmId: string | null;
  search?: string;
  limit: number;
  offset: number;
}

export async function listMyCompletedAssessments(
  filters: CompletedAssessmentsFilters
): Promise<{ rows: CompletedAssessmentRow[]; total: number }> {
  const { userId, farmId } = filters;
  const search = filters.search?.trim();
  const searchSql = search
    ? Prisma.sql`AND (f.name ILIKE ${"%" + search + "%"} OR f.crop ILIKE ${"%" + search + "%"})`
    : Prisma.empty;

  const enrolledCte = Prisma.sql`
    enrolled AS (
      SELECT DISTINCT pef.field_id, pe.program_id, p.name AS program_name
        FROM program_enrollment_fields pef
        JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
        JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
       WHERE pef.deleted_at IS NULL
         AND pe.farmer_id = ${userId}::uuid
         AND (p.start_date IS NULL OR p.start_date <= org_today())
    )`;
  const fromWhere = Prisma.sql`
      FROM enrolled en
      JOIN fields f ON f.id = en.field_id AND f.deleted_at IS NULL
      JOIN farms fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL
      JOIN field_assessments fa
             ON fa.field_id = f.id
            AND fa.program_id = en.program_id
            AND fa.author_role = 'farmer'
            AND fa.status = 'submitted'
     WHERE (${farmId}::uuid IS NULL OR f.farm_id = ${farmId}::uuid)
       ${searchSql}`;

  const rows = await prisma.$queryRaw<CompletedAssessmentRow[]>(Prisma.sql`
    WITH ${enrolledCte}
    SELECT f.id,
           f.name,
           f.farm_id,
           fm.name AS farm_name,
           f.crop,
           en.program_id,
           en.program_name,
           fa.total_questions,
           fa.answered,
           fa.total_score,
           fa.max_score,
           fa.percentage,
           fa.review_status,
           fa.submitted_at
    ${fromWhere}
     ORDER BY fa.submitted_at DESC NULLS LAST
     LIMIT ${filters.limit} OFFSET ${filters.offset};`);

  const countRows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    WITH ${enrolledCte}
    SELECT COUNT(*)::bigint AS count
    ${fromWhere};`);

  return { rows, total: Number(countRows[0]?.count ?? 0) };
}

export interface AssessorFieldRow {
  id: string;
  name: string;
  farm_id: string;
  farm_name: string;
  farmer_id: string;
  farmer_name: string | null;
  crop: string | null;
  program_id: string;
  program_name: string;
  total_questions: number;
  assessor_answered: number;
  assessor_submitted: boolean;
  assessor_submitted_at: Date | null;
  assessor_percentage: string | null;
  farmer_submitted: boolean;
}

export async function listAssessorFields(
  assessorId: string
): Promise<AssessorFieldRow[]> {
  return prisma.$queryRaw<AssessorFieldRow[]>(Prisma.sql`
    SELECT DISTINCT
           f.id,
           f.name,
           f.farm_id,
           fm.name AS farm_name,
           u.id    AS farmer_id,
           u.full_name AS farmer_name,
           f.crop,
           f.created_at,
           pe.program_id,
           p.name  AS program_name,
           aq.total_questions,
           COALESCE(ans.answered, 0)::int AS assessor_answered,
           (afa.status = 'submitted')     AS assessor_submitted,
           afa.submitted_at               AS assessor_submitted_at,
           afa.percentage                 AS assessor_percentage,
           (ffa.status = 'submitted')     AS farmer_submitted
      FROM program_enrollments pe
      JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
      JOIN program_enrollment_fields pef
             ON pef.enrollment_id = pe.id AND pef.deleted_at IS NULL
      JOIN fields f ON f.id = pef.field_id AND f.deleted_at IS NULL
      JOIN farms  fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL
      JOIN users  u  ON u.id = pe.farmer_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS total_questions
          FROM assessment_questions q
          JOIN assessment_categories c ON c.id = q.category_id
         WHERE q.deleted_at IS NULL AND q.is_active = true
           AND c.deleted_at IS NULL AND c.is_active = true
           AND c.template_id = p.assessment_template_id
      ) aq ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT ar.question_id)::int AS answered
          FROM assessment_responses ar
          JOIN assessment_questions q  ON q.id = ar.question_id
          JOIN assessment_categories c ON c.id = q.category_id
         WHERE ar.field_id = f.id
           AND ar.program_id = pe.program_id
           AND ar.deleted_at IS NULL
           AND ar.author_role = 'assessor'
           AND q.deleted_at IS NULL AND q.is_active = true
           AND c.deleted_at IS NULL AND c.is_active = true
           AND c.template_id = p.assessment_template_id
      ) ans ON true
      LEFT JOIN field_assessments afa
             ON afa.field_id = f.id AND afa.program_id = pe.program_id
            AND afa.author_role = 'assessor'
      LEFT JOIN field_assessments ffa
             ON ffa.field_id = f.id AND ffa.program_id = pe.program_id
            AND ffa.author_role = 'farmer'
     WHERE pe.assessor_id = ${assessorId}::uuid
       AND pe.deleted_at IS NULL
       -- Only STARTED programs - future-start programs aren't assessable yet.
       AND (p.start_date IS NULL OR p.start_date <= org_today())
       -- Hide closed or ended programs. A closed or ended program is a hard
       -- cutoff for the assessor (the same rule the write guards enforce), so
       -- it must not linger in the pending list where a tap would only fail.
       AND p.is_active = true
       AND (p.end_date IS NULL OR p.end_date >= org_today())
     ORDER BY f.created_at DESC;`);
}

export async function assessorCanAccessField(
  assessorId: string,
  fieldId: string,
  programId: string
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: number }[]>(Prisma.sql`
    SELECT 1 AS ok
      FROM program_enrollment_fields pef
      JOIN program_enrollments pe
             ON pe.id = pef.enrollment_id
            AND pe.assessor_id = ${assessorId}::uuid
            AND pe.program_id = ${programId}::uuid
            AND pe.deleted_at IS NULL
      JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
     WHERE pef.field_id = ${fieldId}::uuid
       AND pef.deleted_at IS NULL
       -- Only STARTED programs - future-start programs aren't assessable yet.
       AND (p.start_date IS NULL OR p.start_date <= org_today())
     LIMIT 1;`);
  return rows.length > 0;
}

export interface AssessmentWriteContext {
  field_active: boolean;
  farm_active: boolean;
  program_active: boolean;
  program_ended: boolean;
  program_end_date: string | null;
  assessment_open: boolean;
}

// Current state of the (field, program) pair, used to decide whether assessment
// work may still be written. Reads are deliberately not gated by this.
export async function getAssessmentWriteContext(
  fieldId: string,
  programId: string
): Promise<AssessmentWriteContext | null> {
  const rows = await prisma.$queryRaw<AssessmentWriteContext[]>(Prisma.sql`
    SELECT f.is_active  AS field_active,
           fm.is_active AS farm_active,
           p.is_active  AS program_active,
           (p.end_date IS NOT NULL AND p.end_date < org_today()) AS program_ended,
           (p.end_date)::text AS program_end_date,
           -- The assessment opens when the program's survey is locked; a program without one is open.
           NOT EXISTS (SELECT 1 FROM program_admin_surveys s
                        WHERE s.program_id = p.id AND s.deleted_at IS NULL
                          AND s.locked_at IS NULL) AS assessment_open
      FROM fields f
      JOIN farms fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL
      JOIN programs p ON p.id = ${programId}::uuid AND p.deleted_at IS NULL
     WHERE f.id = ${fieldId}::uuid AND f.deleted_at IS NULL
     LIMIT 1;`);
  return rows[0] ?? null;
}

export async function resolveProgramForField(
  fieldId: string
): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ program_id: string }[]>(Prisma.sql`
    SELECT pe.program_id
      FROM program_enrollment_fields pef
      JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
     WHERE pef.field_id = ${fieldId}::uuid
       AND pef.deleted_at IS NULL
     ORDER BY pe.enrolled_at DESC
     LIMIT 1;`);
  return rows[0]?.program_id ?? null;
}

// The program a field is being assessed under BY THIS ASSESSOR. A field can be
// enrolled in more than one program, so resolving the program without the
// assessor (above) can pick one they are not assigned to and wrongly reject a
// visit. This only returns a program where the assessor is actually the assigned
// assessor for the field, so a genuinely-unassigned assessor still gets null.
export async function resolveAssessorProgramForField(
  assessorId: string,
  fieldId: string
): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ program_id: string }[]>(Prisma.sql`
    SELECT pe.program_id
      FROM program_enrollment_fields pef
      JOIN program_enrollments pe
             ON pe.id = pef.enrollment_id
            AND pe.assessor_id = ${assessorId}::uuid
            AND pe.deleted_at IS NULL
      JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
     WHERE pef.field_id = ${fieldId}::uuid
       AND pef.deleted_at IS NULL
       -- Same visibility as the assessor's field list: started, active and not
       -- ended - so a field the assessor can see is a field they can visit.
       AND p.is_active = true
       AND (p.start_date IS NULL OR p.start_date <= org_today())
       AND (p.end_date IS NULL OR p.end_date >= org_today())
     ORDER BY pe.enrolled_at DESC
     LIMIT 1;`);
  return rows[0]?.program_id ?? null;
}

export async function findFieldWithFarmer(
  fieldId: string
): Promise<{ id: string; name: string; farmer_id: string; farmer_name: string | null } | null> {
  const f = await prisma.fields.findFirst({
    where: { id: fieldId, deleted_at: null },
    select: {
      id: true,
      name: true,
      farms: { select: { owner_id: true, users: { select: { full_name: true } } } },
    },
  });
  if (!f) return null;
  return {
    id: f.id,
    name: f.name,
    farmer_id: f.farms.owner_id,
    farmer_name: f.farms.users.full_name,
  };
}

export interface CategoryProgress {
  id: string;
  name: string;
  sort_order: number;
  total_questions: number;
  answered: number;
  // How many times the form has been filled in; 0 for a multiple choice category.
  records: number;
}

export async function getCategoryProgressForField(
  fieldId: string,
  programId: string,
  authorRole: AuthorRole = "farmer"
): Promise<CategoryProgress[]> {
  const rows = await prisma.$queryRaw<
    CategoryProgress[]
  >(Prisma.sql`
    SELECT ac.id,
           ac.name,
           ac.sort_order,
           COUNT(DISTINCT aq.id)::int AS total_questions,
           COUNT(DISTINCT ar.question_id)::int AS answered,
           COUNT(DISTINCT ar.record_id)::int AS records
      FROM assessment_categories ac
      JOIN assessment_questions aq
             ON aq.category_id = ac.id
            AND aq.deleted_at IS NULL
            AND aq.is_active = true
      LEFT JOIN assessment_responses ar
             ON ar.question_id = aq.id
            AND ar.field_id = ${fieldId}::uuid
            AND ar.deleted_at IS NULL
            AND ar.author_role = ${authorRole}
            AND ar.program_id = ${programId}::uuid
     WHERE ac.deleted_at IS NULL
       AND ac.is_active = true
       AND ac.template_id = ${programTemplate(programId)}
     GROUP BY ac.id
     HAVING COUNT(aq.id) > 0
     ORDER BY ac.sort_order ASC, ac.created_at ASC;`);
  return rows;
}

/**
 * Which of the two kinds of assessment a program runs: multiple choice, answered
 * question by question, or input based, where a category is one form. A template
 * made before the two kinds existed says nothing, so it is read from its
 * questions: only scored and multiple choice questions means multiple choice.
 */
export async function getProgramQuestionKind(programId: string): Promise<"mcq" | "input"> {
  const rows = await prisma.$queryRaw<{ question_kind: string | null; only_scored: boolean | null }[]>(
    Prisma.sql`
    SELECT at.question_kind,
           bool_and(aq.question_type IN ('scored', 'mcq')) AS only_scored
      FROM assessment_templates at
      LEFT JOIN assessment_categories ac
             ON ac.template_id = at.id
            AND ac.deleted_at IS NULL
            AND ac.is_active = true
      LEFT JOIN assessment_questions aq
             ON aq.category_id = ac.id
            AND aq.deleted_at IS NULL
            AND aq.is_active = true
     WHERE at.id = ${programTemplate(programId)}
     GROUP BY at.question_kind;`
  );
  const row = rows[0];
  if (row?.question_kind === "input" || row?.question_kind === "mcq") return row.question_kind;
  return row?.only_scored === false ? "input" : "mcq";
}

export interface QuestionWithAnswer {
  id: string;
  question_code: string | null;
  question_text: string;
  question_type: QuestionType;
  max_score: number;
  evidence_mode: AnswerExtra;
  comment_mode: AnswerExtra;
  options: { id: string; option_text: string; score: number }[];
  guidance_note: string | null;
  score0_description: string | null;
  score1_description: string | null;
  score2_description: string | null;
  score3_description: string | null;
  sort_order: number;
  answered: boolean;
  answer_score: number | null;
  answer_option_id: string | null;
  answer_text: string | null;
  answer_number: number | null;
  answer_date: string | null;
  answer_boolean: boolean | null;
  answer_comment: string | null;
  answer_evidence_urls: string[] | null;
}

export type AuthorRole = "farmer" | "assessor";

function questionWithAnswerSelect(
  fieldId: string,
  programId: string,
  authorRole: AuthorRole = "farmer"
) {
  return {
    id: true,
    question_code: true,
    question_text: true,
    question_type: true,
    max_score: true,
    evidence_mode: true,
    comment_mode: true,
    guidance_note: true,
    score0_description: true,
    score1_description: true,
    score2_description: true,
    score3_description: true,
    sort_order: true,
    options: {
      where: { deleted_at: null, is_active: true },
      orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
      select: { id: true, option_text: true, score: true },
    },
    assessment_responses: {
      where: {
        field_id: fieldId,
        program_id: programId,
        deleted_at: null,
        author_role: authorRole,
      },
      select: {
        score: true,
        option_id: true,
        answer_text: true,
        answer_number: true,
        answer_date: true,
        answer_boolean: true,
        comment: true,
        evidence_urls: true,
      },
      orderBy: { created_at: "asc" },
      take: 1,
    },
  } satisfies Prisma.assessment_questionsSelect;
}

type QWARow = {
  id: string;
  question_code: string | null;
  question_text: string;
  question_type: string;
  max_score: number;
  evidence_mode: string;
  comment_mode: string;
  options: { id: string; option_text: string; score: number }[];
  guidance_note: string | null;
  score0_description: string | null;
  score1_description: string | null;
  score2_description: string | null;
  score3_description: string | null;
  sort_order: number;
  assessment_responses: {
    score: number | null;
    option_id: string | null;
    answer_text: string | null;
    answer_number: Prisma.Decimal | null;
    answer_date: Date | null;
    answer_boolean: boolean | null;
    comment: string | null;
    evidence_urls: string[];
  }[];
};

/** A date column read back as the plain day it holds, without a timezone shifting it. */
function toDayString(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toQuestionWithAnswer(q: QWARow): QuestionWithAnswer {
  const ans = q.assessment_responses[0];
  return {
    id: q.id,
    question_code: q.question_code,
    question_text: q.question_text,
    question_type: q.question_type as QuestionType,
    max_score: q.max_score,
    evidence_mode: q.evidence_mode as AnswerExtra,
    comment_mode: q.comment_mode as AnswerExtra,
    options: q.options,
    guidance_note: q.guidance_note,
    score0_description: q.score0_description,
    score1_description: q.score1_description,
    score2_description: q.score2_description,
    score3_description: q.score3_description,
    sort_order: q.sort_order,
    answered: Boolean(ans),
    answer_score: ans ? ans.score : null,
    answer_option_id: ans ? ans.option_id : null,
    answer_text: ans ? ans.answer_text : null,
    answer_number: ans?.answer_number != null ? Number(ans.answer_number) : null,
    answer_date: ans ? toDayString(ans.answer_date) : null,
    answer_boolean: ans ? ans.answer_boolean : null,
    answer_comment: ans ? ans.comment : null,
    answer_evidence_urls: ans ? ans.evidence_urls : null,
  };
}

export async function getCategoryQuestionsForField(
  categoryId: string,
  fieldId: string,
  programId: string,
  authorRole: AuthorRole = "farmer"
): Promise<QuestionWithAnswer[]> {
  const rows = await prisma.assessment_questions.findMany({
    where: {
      category_id: categoryId,
      deleted_at: null,
      is_active: true,
      assessment_categories: inProgramTemplate(programId),
    },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: questionWithAnswerSelect(fieldId, programId, authorRole),
  });
  return (rows as QWARow[]).map(toQuestionWithAnswer);
}

export async function findCategoryQuestionForField(
  categoryId: string,
  questionId: string,
  fieldId: string,
  programId: string,
  authorRole: AuthorRole = "farmer"
): Promise<QuestionWithAnswer | null> {
  const q = await prisma.assessment_questions.findFirst({
    where: {
      id: questionId,
      category_id: categoryId,
      deleted_at: null,
      is_active: true,
      assessment_categories: inProgramTemplate(programId),
    },
    select: questionWithAnswerSelect(fieldId, programId, authorRole),
  });
  return q ? toQuestionWithAnswer(q as QWARow) : null;
}

export interface QuestionListRow {
  id: string;
  question_code: string | null;
  question_text: string;
  guidance_note: string | null;
  sort_order: number;
  answered: boolean;
}

export async function listCategoryQuestionsForField(
  categoryId: string,
  fieldId: string,
  programId: string,
  authorRole: AuthorRole = "farmer"
): Promise<QuestionListRow[]> {
  const rows = await prisma.assessment_questions.findMany({
    where: {
      category_id: categoryId,
      deleted_at: null,
      is_active: true,
      assessment_categories: inProgramTemplate(programId),
    },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: {
      id: true,
      question_code: true,
      question_text: true,
      guidance_note: true,
      sort_order: true,
      assessment_responses: {
        where: {
          field_id: fieldId,
          program_id: programId,
          deleted_at: null,
          author_role: authorRole,
        },
        select: { id: true },
        take: 1,
      },
    },
  });
  return rows.map((q) => ({
    id: q.id,
    question_code: q.question_code,
    question_text: q.question_text,
    guidance_note: q.guidance_note,
    sort_order: q.sort_order,
    answered: q.assessment_responses.length > 0,
  }));
}

export async function findActiveCategory(
  categoryId: string,
  programId: string
): Promise<{ id: string; name: string } | null> {
  return prisma.assessment_categories.findFirst({
    where: { id: categoryId, deleted_at: null, is_active: true, ...inProgramTemplate(programId) },
    select: { id: true, name: true },
  });
}

// Answerable only while the question and its category are live and belong to the program's template.
export async function findActiveQuestion(
  questionId: string,
  programId: string
): Promise<AnswerableQuestion | null> {
  const q = await prisma.assessment_questions.findFirst({
    where: {
      id: questionId,
      deleted_at: null,
      is_active: true,
      assessment_categories: { deleted_at: null, is_active: true, ...inProgramTemplate(programId) },
    },
    select: {
      id: true,
      category_id: true,
      question_type: true,
      max_score: true,
      evidence_mode: true,
      comment_mode: true,
      options: {
        where: { deleted_at: null, is_active: true },
        select: { id: true, score: true },
      },
    },
  });
  return q
    ? {
        ...q,
        question_type: q.question_type as QuestionType,
        evidence_mode: q.evidence_mode as AnswerExtra,
        comment_mode: q.comment_mode as AnswerExtra,
      }
    : null;
}

/** The photo and the description already stored with an answer. */
export async function storedAnswerExtras(
  fieldId: string,
  programId: string,
  questionId: string,
  authorRole: AuthorRole = "farmer",
  // The record the answer sits in; null for a multiple choice answer.
  recordId: string | null = null
): Promise<{ evidenceUrls: string[]; comment: string | null }> {
  const row = await prisma.assessment_responses.findFirst({
    where: {
      field_id: fieldId,
      program_id: programId,
      question_id: questionId,
      author_role: authorRole,
      record_id: recordId,
      deleted_at: null,
    },
    select: { evidence_urls: true, comment: true },
  });
  return { evidenceUrls: row?.evidence_urls ?? [], comment: row?.comment ?? null };
}

export interface SavedResponse {
  id: string;
  field_id: string;
  question_id: string;
  /** Null for an input based answer, which is scored by an admin in review. */
  score: number | null;
  option_id: string | null;
  answer_text: string | null;
  answer_number: number | null;
  answer_date: string | null;
  answer_boolean: boolean | null;
  comment: string | null;
  evidence_urls: string[];
  created_at: Date;
  updated_at: Date;
}

export interface ResponseInput {
  fieldId: string;
  questionId: string;
  score: number | null;
  optionId?: string | null;
  answerText?: string | null;
  answerNumber?: number | null;
  answerDate?: string | null;
  answerBoolean?: boolean | null;
  /** `undefined` leaves an existing comment untouched; `null` clears it. */
  comment?: string | null;
  /** `undefined` leaves existing evidence untouched; `[]` clears it. */
  evidenceUrls?: string[];
  authorRole?: AuthorRole;
  authorId?: string | null;
  /** Required: answers are scoped to the program the field is being assessed for. */
  programId: string;
  /** The record of a form this answer belongs to; null for a multiple choice assessment. */
  recordId?: string | null;
}

// Null when the question left the program's template before the save could run, e.g. a template swap it had to wait for.
export async function upsertResponse(
  p: ResponseInput,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<SavedResponse | null> {
  const role: AuthorRole = p.authorRole ?? "farmer";
  const authorId = p.authorId ?? null;

  // Only overwrite comment / evidence when the caller actually sent them. A
  // partial save (score only) must not wipe photos or notes the user added
  // earlier. Sending an explicit null / [] still clears them.
  const setComment =
    p.comment !== undefined ? Prisma.sql`comment = EXCLUDED.comment,` : Prisma.empty;
  const setEvidence =
    p.evidenceUrls !== undefined
      ? Prisma.sql`evidence_urls = EXCLUDED.evidence_urls,`
      : Prisma.empty;

  const insertComment = p.comment ?? null;
  const insertEvidence = p.evidenceUrls ?? [];
  const recordId = p.recordId ?? null;

  // An answer inside a record is unique per record; a plain answer per field and question.
  const conflict = recordId
    ? Prisma.sql`ON CONFLICT (record_id, question_id) WHERE deleted_at IS NULL AND record_id IS NOT NULL`
    : Prisma.sql`ON CONFLICT (field_id, question_id, author_role, program_id) WHERE deleted_at IS NULL AND record_id IS NULL`;
  // The record has to belong to this field, this side and the form the question sits in.
  const recordCheck = recordId
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM assessment_records r
                              WHERE r.id = ${recordId}::uuid
                                AND r.field_id = ${p.fieldId}::uuid
                                AND r.program_id = pr.id
                                AND r.author_role = ${role}
                                AND r.category_id = c.id
                                AND r.deleted_at IS NULL)`
    : Prisma.empty;

  // The key share lock waits out a template swap on the program, and the join is then checked again against the swapped row.
  const rows = await db.$queryRaw<SavedResponse[]>(Prisma.sql`
    WITH current_question AS (
      SELECT q.id
        FROM programs pr
        JOIN assessment_categories c ON c.template_id = pr.assessment_template_id AND c.deleted_at IS NULL
        JOIN assessment_questions q ON q.category_id = c.id AND q.deleted_at IS NULL
       WHERE pr.id = ${p.programId}::uuid AND q.id = ${p.questionId}::uuid
         ${recordCheck}
         AND NOT EXISTS (SELECT 1 FROM field_assessments fa
                          WHERE fa.field_id = ${p.fieldId}::uuid
                            AND fa.program_id = pr.id
                            AND fa.author_role = ${role}
                            AND fa.status = 'submitted')
         FOR KEY SHARE OF pr
    )
    INSERT INTO assessment_responses
      (field_id, question_id, score, option_id, answer_text, answer_number, answer_date,
       answer_boolean, comment, evidence_urls, author_role, author_id, program_id, record_id)
    SELECT ${p.fieldId}::uuid, cq.id, ${p.score}::smallint, ${p.optionId ?? null}::uuid,
           ${p.answerText ?? null}::text, ${p.answerNumber ?? null}::numeric,
           ${p.answerDate ?? null}::date, ${p.answerBoolean ?? null}::boolean,
           ${insertComment}::text,
           ${insertEvidence}::text[], ${role}::varchar, ${authorId}::uuid, ${p.programId}::uuid,
           ${recordId}::uuid
      FROM current_question cq
    ${conflict}
      DO UPDATE SET score = EXCLUDED.score,
                    option_id = EXCLUDED.option_id,
                    answer_text = EXCLUDED.answer_text,
                    answer_number = EXCLUDED.answer_number,
                    answer_date = EXCLUDED.answer_date,
                    answer_boolean = EXCLUDED.answer_boolean,
                    -- A changed answer has to be looked at again.
                    review_score = NULL,
                    reviewed_by = NULL,
                    reviewed_at = NULL,
                    ${setComment}
                    ${setEvidence}
                    author_id = EXCLUDED.author_id,
                    updated_at = now()
    RETURNING id, field_id, question_id, score, option_id, answer_text,
              answer_number::float8 AS answer_number, answer_date::text AS answer_date,
              answer_boolean, comment, evidence_urls, created_at, updated_at;`);
  return rows[0] ?? null;
}

export type ReviewStatus = "in_review" | "approved";

// ---------------------------- Records of a form ----------------------------

// A whole form is saved in one transaction, a round trip per field, so it gets room to finish.
const FORM_TX = { maxWait: 10_000, timeout: 30_000 };

/** The most times one form can be filled in for one field. */
export const MAX_FORM_RECORDS = 50;

export interface FormRecord {
  id: string;
  sort_order: number;
  // The evidence uploaded at the end of the form, for this record.
  evidence_urls: string[];
  created_at: Date;
  updated_at: Date;
}

export interface RecordAnswerRow extends AnswerColumns {
  answer_id: string;
  record_id: string;
  question_id: string;
}

/** The records of one form for one field and side, oldest first. */
export async function listFormRecords(
  categoryId: string,
  fieldId: string,
  programId: string,
  authorRole: string
): Promise<FormRecord[]> {
  return prisma.$queryRaw<FormRecord[]>(Prisma.sql`
    SELECT id, sort_order, evidence_urls, created_at, updated_at
      FROM assessment_records
     WHERE category_id = ${categoryId}::uuid
       AND field_id = ${fieldId}::uuid
       AND program_id = ${programId}::uuid
       AND author_role = ${authorRole}
       AND deleted_at IS NULL
     ORDER BY sort_order ASC, created_at ASC;`);
}

/** Every answer held inside the records of one form. */
export async function listRecordAnswers(
  categoryId: string,
  fieldId: string,
  programId: string,
  authorRole: string
): Promise<RecordAnswerRow[]> {
  return prisma.$queryRaw<RecordAnswerRow[]>(Prisma.sql`
    SELECT ar.id AS answer_id,
           ar.record_id,
           ar.question_id,
           ${ANSWER_COLUMNS}
      FROM assessment_records rec
      JOIN assessment_responses ar
             ON ar.record_id = rec.id
            AND ar.deleted_at IS NULL
      JOIN assessment_questions aq
             ON aq.id = ar.question_id
            AND aq.deleted_at IS NULL
            AND aq.is_active = true
      ${ANSWER_OPTION_JOIN}
     WHERE rec.category_id = ${categoryId}::uuid
       AND rec.field_id = ${fieldId}::uuid
       AND rec.program_id = ${programId}::uuid
       AND rec.author_role = ${authorRole}
       AND rec.deleted_at IS NULL;`);
}

export type RecordTarget = { kind: "first" } | { kind: "new" } | { kind: "id"; id: string };

export type ResolvedRecord =
  | { ok: true; id: string }
  | { ok: false; reason: "missing" | "full" };

/**
 * The record a save goes into: the one named, the first one (made when the
 * form has none yet), or a new one. Held under a lock per form, so two saves
 * at once never make two first records.
 */
export async function resolveFormRecord(
  tx: Prisma.TransactionClient,
  owner: {
    fieldId: string;
    programId: string;
    categoryId: string;
    authorRole: string;
    authorId: string | null;
  },
  target: RecordTarget
): Promise<ResolvedRecord> {
  const key = `${owner.fieldId}:${owner.programId}:${owner.authorRole}:${owner.categoryId}`;
  await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))::text;`);

  const existing = await tx.$queryRaw<{ id: string; sort_order: number }[]>(Prisma.sql`
    SELECT id, sort_order
      FROM assessment_records
     WHERE category_id = ${owner.categoryId}::uuid
       AND field_id = ${owner.fieldId}::uuid
       AND program_id = ${owner.programId}::uuid
       AND author_role = ${owner.authorRole}
       AND deleted_at IS NULL
     ORDER BY sort_order ASC, created_at ASC;`);

  if (target.kind === "id") {
    return existing.some((r) => r.id === target.id)
      ? { ok: true, id: target.id }
      : { ok: false, reason: "missing" };
  }
  if (target.kind === "first" && existing[0]) return { ok: true, id: existing[0].id };
  if (existing.length >= MAX_FORM_RECORDS) return { ok: false, reason: "full" };

  const nextOrder = existing.reduce((max, r) => Math.max(max, r.sort_order + 1), 0);
  const created = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    INSERT INTO assessment_records (field_id, program_id, category_id, author_role, author_id, sort_order)
    VALUES (${owner.fieldId}::uuid, ${owner.programId}::uuid, ${owner.categoryId}::uuid,
            ${owner.authorRole}, ${owner.authorId}::uuid, ${nextOrder})
    RETURNING id;`);
  return { ok: true, id: created[0].id };
}

/** Removes one record and its answers, unless the assessment has been submitted. */
export async function deleteFormRecord(
  recordId: string,
  owner: { fieldId: string; programId: string; categoryId: string; authorRole: string }
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const removed = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE assessment_records
         SET deleted_at = now(), updated_at = now()
       WHERE id = ${recordId}::uuid
         AND category_id = ${owner.categoryId}::uuid
         AND field_id = ${owner.fieldId}::uuid
         AND program_id = ${owner.programId}::uuid
         AND author_role = ${owner.authorRole}
         AND deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM field_assessments fa
                          WHERE fa.field_id = ${owner.fieldId}::uuid
                            AND fa.program_id = ${owner.programId}::uuid
                            AND fa.author_role = ${owner.authorRole}
                            AND fa.status = 'submitted')
       RETURNING id;`);
    if (!removed[0]) return false;
    await tx.$executeRaw(Prisma.sql`
      UPDATE assessment_responses
         SET deleted_at = now(), updated_at = now()
       WHERE record_id = ${recordId}::uuid AND deleted_at IS NULL;`);
    return true;
  }, FORM_TX);
}

// Nothing is written once the side has submitted.
const notSubmitted = (owner: { fieldId: string; programId: string; authorRole: string }) => Prisma.sql`
  NOT EXISTS (SELECT 1 FROM field_assessments fa
               WHERE fa.field_id = ${owner.fieldId}::uuid
                 AND fa.program_id = ${owner.programId}::uuid
                 AND fa.author_role = ${owner.authorRole}
                 AND fa.status = 'submitted')`;

/** The evidence at the end of a form: on its record, or on the category when it has no records. */
async function saveFormEvidence(
  tx: Prisma.TransactionClient,
  owner: { fieldId: string; programId: string; categoryId: string; authorRole: string; authorId: string | null },
  recordId: string | null,
  evidenceUrls: string[]
): Promise<boolean> {
  const rows = recordId
    ? await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        UPDATE assessment_records
           SET evidence_urls = ${evidenceUrls}::text[], updated_at = now()
         WHERE id = ${recordId}::uuid AND deleted_at IS NULL AND ${notSubmitted(owner)}
         RETURNING id;`)
    : await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        INSERT INTO assessment_category_evidence
          (field_id, program_id, category_id, author_role, author_id, evidence_urls)
        SELECT ${owner.fieldId}::uuid, ${owner.programId}::uuid, ${owner.categoryId}::uuid,
               ${owner.authorRole}, ${owner.authorId}::uuid, ${evidenceUrls}::text[]
         WHERE ${notSubmitted(owner)}
        ON CONFLICT (field_id, program_id, author_role, category_id) WHERE deleted_at IS NULL
          DO UPDATE SET evidence_urls = EXCLUDED.evidence_urls,
                        author_id = EXCLUDED.author_id,
                        updated_at = now()
        RETURNING id;`);
  return rows.length > 0;
}

/** The evidence at the end of a multiple choice category. */
export async function getCategoryEvidence(
  categoryId: string,
  fieldId: string,
  programId: string,
  authorRole: string
): Promise<string[]> {
  const row = await prisma.assessment_category_evidence.findFirst({
    where: {
      category_id: categoryId,
      field_id: fieldId,
      program_id: programId,
      author_role: authorRole,
      deleted_at: null,
    },
    select: { evidence_urls: true },
  });
  return row?.evidence_urls ?? [];
}

/** Every piece of form evidence one side uploaded, by record and by category. */
export async function listAssessmentEvidence(
  fieldId: string,
  programId: string,
  authorRole: string
): Promise<{ byRecord: Map<string, string[]>; byCategory: Map<string, string[]> }> {
  const [records, categories] = await Promise.all([
    prisma.assessment_records.findMany({
      where: { field_id: fieldId, program_id: programId, author_role: authorRole, deleted_at: null },
      select: { id: true, evidence_urls: true },
    }),
    prisma.assessment_category_evidence.findMany({
      where: { field_id: fieldId, program_id: programId, author_role: authorRole, deleted_at: null },
      select: { category_id: true, evidence_urls: true },
    }),
  ]);
  return {
    byRecord: new Map(records.map((r) => [r.id, r.evidence_urls])),
    byCategory: new Map(categories.map((c) => [c.category_id, c.evidence_urls])),
  };
}

class FormSaveAborted extends Error {
  constructor(readonly reason: "missing" | "full" | "gone") {
    super(reason);
  }
}

export type FormSaveResult =
  | { ok: true; recordId: string | null; saved: SavedResponse[] }
  | { ok: false; reason: "missing" | "full" | "gone" };

/**
 * Saves the answers of one form in one go. A form of an input based assessment
 * saves into a record, which is made first when asked for; a multiple choice
 * form has no record. Anything that goes wrong undoes the whole save.
 */
export async function saveFormAnswers(
  owner: {
    fieldId: string;
    programId: string;
    categoryId: string;
    authorRole: string;
    authorId: string | null;
  },
  target: RecordTarget | null,
  items: ResponseInput[],
  // The evidence at the end of the form; undefined leaves what is there.
  evidenceUrls?: string[]
): Promise<FormSaveResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      let into: string | null = null;
      if (target) {
        const record = await resolveFormRecord(tx, owner, target);
        if (!record.ok) throw new FormSaveAborted(record.reason);
        into = record.id;
      }
      const saved: SavedResponse[] = [];
      for (const item of items) {
        const row = await upsertResponse({ ...item, recordId: into }, tx);
        if (!row) throw new FormSaveAborted("gone");
        saved.push(row);
      }
      if (evidenceUrls !== undefined) {
        const kept = await saveFormEvidence(tx, owner, into, evidenceUrls);
        if (!kept) throw new FormSaveAborted("gone");
      }
      return { ok: true as const, recordId: into, saved };
    }, FORM_TX);
  } catch (err) {
    if (err instanceof FormSaveAborted) return { ok: false, reason: err.reason };
    throw err;
  }
}

export interface FieldAssessment {
  id: string;
  field_id: string;
  status: "draft" | "submitted";
  // A submitted assessment waits for an admin before its score counts anywhere.
  review_status: ReviewStatus;
  reviewed_at: Date | null;
  review_note: string | null;
  total_questions: number;
  answered: number;
  total_score: number;
  max_score: number;
  percentage: string;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toFieldAssessment(r: {
  id: string;
  field_id: string;
  status: string;
  review_status: string;
  reviewed_at: Date | null;
  review_note: string | null;
  total_questions: number;
  answered: number;
  total_score: number;
  max_score: number;
  percentage: Prisma.Decimal;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}): FieldAssessment {
  return {
    id: r.id,
    field_id: r.field_id,
    status: r.status as "draft" | "submitted",
    review_status: r.review_status as ReviewStatus,
    reviewed_at: r.reviewed_at,
    review_note: r.review_note,
    total_questions: r.total_questions,
    answered: r.answered,
    total_score: r.total_score,
    max_score: r.max_score,
    percentage: r.percentage.toFixed(2),
    submitted_at: r.submitted_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function findFieldAssessment(
  fieldId: string,
  programId: string,
  authorRole: AuthorRole = "farmer"
): Promise<FieldAssessment | null> {
  const r = await prisma.field_assessments.findFirst({
    where: { field_id: fieldId, program_id: programId, author_role: authorRole },
  });
  return r ? toFieldAssessment(r) : null;
}

export async function isFieldSubmitted(
  fieldId: string,
  programId: string,
  authorRole: AuthorRole = "farmer"
): Promise<boolean> {
  const r = await prisma.field_assessments.findFirst({
    where: { field_id: fieldId, program_id: programId, author_role: authorRole },
    select: { status: true },
  });
  return r?.status === "submitted";
}

// How many answers are currently saved for a (field, program, role). 0 means the
// assessment has not been started.
export async function countFieldResponses(
  fieldId: string,
  programId: string,
  authorRole: AuthorRole = "farmer"
): Promise<number> {
  return prisma.assessment_responses.count({
    where: {
      field_id: fieldId,
      program_id: programId,
      author_role: authorRole,
      deleted_at: null,
    },
  });
}

// Discard an in-progress assessment: soft-delete its saved answers and remove any
// non-submitted draft row, so the (field, program) can be started fresh. The
// caller must ensure the assessment is not already submitted.
export async function discardFieldAssessment(
  fieldId: string,
  programId: string,
  authorRole: AuthorRole = "farmer"
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const res = await tx.assessment_responses.updateMany({
      where: {
        field_id: fieldId,
        program_id: programId,
        author_role: authorRole,
        deleted_at: null,
      },
      data: { deleted_at: new Date() },
    });
    // The records of its forms, and the evidence at the end of them, go with the answers.
    await tx.assessment_records.updateMany({
      where: {
        field_id: fieldId,
        program_id: programId,
        author_role: authorRole,
        deleted_at: null,
      },
      data: { deleted_at: new Date() },
    });
    await tx.assessment_category_evidence.updateMany({
      where: {
        field_id: fieldId,
        program_id: programId,
        author_role: authorRole,
        deleted_at: null,
      },
      data: { deleted_at: new Date() },
    });
    await tx.field_assessments.deleteMany({
      where: {
        field_id: fieldId,
        program_id: programId,
        author_role: authorRole,
        status: { not: "submitted" },
      },
    });
    return res.count;
  });
}

export interface AnswerTotals {
  answered: number;
  // Answers that still carry no score of any kind.
  unscored: number;
  total_score: number;
  max_score: number;
  // The same two before rounding, so the percentage is worked out from them.
  exact_score: number;
  exact_max: number;
}

/**
 * What one side's answers add up to. Plain answers add up as they are; the
 * records of one form count as their average, so filling a form in more times
 * neither raises nor lowers what the form can score.
 */
export async function getAnswerTotals(
  db: Prisma.TransactionClient | typeof prisma,
  fieldId: string,
  programId: string,
  authorRole: string
): Promise<AnswerTotals> {
  const rows = await db.$queryRaw<AnswerTotals[]>(Prisma.sql`
    WITH answers AS (
      SELECT ar.question_id, aq.category_id, ar.record_id, aq.max_score,
             COALESCE(ar.review_score, ar.score) AS final_score
        FROM assessment_responses ar
        JOIN assessment_questions aq ON aq.id = ar.question_id
        JOIN assessment_categories ac ON ac.id = aq.category_id
       WHERE ar.field_id = ${fieldId}::uuid AND ar.deleted_at IS NULL
         AND ar.author_role = ${authorRole}
         AND ar.program_id = ${programId}::uuid
         AND aq.deleted_at IS NULL AND aq.is_active = true
         AND ac.deleted_at IS NULL AND ac.is_active = true
         AND ac.template_id = ${programTemplate(programId)}
    ),
    per_record AS (
      SELECT category_id, record_id,
             COALESCE(SUM(final_score), 0) AS score,
             COALESCE(SUM(max_score) FILTER (WHERE final_score IS NOT NULL), 0) AS max_score
        FROM answers
       GROUP BY category_id, record_id
    ),
    per_category AS (
      SELECT category_id, AVG(score) AS score, AVG(max_score) AS max_score
        FROM per_record
       GROUP BY category_id
    )
    SELECT (SELECT COUNT(DISTINCT question_id) FROM answers)::int AS answered,
           (SELECT COUNT(*) FROM answers WHERE final_score IS NULL)::int AS unscored,
           COALESCE(ROUND(SUM(score)), 0)::int AS total_score,
           COALESCE(ROUND(SUM(max_score)), 0)::int AS max_score,
           COALESCE(SUM(score), 0)::float8 AS exact_score,
           COALESCE(SUM(max_score), 0)::float8 AS exact_max
      FROM per_category;`);
  return (
    rows[0] ?? { answered: 0, unscored: 0, total_score: 0, max_score: 0, exact_score: 0, exact_max: 0 }
  );
}

export async function submitFieldAssessment(
  fieldId: string,
  programId: string,
  authorRole: AuthorRole = "farmer",
  authorId: string | null = null
): Promise<FieldAssessment | null> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ status: string }[]>(Prisma.sql`
      SELECT status FROM field_assessments
       WHERE field_id = ${fieldId}::uuid AND author_role = ${authorRole}
         AND program_id = ${programId}::uuid
       FOR UPDATE;`);
    if (locked[0]?.status === "submitted") return null;

    const totalRows = await tx.$queryRaw<{ total_questions: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total_questions
        FROM assessment_questions aq
        JOIN assessment_categories ac ON ac.id = aq.category_id
       WHERE aq.deleted_at IS NULL AND aq.is_active = true
         AND ac.deleted_at IS NULL AND ac.is_active = true
         AND ac.template_id = ${programTemplate(programId)};`);

    const totals = await getAnswerTotals(tx, fieldId, programId, authorRole);

    const totalQuestions = totalRows[0]?.total_questions ?? 0;
    const answered = totals.answered;
    const totalScore = totals.total_score;
    const maxScore = totals.max_score;
    const percentage = totals.exact_max > 0 ? (totals.exact_score / totals.exact_max) * 100 : 0;
    const pctStr = percentage.toFixed(2);

    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        field_id: string;
        status: string;
        review_status: string;
        reviewed_at: Date | null;
        review_note: string | null;
        total_questions: number;
        answered: number;
        total_score: number;
        max_score: number;
        percentage: Prisma.Decimal;
        submitted_at: Date | null;
        created_at: Date;
        updated_at: Date;
      }>
    >(Prisma.sql`
      INSERT INTO field_assessments
        (field_id, author_role, author_id, program_id, status, review_status,
         total_questions, answered, total_score, max_score, percentage, submitted_at)
      VALUES (${fieldId}::uuid, ${authorRole}, ${authorId}::uuid, ${programId}::uuid, 'submitted', 'in_review',
              ${totalQuestions}, ${answered}, ${totalScore}, ${maxScore}, ${pctStr}::numeric, now())
      ON CONFLICT (field_id, author_role, program_id)
        DO UPDATE SET status = 'submitted',
                      review_status = 'in_review',
                      reviewed_by = NULL,
                      reviewed_at = NULL,
                      review_note = NULL,
                      author_id = EXCLUDED.author_id,
                      total_questions = EXCLUDED.total_questions,
                      answered = EXCLUDED.answered,
                      total_score = EXCLUDED.total_score,
                      max_score = EXCLUDED.max_score,
                      percentage = EXCLUDED.percentage,
                      submitted_at = now(),
                      updated_at = now()
      RETURNING id, field_id, status, review_status, reviewed_at, review_note,
                total_questions, answered, total_score,
                max_score, percentage, submitted_at, created_at, updated_at;`);
    return rows[0] ? toFieldAssessment(rows[0]) : null;
  });
}

// The answer of one question as it is read back: the value in its own column,
// the chosen answer's text for a multiple choice question, and the score a
// review gave it.
const ANSWER_COLUMNS = Prisma.sql`
           aq.question_type,
           aq.max_score,
           aq.evidence_mode,
           aq.comment_mode,
           (ar.id IS NOT NULL)          AS answered,
           ar.score                     AS answer_score,
           ar.review_score              AS review_score,
           ar.option_id                 AS answer_option_id,
           ao.option_text               AS answer_option_text,
           ar.answer_text               AS answer_text,
           ar.answer_number::float8     AS answer_number,
           ar.answer_date::text         AS answer_date,
           ar.answer_boolean            AS answer_boolean,
           ar.comment                   AS answer_comment,
           ar.evidence_urls             AS answer_evidence_urls`;

const ANSWER_OPTION_JOIN = Prisma.sql`
      LEFT JOIN assessment_question_options ao ON ao.id = ar.option_id`;

export interface AnswerColumns {
  question_type: QuestionType;
  max_score: number;
  evidence_mode: AnswerExtra;
  comment_mode: AnswerExtra;
  answered: boolean;
  answer_score: number | null;
  review_score: number | null;
  answer_option_id: string | null;
  answer_option_text: string | null;
  answer_text: string | null;
  answer_number: number | null;
  answer_date: string | null;
  answer_boolean: boolean | null;
  answer_comment: string | null;
  answer_evidence_urls: string[] | null;
}

/** Which record of a form an answer sits in; all null for a multiple choice answer. */
interface RecordColumns {
  answer_id: string | null;
  record_id: string | null;
  record_sort: number | null;
}

export interface HistoryRow extends AnswerColumns, RecordColumns {
  category_id: string;
  category_name: string;
  category_sort: number;
  question_id: string;
  question_code: string | null;
  question_text: string;
  guidance_note: string | null;
  question_sort: number;
  score0_description: string | null;
  score1_description: string | null;
  score2_description: string | null;
  score3_description: string | null;
}

export async function getHistoryRowsForField(
  fieldId: string,
  programId: string,
  authorRole: AuthorRole = "farmer"
): Promise<HistoryRow[]> {
  return prisma.$queryRaw<HistoryRow[]>(Prisma.sql`
    SELECT ac.id          AS category_id,
           ac.name        AS category_name,
           ac.sort_order  AS category_sort,
           aq.id          AS question_id,
           aq.question_code,
           aq.question_text,
           aq.guidance_note,
           aq.sort_order  AS question_sort,
           aq.score0_description,
           aq.score1_description,
           aq.score2_description,
           aq.score3_description,
           ${ANSWER_COLUMNS},
           ar.id          AS answer_id,
           ar.record_id,
           rec.sort_order AS record_sort
      FROM assessment_categories ac
      JOIN assessment_questions aq
             ON aq.category_id = ac.id
            AND aq.deleted_at IS NULL
            AND aq.is_active = true
      LEFT JOIN assessment_responses ar
             ON ar.question_id = aq.id
            AND ar.field_id = ${fieldId}::uuid
            AND ar.program_id = ${programId}::uuid
            AND ar.deleted_at IS NULL
            AND ar.author_role = ${authorRole}
      LEFT JOIN assessment_records rec ON rec.id = ar.record_id
      ${ANSWER_OPTION_JOIN}
     WHERE ac.deleted_at IS NULL AND ac.is_active = true
       AND ac.template_id = ${programTemplate(programId)}
     ORDER BY ac.sort_order ASC, ac.created_at ASC,
              rec.sort_order ASC NULLS FIRST, rec.created_at ASC,
              aq.sort_order ASC, aq.created_at ASC;`);
}

export interface ComparisonRow {
  category_id: string;
  category_name: string;
  category_sort: number;
  question_id: string;
  question_code: string | null;
  question_text: string;
  question_sort: number;
  question_type: QuestionType;
  max_score: number;
  farmer_answered: boolean;
  farmer_score: number | null;
  // Every record's answer written out, in record order.
  farmer_written: string | null;
  farmer_records: number;
  assessor_answered: boolean;
  assessor_score: number | null;
  assessor_written: string | null;
  assessor_records: number;
}

// One side's answers to one question, across every record of the form.
function comparisonSide(role: "farmer" | "assessor", fieldId: string, programId: string) {
  return Prisma.sql`
    SELECT COUNT(r.id) > 0 AS answered,
           ROUND(AVG(COALESCE(r.review_score, r.score)))::int AS score,
           COUNT(DISTINCT r.record_id)::int AS records,
           string_agg(
             CASE aq.question_type
               WHEN 'mcq' THEN COALESCE(o.option_text, 'Answer no longer in the list')
               WHEN 'scored' THEN 'Score ' || r.score::text
               WHEN 'number' THEN r.answer_number::float8::text
               WHEN 'date' THEN to_char(r.answer_date, 'YYYY-MM-DD')
               WHEN 'boolean' THEN CASE WHEN r.answer_boolean THEN 'Yes' ELSE 'No' END
               ELSE r.answer_text
             END,
             ' | ' ORDER BY rec.sort_order NULLS FIRST, rec.created_at, r.created_at) AS written
      FROM assessment_responses r
      LEFT JOIN assessment_records rec ON rec.id = r.record_id
      LEFT JOIN assessment_question_options o ON o.id = r.option_id
     WHERE r.question_id = aq.id
       AND r.field_id = ${fieldId}::uuid
       AND r.program_id = ${programId}::uuid
       AND r.author_role = ${role}
       AND r.deleted_at IS NULL`;
}

export async function getComparisonRowsForField(
  fieldId: string,
  programId: string
): Promise<ComparisonRow[]> {
  return prisma.$queryRaw<ComparisonRow[]>(Prisma.sql`
    SELECT ac.id          AS category_id,
           ac.name        AS category_name,
           ac.sort_order  AS category_sort,
           aq.id          AS question_id,
           aq.question_code,
           aq.question_text,
           aq.sort_order  AS question_sort,
           aq.question_type,
           aq.max_score,
           f.answered     AS farmer_answered,
           f.score        AS farmer_score,
           f.written      AS farmer_written,
           f.records      AS farmer_records,
           a.answered     AS assessor_answered,
           a.score        AS assessor_score,
           a.written      AS assessor_written,
           a.records      AS assessor_records
      FROM assessment_categories ac
      JOIN assessment_questions aq
             ON aq.category_id = ac.id
            AND aq.deleted_at IS NULL
            AND aq.is_active = true
      LEFT JOIN LATERAL (${comparisonSide("farmer", fieldId, programId)}) f ON true
      LEFT JOIN LATERAL (${comparisonSide("assessor", fieldId, programId)}) a ON true
     WHERE ac.deleted_at IS NULL AND ac.is_active = true
       AND ac.template_id = ${programTemplate(programId)}
     ORDER BY ac.sort_order ASC, ac.created_at ASC,
              aq.sort_order ASC, aq.created_at ASC;`);
}

export interface ReviewRow extends AnswerColumns, RecordColumns {
  category_id: string;
  category_name: string;
  category_sort: number;
  question_id: string;
  question_code: string | null;
  question_text: string;
  guidance_note: string | null;
  question_sort: number;
}

export async function getReviewRowsForField(
  fieldId: string,
  programId: string,
  authorRole: AuthorRole = "farmer"
): Promise<ReviewRow[]> {
  return prisma.$queryRaw<ReviewRow[]>(Prisma.sql`
    SELECT ac.id          AS category_id,
           ac.name        AS category_name,
           ac.sort_order  AS category_sort,
           aq.id          AS question_id,
           aq.question_code,
           aq.question_text,
           aq.guidance_note,
           aq.sort_order  AS question_sort,
           ${ANSWER_COLUMNS},
           ar.id          AS answer_id,
           ar.record_id,
           rec.sort_order AS record_sort
      FROM assessment_categories ac
      JOIN assessment_questions aq
             ON aq.category_id = ac.id
            AND aq.deleted_at IS NULL
            AND aq.is_active = true
      LEFT JOIN assessment_responses ar
             ON ar.question_id = aq.id
            AND ar.field_id = ${fieldId}::uuid
            AND ar.program_id = ${programId}::uuid
            AND ar.deleted_at IS NULL
            AND ar.author_role = ${authorRole}
      LEFT JOIN assessment_records rec ON rec.id = ar.record_id
      ${ANSWER_OPTION_JOIN}
     WHERE ac.deleted_at IS NULL AND ac.is_active = true
       AND ac.template_id = ${programTemplate(programId)}
     ORDER BY ac.sort_order ASC, ac.created_at ASC,
              rec.sort_order ASC NULLS FIRST, rec.created_at ASC,
              aq.sort_order ASC, aq.created_at ASC;`);
}

export interface FieldCategoryScoreRow {
  id: string;
  name: string;
  sort_order: number;
  answered: number;
  total_score: number;
  max_score: number;
  percentage: number | null;
}

export async function getFieldCategoryScores(
  fieldId: string,
  programId: string,
  authorRole: "farmer" | "assessor" = "farmer"
): Promise<FieldCategoryScoreRow[]> {
  return prisma.$queryRaw<FieldCategoryScoreRow[]>(Prisma.sql`
    SELECT ac.id,
           ac.name,
           ac.sort_order,
           COUNT(DISTINCT ar.question_id)::int        AS answered,
           COALESCE(SUM(COALESCE(ar.review_score, ar.score)), 0)::int AS total_score,
           COALESCE(SUM(aq.max_score) FILTER (WHERE COALESCE(ar.review_score, ar.score) IS NOT NULL), 0)::int AS max_score,
           CASE WHEN COUNT(ar.id) FILTER (WHERE COALESCE(ar.review_score, ar.score) IS NOT NULL) > 0
                THEN ROUND((COALESCE(SUM(COALESCE(ar.review_score, ar.score)), 0)::numeric
                             / NULLIF(SUM(aq.max_score) FILTER (WHERE COALESCE(ar.review_score, ar.score) IS NOT NULL), 0)) * 100, 2)
                ELSE NULL END                         AS percentage
      FROM assessment_categories ac
      JOIN assessment_questions aq
             ON aq.category_id = ac.id
            AND aq.deleted_at IS NULL AND aq.is_active = true
      LEFT JOIN assessment_responses ar
             ON ar.question_id = aq.id
            AND ar.deleted_at IS NULL
            AND ar.author_role = ${authorRole}
            AND ar.field_id = ${fieldId}::uuid
            AND ar.program_id = ${programId}::uuid
     WHERE ac.deleted_at IS NULL AND ac.is_active = true
       AND ac.template_id = ${programTemplate(programId)}
     GROUP BY ac.id
     HAVING COUNT(aq.id) > 0
     ORDER BY ac.sort_order ASC, ac.created_at ASC;`);
}
