import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";

export interface AdminKpiRow {
  enrolled_acreage: number;
  farms_enrolled: number;
  farmers_enrolled: number;
  fields_enrolled: number;
  assessments_submitted: number;
  completion_pct: number | null;
  avg_rhi: number | null;
  total_programs: number;
}

export async function getAdminKpis(): Promise<AdminKpiRow> {
  const rows = await prisma.$queryRaw<AdminKpiRow[]>(Prisma.sql`
    WITH ef_pairs AS (
      SELECT DISTINCT pef.field_id, pe.program_id
        FROM program_enrollment_fields pef
        JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
       WHERE pef.deleted_at IS NULL
    ),
    enrolled_fields AS (
      SELECT DISTINCT field_id FROM ef_pairs
    ),
    ef AS (
      SELECT f.id AS field_id, f.farm_id, f.area_acres, fm.owner_id
        FROM enrolled_fields e
        JOIN fields f ON f.id = e.field_id AND f.deleted_at IS NULL
        JOIN farms fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL
    ),
    -- Assessable (field, program) slots: one possible farmer assessment each.
    slots AS (
      SELECT p.field_id, p.program_id
        FROM ef_pairs p
        JOIN ef ON ef.field_id = p.field_id
    ),
    submitted AS (
      SELECT fa.field_id, fa.program_id, fa.percentage
        FROM field_assessments fa
        JOIN slots s ON s.field_id = fa.field_id AND s.program_id = fa.program_id
       WHERE fa.author_role = 'farmer' AND fa.status = 'submitted'
    )
    SELECT
      COALESCE(SUM(ef.area_acres), 0)::float                          AS enrolled_acreage,
      COUNT(DISTINCT ef.farm_id)::int                                 AS farms_enrolled,
      COUNT(DISTINCT ef.owner_id)::int                                AS farmers_enrolled,
      COUNT(DISTINCT ef.field_id)::int                                AS fields_enrolled,
      (SELECT COUNT(*)::int FROM submitted)                           AS assessments_submitted,
      CASE WHEN (SELECT COUNT(*) FROM slots) > 0
           THEN ROUND(((SELECT COUNT(*) FROM submitted)::numeric
                        / (SELECT COUNT(*) FROM slots)) * 100, 1)
           ELSE NULL END                                              AS completion_pct,
      (SELECT ROUND(AVG(percentage), 1) FROM submitted)              AS avg_rhi,
      (SELECT COUNT(*)::int FROM programs
        WHERE deleted_at IS NULL AND is_active = true)                AS total_programs
    FROM ef;`);
  return (
    rows[0] ?? {
      enrolled_acreage: 0,
      farms_enrolled: 0,
      farmers_enrolled: 0,
      fields_enrolled: 0,
      assessments_submitted: 0,
      completion_pct: null,
      avg_rhi: null,
      total_programs: 0,
    }
  );
}

export interface MonthAcreageRow {
  month: string;
  acres: number;
}

export async function getAcreageOverTime(
  months: number,
  ownerId?: string | null
): Promise<MonthAcreageRow[]> {
  const mine = ownerId
    ? Prisma.sql`AND p.created_by = ${ownerId}::uuid`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<
    { month: string; acres: number }[]
  >(Prisma.sql`
    WITH bounds AS (
      SELECT date_trunc('month', org_now())
             - (${months - 1}::int * interval '1 month') AS start_month
    ),
    series AS (
      SELECT gs AS month_start
        FROM bounds,
             generate_series(bounds.start_month,
                             date_trunc('month', org_now()),
                             interval '1 month') AS gs
    ),
    -- Each enrolled field's area attributed to the month it was enrolled.
    enrolled AS (
      SELECT DISTINCT ON (pef.field_id)
             pef.field_id,
             f.area_acres,
             date_trunc('month', org_local(pe.enrolled_at)) AS enrolled_month
        FROM program_enrollment_fields pef
        JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
        JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL ${mine}
        JOIN fields f ON f.id = pef.field_id AND f.deleted_at IS NULL
       WHERE pef.deleted_at IS NULL
       ORDER BY pef.field_id, pe.enrolled_at ASC
    )
    SELECT to_char(s.month_start, 'Mon') AS month,
           COALESCE(SUM(e.area_acres) FILTER (
             WHERE e.enrolled_month <= s.month_start
           ), 0)::float                  AS acres
      FROM series s
      LEFT JOIN enrolled e ON true
     GROUP BY s.month_start
     ORDER BY s.month_start ASC;`);
  return rows.map((r) => ({ month: r.month, acres: Math.round(r.acres) }));
}

export interface ProgramSplitRow {
  name: string;
  acres: number;
}

export async function getProgramSplit(
  limit: number,
  ownerId?: string | null
): Promise<ProgramSplitRow[]> {
  const mine = ownerId
    ? Prisma.sql`AND p.created_by = ${ownerId}::uuid`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<{ name: string; acres: number }[]>(Prisma.sql`
    SELECT p.name AS name,
           COALESCE(SUM(f.area_acres), 0)::float AS acres
      FROM programs p
      JOIN program_enrollments pe ON pe.program_id = p.id AND pe.deleted_at IS NULL
      JOIN program_enrollment_fields pef ON pef.enrollment_id = pe.id AND pef.deleted_at IS NULL
      JOIN fields f ON f.id = pef.field_id AND f.deleted_at IS NULL
     WHERE p.deleted_at IS NULL ${mine}
     GROUP BY p.id, p.name
     HAVING SUM(f.area_acres) > 0
     ORDER BY acres DESC;`);
  const top = rows.slice(0, limit).map((r) => ({
    name: r.name,
    acres: Math.round(r.acres),
  }));
  const restAcres = rows
    .slice(limit)
    .reduce((s, r) => s + r.acres, 0);
  if (restAcres > 0) top.push({ name: "Other", acres: Math.round(restAcres) });
  return top;
}

export interface AssessmentTrendRow {
  month: string;
  submitted: number;
  score: number | null;
}

export async function getAssessmentTrends(
  months: number,
  ownerId?: string | null
): Promise<AssessmentTrendRow[]> {
  const mine = ownerId
    ? Prisma.sql`AND p.created_by = ${ownerId}::uuid`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<
    { month: string; submitted: number; score: number | null }[]
  >(Prisma.sql`
    WITH bounds AS (
      SELECT date_trunc('month', org_now())
             - (${months - 1}::int * interval '1 month') AS start_month
    ),
    series AS (
      SELECT gs AS month_start
        FROM bounds,
             generate_series(bounds.start_month,
                             date_trunc('month', org_now()),
                             interval '1 month') AS gs
    ),
    subs AS (
      SELECT date_trunc('month', org_local(fa.submitted_at)) AS m,
             fa.percentage
        FROM field_assessments fa
        JOIN programs p ON p.id = fa.program_id AND p.deleted_at IS NULL ${mine}
       WHERE fa.author_role = 'farmer'
         AND fa.status = 'submitted'
         AND fa.submitted_at IS NOT NULL
    )
    SELECT to_char(s.month_start, 'Mon')              AS month,
           COUNT(subs.percentage)::int               AS submitted,
           CASE WHEN COUNT(subs.percentage) > 0
                THEN ROUND(AVG(subs.percentage), 1)
                ELSE NULL END                         AS score
      FROM series s
      LEFT JOIN subs ON subs.m = s.month_start
     GROUP BY s.month_start
     ORDER BY s.month_start ASC;`);
  return rows.map((r) => ({
    month: r.month,
    submitted: r.submitted,
    score: r.score === null ? null : Number(r.score),
  }));
}

export interface RhiByProgramRow {
  program: string;
  rhi: number;
}

export async function getRhiByProgram(limit: number): Promise<RhiByProgramRow[]> {
  const rows = await prisma.$queryRaw<{ program: string; rhi: number }[]>(Prisma.sql`
    SELECT p.name AS program,
           ROUND(AVG(fa.percentage), 1)::float AS rhi
      FROM programs p
      JOIN program_enrollments pe ON pe.program_id = p.id AND pe.deleted_at IS NULL
      JOIN program_enrollment_fields pef ON pef.enrollment_id = pe.id AND pef.deleted_at IS NULL
      JOIN field_assessments fa
             ON fa.field_id = pef.field_id
            AND fa.program_id = p.id
            AND fa.author_role = 'farmer'
            AND fa.status = 'submitted'
     WHERE p.deleted_at IS NULL
     GROUP BY p.id, p.name
     ORDER BY rhi DESC
     LIMIT ${limit};`);
  return rows.map((r) => ({ program: r.program, rhi: Math.round(r.rhi) }));
}

export interface ProgramKpiRow {
  total_programs: number;
  enrolled_farmers: number;
  fields_enrolled: number;
  assessment_submissions: number;
  farmers_with_assessor: number;
  farmers_fully_assessed: number;
}

/**
 * The headline numbers for the Programs section of the dashboard. Passing an
 * owner limits every count to the programs that person runs, which is what a
 * program administrator sees.
 */
export async function getProgramKpis(
  ownerId?: string | null
): Promise<ProgramKpiRow> {
  const mine = ownerId
    ? Prisma.sql`AND p.created_by = ${ownerId}::uuid`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<ProgramKpiRow[]>(Prisma.sql`
    WITH scoped AS (
      SELECT p.id
        FROM programs p
       WHERE p.deleted_at IS NULL ${mine}
    ),
    enrollments AS (
      SELECT pe.id, pe.program_id, pe.farmer_id
        FROM program_enrollments pe
        JOIN scoped s ON s.id = pe.program_id
       WHERE pe.deleted_at IS NULL
    ),
    enrolled_fields AS (
      SELECT DISTINCT pef.field_id, e.program_id
        FROM program_enrollment_fields pef
        JOIN enrollments e ON e.id = pef.enrollment_id
       WHERE pef.deleted_at IS NULL
    ),
    submissions AS (
      SELECT fa.field_id, fa.program_id, fa.author_role
        FROM field_assessments fa
        JOIN scoped s ON s.id = fa.program_id
       WHERE fa.status = 'submitted'
    ),
    -- A field assessed from both sides, and the farmer who owns it.
    both_sides AS (
      SELECT DISTINCT fm.owner_id AS farmer_id
        FROM submissions a
        JOIN submissions b
          ON b.field_id = a.field_id
         AND b.program_id = a.program_id
         AND b.author_role = 'assessor'
        JOIN fields f ON f.id = a.field_id AND f.deleted_at IS NULL
        JOIN farms fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL
       WHERE a.author_role = 'farmer'
    )
    SELECT
      (SELECT COUNT(*)::int FROM scoped)                       AS total_programs,
      (SELECT COUNT(DISTINCT farmer_id)::int FROM enrollments)  AS enrolled_farmers,
      (SELECT COUNT(DISTINCT field_id)::int FROM enrolled_fields)
                                                               AS fields_enrolled,
      (SELECT COUNT(*)::int FROM submissions)                  AS assessment_submissions,
      (SELECT COUNT(DISTINCT e.farmer_id)::int
         FROM enrollments e
         JOIN assessor_assignments aa
           ON aa.farmer_id = e.farmer_id AND aa.deleted_at IS NULL)
                                                               AS farmers_with_assessor,
      (SELECT COUNT(*)::int FROM both_sides)                   AS farmers_fully_assessed;
  `);

  return (
    rows[0] ?? {
      total_programs: 0,
      enrolled_farmers: 0,
      fields_enrolled: 0,
      assessment_submissions: 0,
      farmers_with_assessor: 0,
      farmers_fully_assessed: 0,
    }
  );
}
