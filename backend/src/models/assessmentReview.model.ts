import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { getAnswerTotals, type AuthorRole, type ReviewStatus } from "./assessmentMobile.model.js";

export interface ReviewListRow {
  id: string;
  field_id: string;
  field_name: string;
  farm_name: string;
  program_id: string;
  program_name: string;
  author_role: AuthorRole;
  author_id: string | null;
  author_name: string | null;
  total_questions: number;
  answered: number;
  total_score: number;
  max_score: number;
  percentage: string;
  review_status: ReviewStatus;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  reviewer_name: string | null;
  // How many answers still have no score of any kind.
  unscored: number;
  // Everything the assessment can score, used when it is scored as a whole.
  possible_score: number;
}

const REVIEW_COLUMNS = Prisma.sql`
  fa.id, fa.field_id, f.name AS field_name, fm.name AS farm_name,
  fa.program_id, p.name AS program_name,
  fa.author_role, fa.author_id, au.full_name AS author_name,
  fa.total_questions, fa.answered, fa.total_score, fa.max_score, fa.percentage,
  fa.review_status, fa.submitted_at, fa.reviewed_at, ru.full_name AS reviewer_name,
  (SELECT COUNT(*)::int
     FROM assessment_responses ar
     JOIN assessment_questions aq ON aq.id = ar.question_id
            AND aq.deleted_at IS NULL AND aq.is_active = true
     JOIN assessment_categories ac ON ac.id = aq.category_id
            AND ac.deleted_at IS NULL AND ac.is_active = true
    WHERE ar.field_id = fa.field_id AND ar.program_id = fa.program_id
      AND ar.author_role = fa.author_role AND ar.deleted_at IS NULL
      AND COALESCE(ar.review_score, ar.score) IS NULL) AS unscored,
  (SELECT COALESCE(SUM(aq.max_score), 0)::int
     FROM assessment_questions aq
     JOIN assessment_categories ac ON ac.id = aq.category_id
    WHERE aq.deleted_at IS NULL AND aq.is_active = true
      AND ac.deleted_at IS NULL AND ac.is_active = true
      AND ac.template_id = p.assessment_template_id) AS possible_score`;

const REVIEW_FROM = Prisma.sql`
  FROM field_assessments fa
  JOIN fields f ON f.id = fa.field_id AND f.deleted_at IS NULL
  JOIN farms fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL
  JOIN programs p ON p.id = fa.program_id AND p.deleted_at IS NULL
  LEFT JOIN users au ON au.id = fa.author_id
  LEFT JOIN users ru ON ru.id = fa.reviewed_by`;

export async function findSubmittedAssessment(
  id: string,
  ownerId: string | null
): Promise<ReviewListRow | null> {
  const scope = ownerId ? Prisma.sql`AND p.created_by = ${ownerId}::uuid` : Prisma.empty;
  const rows = await prisma.$queryRaw<ReviewListRow[]>(Prisma.sql`
    SELECT ${REVIEW_COLUMNS}
    ${REVIEW_FROM}
     WHERE fa.id = ${id}::uuid AND fa.status = 'submitted' ${scope}
     LIMIT 1;`);
  return rows[0] ?? null;
}

/**
 * Scores the given answers of one submitted assessment and returns how many
 * were set. Nothing is written once the assessment has been approved, so a
 * score can never drift away from the total that was worked out from it.
 */
export async function saveReviewScores(
  assessmentId: string,
  assessment: { field_id: string; program_id: string; author_role: AuthorRole },
  reviewerId: string,
  // A record id picks one filling of a form; none means the question's single answer.
  items: { questionId: string; recordId?: string | null; score: number }[]
): Promise<number> {
  if (!items.length) return 0;
  const values = Prisma.join(
    items.map(
      (item) =>
        Prisma.sql`(${item.questionId}::uuid, ${item.recordId ?? null}::uuid, ${item.score}::smallint)`
    )
  );
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    UPDATE assessment_responses ar
       SET review_score = v.score,
           reviewed_by = ${reviewerId}::uuid,
           reviewed_at = now(),
           updated_at = now()
      FROM (VALUES ${values}) AS v(question_id, record_id, score)
     WHERE ar.question_id = v.question_id
       AND (ar.record_id IS NOT DISTINCT FROM v.record_id
            -- No record named: the answer in the first record of the form, as the form screen shows it.
            OR (v.record_id IS NULL AND ar.record_id = (
                  SELECT r.id
                    FROM assessment_records r
                    JOIN assessment_questions q ON q.id = v.question_id
                   WHERE r.field_id = ar.field_id AND r.program_id = ar.program_id
                     AND r.author_role = ar.author_role AND r.category_id = q.category_id
                     AND r.deleted_at IS NULL
                   ORDER BY r.sort_order ASC, r.created_at ASC
                   LIMIT 1)))
       AND ar.field_id = ${assessment.field_id}::uuid
       AND ar.program_id = ${assessment.program_id}::uuid
       AND ar.author_role = ${assessment.author_role}
       AND ar.deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM field_assessments fa
                    WHERE fa.id = ${assessmentId}::uuid
                      AND fa.status = 'submitted'
                      AND fa.review_status = 'in_review')
    RETURNING ar.id;`);
  return rows.length;
}

export interface ApprovedAssessment {
  id: string;
  answered: number;
  total_score: number;
  max_score: number;
  percentage: string;
}

export interface CategoryLimit {
  id: string;
  name: string;
  max_score: number;
}

/** What every category of a program's assessment can score, for category scoring. */
export async function getCategoryScoreLimits(programId: string): Promise<CategoryLimit[]> {
  return prisma.$queryRaw<CategoryLimit[]>(Prisma.sql`
    SELECT ac.id, ac.name, COALESCE(SUM(aq.max_score), 0)::int AS max_score
      FROM assessment_categories ac
      JOIN assessment_questions aq
             ON aq.category_id = ac.id
            AND aq.deleted_at IS NULL
            AND aq.is_active = true
     WHERE ac.deleted_at IS NULL
       AND ac.is_active = true
       AND ac.template_id = (SELECT assessment_template_id FROM programs WHERE id = ${programId}::uuid)
     GROUP BY ac.id, ac.name;`);
}

export type ApproveResult =
  | { ok: true; assessment: ApprovedAssessment }
  | { ok: false; reason: "gone" | "unscored" }
  // The overall score was higher than everything the assessment asks for.
  | { ok: false; reason: "range"; max: number }
  // A category score was higher than that category can hold, or is not one of its categories.
  | { ok: false; reason: "category"; category: string; max: number };

/**
 * Totals the assessment from the score each answer now carries and marks it
 * approved, with the row held for the whole of it so two reviewers cannot
 * approve the same assessment twice.
 */
export async function approveAssessment(
  id: string,
  reviewerId: string,
  note: string | null,
  // Set when the reviewer scores the assessment as a whole instead of answer by answer.
  overallScore?: number,
  // Set when the reviewer scores it category by category instead.
  categoryScores?: { categoryId: string; score: number }[]
): Promise<ApproveResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      { field_id: string; program_id: string; author_role: string }[]
    >(Prisma.sql`
      SELECT field_id, program_id, author_role
        FROM field_assessments
       WHERE id = ${id}::uuid AND status = 'submitted' AND review_status = 'in_review'
       FOR UPDATE;`);
    const row = locked[0];
    if (!row) return { ok: false, reason: "gone" };

    const t = await getAnswerTotals(tx, row.field_id, row.program_id, row.author_role);

    // Scored as a whole: the score stands against everything the assessment asks,
    // not only the answers that carry one, so nothing has to be scored one by one.
    const whole = await tx.$queryRaw<{ max_score: number }[]>(Prisma.sql`
      SELECT COALESCE(SUM(aq.max_score), 0)::int AS max_score
        FROM assessment_questions aq
        JOIN assessment_categories ac ON ac.id = aq.category_id
       WHERE aq.deleted_at IS NULL AND aq.is_active = true
         AND ac.deleted_at IS NULL AND ac.is_active = true
         AND ac.template_id = (SELECT assessment_template_id FROM programs WHERE id = ${row.program_id}::uuid);`);
    const wholeMax = whole[0]?.max_score ?? 0;

    const byCategory = categoryScores?.length ? categoryScores : undefined;
    if (overallScore === undefined && !byCategory && t.unscored > 0) {
      return { ok: false, reason: "unscored" };
    }
    if (overallScore !== undefined && overallScore > wholeMax) {
      return { ok: false, reason: "range", max: wholeMax };
    }

    // Category by category: each score is held to what that category can score,
    // and the total still stands against the whole assessment.
    let categoryTotal = 0;
    if (byCategory) {
      const limits = await getCategoryScoreLimits(row.program_id);
      const limitById = new Map(limits.map((c) => [c.id, c]));
      for (const given of byCategory) {
        const limit = limitById.get(given.categoryId);
        if (!limit) return { ok: false, reason: "category", category: given.categoryId, max: 0 };
        if (given.score > limit.max_score) {
          return { ok: false, reason: "category", category: limit.name, max: limit.max_score };
        }
        categoryTotal += given.score;
      }
    }

    const totalScore = overallScore ?? (byCategory ? categoryTotal : t.total_score);
    const maxScore = overallScore === undefined && !byCategory ? t.max_score : wholeMax;
    const byAnswer = overallScore === undefined && !byCategory;
    const percentage = byAnswer
      ? t.exact_max > 0
        ? (t.exact_score / t.exact_max) * 100
        : 0
      : maxScore > 0
        ? (totalScore / maxScore) * 100
        : 0;
    const updated = await tx.$queryRaw<ApprovedAssessment[]>(Prisma.sql`
      UPDATE field_assessments
         SET review_status = 'approved',
             reviewed_by = ${reviewerId}::uuid,
             reviewed_at = now(),
             review_note = ${note}::text,
             answered = ${t.answered},
             total_score = ${totalScore},
             max_score = ${maxScore},
             percentage = ${percentage.toFixed(2)}::numeric,
             updated_at = now()
       WHERE id = ${id}::uuid
       RETURNING id, answered, total_score, max_score, percentage::text AS percentage;`);
    const assessment = updated[0];
    return assessment ? { ok: true, assessment } : { ok: false, reason: "gone" };
  });
}
