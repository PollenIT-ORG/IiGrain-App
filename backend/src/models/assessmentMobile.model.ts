import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";

export interface OwnedField {
  id: string;
  name: string;
  farm_id: string;
  farm_name: string;
}

export async function findOwnedField(
  fieldId: string,
  userId: string
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
  status: string;
  program_id: string | null;
  program_name: string | null;
  total_questions: number;
  answered: number;
  submitted: boolean;
  submitted_at: Date | null;
  percentage: string | null;
}

export async function listMyFieldsWithAssessment(
  userId: string
): Promise<MyFieldAssessmentRow[]> {
  return prisma.$queryRaw<MyFieldAssessmentRow[]>(Prisma.sql`
    WITH active_q AS (
      SELECT COUNT(*)::int AS total_questions
        FROM assessment_questions aq
        JOIN assessment_categories ac ON ac.id = aq.category_id
       WHERE aq.deleted_at IS NULL AND aq.is_active = true
         AND ac.deleted_at IS NULL AND ac.is_active = true
    ),
    -- The farmer's enrolled fields + which program (latest enrollment per field).
    -- Only STARTED programs - a field enrolled only in a future-start program is
    -- not yet assessable, so it must not appear in the assessable list.
    enrolled AS (
      SELECT DISTINCT ON (pef.field_id)
             pef.field_id, pe.program_id, p.name AS program_name
        FROM program_enrollment_fields pef
        JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
        JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
       WHERE pef.deleted_at IS NULL
         AND pe.farmer_id = ${userId}::uuid
         AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
       ORDER BY pef.field_id, pe.enrolled_at DESC
    )
    SELECT f.id,
           f.name,
           f.farm_id,
           fm.name AS farm_name,
           f.crop,
           f.status,
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
      CROSS JOIN active_q aq
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS answered
          FROM assessment_responses ar
          JOIN assessment_questions q  ON q.id = ar.question_id
          JOIN assessment_categories c ON c.id = q.category_id
         WHERE ar.field_id = f.id
           AND ar.deleted_at IS NULL
           AND ar.author_role = 'farmer'
           AND q.deleted_at IS NULL AND q.is_active = true
           AND c.deleted_at IS NULL AND c.is_active = true
      ) ans ON true
      LEFT JOIN field_assessments fa
             ON fa.field_id = f.id AND fa.author_role = 'farmer'
     -- Only PENDING work here: not_started + in_progress. Completed (submitted)
     -- assessments are excluded - they live in the history endpoint instead.
     WHERE fa.status IS NULL OR fa.status <> 'submitted'
     ORDER BY f.created_at DESC;`);
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
  submitted_at: Date | null;
}

export async function listMyCompletedAssessments(
  userId: string,
  farmId: string | null
): Promise<CompletedAssessmentRow[]> {
  return prisma.$queryRaw<CompletedAssessmentRow[]>(Prisma.sql`
    WITH active_q AS (
      SELECT COUNT(*)::int AS total_questions
        FROM assessment_questions aq
        JOIN assessment_categories ac ON ac.id = aq.category_id
       WHERE aq.deleted_at IS NULL AND aq.is_active = true
         AND ac.deleted_at IS NULL AND ac.is_active = true
    ),
    enrolled AS (
      SELECT DISTINCT ON (pef.field_id)
             pef.field_id, pe.program_id, p.name AS program_name
        FROM program_enrollment_fields pef
        JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
        JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
       WHERE pef.deleted_at IS NULL
         AND pe.farmer_id = ${userId}::uuid
         AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
       ORDER BY pef.field_id, pe.enrolled_at DESC
    )
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
           fa.submitted_at
      FROM enrolled en
      JOIN fields f ON f.id = en.field_id AND f.deleted_at IS NULL
      JOIN farms fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL
      JOIN field_assessments fa
             ON fa.field_id = f.id
            AND fa.author_role = 'farmer'
            AND fa.status = 'submitted'
     WHERE (${farmId}::uuid IS NULL OR f.farm_id = ${farmId}::uuid)
     ORDER BY fa.submitted_at DESC NULLS LAST;`);
}

export interface AssessorFieldRow {
  id: string;
  name: string;
  farm_id: string;
  farm_name: string;
  farmer_id: string;
  farmer_name: string | null;
  crop: string | null;
  status: string;
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
    WITH active_q AS (
      SELECT COUNT(*)::int AS total_questions
        FROM assessment_questions aq
        JOIN assessment_categories ac ON ac.id = aq.category_id
       WHERE aq.deleted_at IS NULL AND aq.is_active = true
         AND ac.deleted_at IS NULL AND ac.is_active = true
    )
    SELECT DISTINCT
           f.id,
           f.name,
           f.farm_id,
           fm.name AS farm_name,
           u.id    AS farmer_id,
           u.full_name AS farmer_name,
           f.crop,
           f.status,
           f.created_at,
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
      CROSS JOIN active_q aq
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS answered
          FROM assessment_responses ar
          JOIN assessment_questions q  ON q.id = ar.question_id
          JOIN assessment_categories c ON c.id = q.category_id
         WHERE ar.field_id = f.id
           AND ar.deleted_at IS NULL
           AND ar.author_role = 'assessor'
           AND q.deleted_at IS NULL AND q.is_active = true
           AND c.deleted_at IS NULL AND c.is_active = true
      ) ans ON true
      LEFT JOIN field_assessments afa
             ON afa.field_id = f.id AND afa.author_role = 'assessor'
      LEFT JOIN field_assessments ffa
             ON ffa.field_id = f.id AND ffa.author_role = 'farmer'
     WHERE pe.assessor_id = ${assessorId}::uuid
       AND pe.deleted_at IS NULL
       -- Only STARTED programs - future-start programs aren't assessable yet.
       AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
     ORDER BY f.created_at DESC;`);
}

export async function assessorCanAccessField(
  assessorId: string,
  fieldId: string
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: number }[]>(Prisma.sql`
    SELECT 1 AS ok
      FROM program_enrollment_fields pef
      JOIN program_enrollments pe
             ON pe.id = pef.enrollment_id
            AND pe.assessor_id = ${assessorId}::uuid
            AND pe.deleted_at IS NULL
      JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
     WHERE pef.field_id = ${fieldId}::uuid
       AND pef.deleted_at IS NULL
       -- Only STARTED programs - future-start programs aren't assessable yet.
       AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
     LIMIT 1;`);
  return rows.length > 0;
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
}

export async function getCategoryProgressForField(
  fieldId: string,
  authorRole: AuthorRole = "farmer"
): Promise<CategoryProgress[]> {
  const rows = await prisma.$queryRaw<
    { id: string; name: string; sort_order: number; total_questions: number; answered: number }[]
  >(Prisma.sql`
    SELECT ac.id,
           ac.name,
           ac.sort_order,
           COUNT(aq.id)::int AS total_questions,
           COUNT(ar.id)::int AS answered
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
     WHERE ac.deleted_at IS NULL
       AND ac.is_active = true
     GROUP BY ac.id
     HAVING COUNT(aq.id) > 0
     ORDER BY ac.sort_order ASC, ac.created_at ASC;`);
  return rows;
}

export interface QuestionWithAnswer {
  id: string;
  question_code: string | null;
  question_text: string;
  guidance_note: string | null;
  score0_description: string | null;
  score1_description: string | null;
  score2_description: string | null;
  score3_description: string | null;
  sort_order: number;
  answer_score: number | null;
  answer_comment: string | null;
  answer_evidence_urls: string[] | null;
}

export type AuthorRole = "farmer" | "assessor";

function questionWithAnswerSelect(
  fieldId: string,
  authorRole: AuthorRole = "farmer"
) {
  return {
    id: true,
    question_code: true,
    question_text: true,
    guidance_note: true,
    score0_description: true,
    score1_description: true,
    score2_description: true,
    score3_description: true,
    sort_order: true,
    assessment_responses: {
      where: { field_id: fieldId, deleted_at: null, author_role: authorRole },
      select: { score: true, comment: true, evidence_urls: true },
      take: 1,
    },
  } satisfies Prisma.assessment_questionsSelect;
}

type QWARow = {
  id: string;
  question_code: string | null;
  question_text: string;
  guidance_note: string | null;
  score0_description: string | null;
  score1_description: string | null;
  score2_description: string | null;
  score3_description: string | null;
  sort_order: number;
  assessment_responses: { score: number; comment: string | null; evidence_urls: string[] }[];
};

function toQuestionWithAnswer(q: QWARow): QuestionWithAnswer {
  const ans = q.assessment_responses[0];
  return {
    id: q.id,
    question_code: q.question_code,
    question_text: q.question_text,
    guidance_note: q.guidance_note,
    score0_description: q.score0_description,
    score1_description: q.score1_description,
    score2_description: q.score2_description,
    score3_description: q.score3_description,
    sort_order: q.sort_order,
    answer_score: ans ? ans.score : null,
    answer_comment: ans ? ans.comment : null,
    answer_evidence_urls: ans ? ans.evidence_urls : null,
  };
}

export async function getCategoryQuestionsForField(
  categoryId: string,
  fieldId: string,
  authorRole: AuthorRole = "farmer"
): Promise<QuestionWithAnswer[]> {
  const rows = await prisma.assessment_questions.findMany({
    where: { category_id: categoryId, deleted_at: null, is_active: true },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: questionWithAnswerSelect(fieldId, authorRole),
  });
  return (rows as QWARow[]).map(toQuestionWithAnswer);
}

export async function findCategoryQuestionForField(
  categoryId: string,
  questionId: string,
  fieldId: string,
  authorRole: AuthorRole = "farmer"
): Promise<QuestionWithAnswer | null> {
  const q = await prisma.assessment_questions.findFirst({
    where: { id: questionId, category_id: categoryId, deleted_at: null, is_active: true },
    select: questionWithAnswerSelect(fieldId, authorRole),
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
  authorRole: AuthorRole = "farmer"
): Promise<QuestionListRow[]> {
  const rows = await prisma.assessment_questions.findMany({
    where: { category_id: categoryId, deleted_at: null, is_active: true },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: {
      id: true,
      question_code: true,
      question_text: true,
      guidance_note: true,
      sort_order: true,
      assessment_responses: {
        where: { field_id: fieldId, deleted_at: null, author_role: authorRole },
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
  categoryId: string
): Promise<{ id: string; name: string } | null> {
  return prisma.assessment_categories.findFirst({
    where: { id: categoryId, deleted_at: null, is_active: true },
    select: { id: true, name: true },
  });
}

export async function findActiveQuestion(
  questionId: string
): Promise<{ id: string; category_id: string } | null> {
  return prisma.assessment_questions.findFirst({
    where: { id: questionId, deleted_at: null, is_active: true },
    select: { id: true, category_id: true },
  });
}

export interface SavedResponse {
  id: string;
  field_id: string;
  question_id: string;
  score: number;
  comment: string | null;
  evidence_urls: string[];
  created_at: Date;
  updated_at: Date;
}

export interface ResponseInput {
  fieldId: string;
  questionId: string;
  score: number;
  comment: string | null;
  evidenceUrls: string[];
  authorRole?: AuthorRole;
  authorId?: string | null;
  programId?: string | null;
}

export async function upsertResponse(p: ResponseInput): Promise<SavedResponse> {
  const role: AuthorRole = p.authorRole ?? "farmer";
  const authorId = p.authorId ?? null;
  const programId = p.programId ?? null;
  const rows = await prisma.$queryRaw<SavedResponse[]>(Prisma.sql`
    INSERT INTO assessment_responses
      (field_id, question_id, score, comment, evidence_urls, author_role, author_id, program_id)
    VALUES (${p.fieldId}::uuid, ${p.questionId}::uuid, ${p.score}, ${p.comment},
            ${p.evidenceUrls}::text[], ${role}, ${authorId}::uuid, ${programId}::uuid)
    ON CONFLICT (field_id, question_id, author_role) WHERE deleted_at IS NULL
      DO UPDATE SET score = EXCLUDED.score,
                    comment = EXCLUDED.comment,
                    evidence_urls = EXCLUDED.evidence_urls,
                    author_id = EXCLUDED.author_id,
                    program_id = COALESCE(EXCLUDED.program_id, assessment_responses.program_id),
                    updated_at = now()
    RETURNING id, field_id, question_id, score, comment, evidence_urls,
              created_at, updated_at;`);
  return rows[0];
}

export interface FieldAssessment {
  id: string;
  field_id: string;
  status: "draft" | "submitted";
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
  authorRole: AuthorRole = "farmer"
): Promise<FieldAssessment | null> {
  const r = await prisma.field_assessments.findFirst({
    where: { field_id: fieldId, author_role: authorRole },
  });
  return r ? toFieldAssessment(r) : null;
}

export async function isFieldSubmitted(
  fieldId: string,
  authorRole: AuthorRole = "farmer"
): Promise<boolean> {
  const r = await prisma.field_assessments.findFirst({
    where: { field_id: fieldId, author_role: authorRole },
    select: { status: true },
  });
  return r?.status === "submitted";
}

export async function submitFieldAssessment(
  fieldId: string,
  authorRole: AuthorRole = "farmer",
  authorId: string | null = null,
  programId: string | null = null
): Promise<FieldAssessment | null> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ status: string }[]>(Prisma.sql`
      SELECT status FROM field_assessments
       WHERE field_id = ${fieldId}::uuid AND author_role = ${authorRole}
       FOR UPDATE;`);
    if (locked[0]?.status === "submitted") return null;

    const totalRows = await tx.$queryRaw<{ total_questions: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total_questions
        FROM assessment_questions aq
        JOIN assessment_categories ac ON ac.id = aq.category_id
       WHERE aq.deleted_at IS NULL AND aq.is_active = true
         AND ac.deleted_at IS NULL AND ac.is_active = true;`);

    const ansRows = await tx.$queryRaw<{ answered: number; total_score: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS answered,
             COALESCE(SUM(ar.score), 0)::int AS total_score
        FROM assessment_responses ar
        JOIN assessment_questions aq ON aq.id = ar.question_id
        JOIN assessment_categories ac ON ac.id = aq.category_id
       WHERE ar.field_id = ${fieldId}::uuid AND ar.deleted_at IS NULL
         AND ar.author_role = ${authorRole}
         AND aq.deleted_at IS NULL AND aq.is_active = true
         AND ac.deleted_at IS NULL AND ac.is_active = true;`);

    const totalQuestions = totalRows[0]?.total_questions ?? 0;
    const answered = ansRows[0]?.answered ?? 0;
    const totalScore = ansRows[0]?.total_score ?? 0;
    const maxScore = answered * 3;
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const pctStr = percentage.toFixed(2);

    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        field_id: string;
        status: string;
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
        (field_id, author_role, author_id, program_id, status,
         total_questions, answered, total_score, max_score, percentage, submitted_at)
      VALUES (${fieldId}::uuid, ${authorRole}, ${authorId}::uuid, ${programId}::uuid, 'submitted',
              ${totalQuestions}, ${answered}, ${totalScore}, ${maxScore}, ${pctStr}::numeric, now())
      ON CONFLICT (field_id, author_role)
        DO UPDATE SET status = 'submitted',
                      author_id = EXCLUDED.author_id,
                      program_id = COALESCE(EXCLUDED.program_id, field_assessments.program_id),
                      total_questions = EXCLUDED.total_questions,
                      answered = EXCLUDED.answered,
                      total_score = EXCLUDED.total_score,
                      max_score = EXCLUDED.max_score,
                      percentage = EXCLUDED.percentage,
                      submitted_at = now(),
                      updated_at = now()
      RETURNING id, field_id, status, total_questions, answered, total_score,
                max_score, percentage, submitted_at, created_at, updated_at;`);
    return rows[0] ? toFieldAssessment(rows[0]) : null;
  });
}

export interface HistoryRow {
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
  answer_score: number | null;
  answer_comment: string | null;
  answer_evidence_urls: string[] | null;
}

export async function getHistoryRowsForField(
  fieldId: string,
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
           ar.score         AS answer_score,
           ar.comment       AS answer_comment,
           ar.evidence_urls AS answer_evidence_urls
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
     WHERE ac.deleted_at IS NULL AND ac.is_active = true
     ORDER BY ac.sort_order ASC, ac.created_at ASC,
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
  farmer_score: number | null;
  farmer_comment: string | null;
  farmer_evidence_urls: string[] | null;
  assessor_score: number | null;
  assessor_comment: string | null;
  assessor_evidence_urls: string[] | null;
}

export async function getComparisonRowsForField(
  fieldId: string
): Promise<ComparisonRow[]> {
  return prisma.$queryRaw<ComparisonRow[]>(Prisma.sql`
    SELECT ac.id          AS category_id,
           ac.name        AS category_name,
           ac.sort_order  AS category_sort,
           aq.id          AS question_id,
           aq.question_code,
           aq.question_text,
           aq.sort_order  AS question_sort,
           fr.score         AS farmer_score,
           fr.comment       AS farmer_comment,
           fr.evidence_urls AS farmer_evidence_urls,
           asr.score          AS assessor_score,
           asr.comment        AS assessor_comment,
           asr.evidence_urls  AS assessor_evidence_urls
      FROM assessment_categories ac
      JOIN assessment_questions aq
             ON aq.category_id = ac.id
            AND aq.deleted_at IS NULL
            AND aq.is_active = true
      LEFT JOIN assessment_responses fr
             ON fr.question_id = aq.id
            AND fr.field_id = ${fieldId}::uuid
            AND fr.deleted_at IS NULL
            AND fr.author_role = 'farmer'
      LEFT JOIN assessment_responses asr
             ON asr.question_id = aq.id
            AND asr.field_id = ${fieldId}::uuid
            AND asr.deleted_at IS NULL
            AND asr.author_role = 'assessor'
     WHERE ac.deleted_at IS NULL AND ac.is_active = true
     ORDER BY ac.sort_order ASC, ac.created_at ASC,
              aq.sort_order ASC, aq.created_at ASC;`);
}

export interface ReviewRow {
  category_id: string;
  category_name: string;
  category_sort: number;
  question_id: string;
  question_code: string | null;
  question_text: string;
  question_sort: number;
  answer_score: number | null;
  answer_comment: string | null;
  answer_evidence_urls: string[] | null;
}

export async function getReviewRowsForField(
  fieldId: string,
  authorRole: AuthorRole = "farmer"
): Promise<ReviewRow[]> {
  return prisma.$queryRaw<ReviewRow[]>(Prisma.sql`
    SELECT ac.id          AS category_id,
           ac.name        AS category_name,
           ac.sort_order  AS category_sort,
           aq.id          AS question_id,
           aq.question_code,
           aq.question_text,
           aq.sort_order  AS question_sort,
           ar.score         AS answer_score,
           ar.comment       AS answer_comment,
           ar.evidence_urls AS answer_evidence_urls
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
     WHERE ac.deleted_at IS NULL AND ac.is_active = true
     ORDER BY ac.sort_order ASC, ac.created_at ASC,
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
  authorRole: "farmer" | "assessor" = "farmer"
): Promise<FieldCategoryScoreRow[]> {
  return prisma.$queryRaw<FieldCategoryScoreRow[]>(Prisma.sql`
    SELECT ac.id,
           ac.name,
           ac.sort_order,
           COUNT(ar.id)::int                          AS answered,
           COALESCE(SUM(ar.score), 0)::int            AS total_score,
           (COUNT(ar.id) * 3)::int                    AS max_score,
           CASE WHEN COUNT(ar.id) > 0
                THEN ROUND((SUM(ar.score)::numeric / (COUNT(ar.id) * 3)) * 100, 2)
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
     WHERE ac.deleted_at IS NULL AND ac.is_active = true
     GROUP BY ac.id
     HAVING COUNT(aq.id) > 0
     ORDER BY ac.sort_order ASC, ac.created_at ASC;`);
}
