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
    WITH enrolled_fields AS (
      SELECT DISTINCT pef.field_id
        FROM program_enrollment_fields pef
        JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
       WHERE pef.deleted_at IS NULL
    ),
    ef AS (
      SELECT f.id AS field_id, f.farm_id, f.area_acres, fm.owner_id
        FROM enrolled_fields e
        JOIN fields f ON f.id = e.field_id AND f.deleted_at IS NULL
        JOIN farms fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL
    ),
    submitted AS (
      SELECT fa.field_id, fa.percentage
        FROM field_assessments fa
        JOIN ef ON ef.field_id = fa.field_id
       WHERE fa.author_role = 'farmer' AND fa.status = 'submitted'
    )
    SELECT
      COALESCE(SUM(ef.area_acres), 0)::float                          AS enrolled_acreage,
      COUNT(DISTINCT ef.farm_id)::int                                 AS farms_enrolled,
      COUNT(DISTINCT ef.owner_id)::int                                AS farmers_enrolled,
      COUNT(DISTINCT ef.field_id)::int                                AS fields_enrolled,
      (SELECT COUNT(*)::int FROM submitted)                           AS assessments_submitted,
      CASE WHEN COUNT(DISTINCT ef.field_id) > 0
           THEN ROUND(((SELECT COUNT(*) FROM submitted)::numeric
                        / COUNT(DISTINCT ef.field_id)) * 100, 1)
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
  months: number
): Promise<MonthAcreageRow[]> {
  const rows = await prisma.$queryRaw<
    { month: string; acres: number }[]
  >(Prisma.sql`
    WITH bounds AS (
      SELECT date_trunc('month', now())
             - (${months - 1}::int * interval '1 month') AS start_month
    ),
    series AS (
      SELECT gs AS month_start
        FROM bounds,
             generate_series(bounds.start_month,
                             date_trunc('month', now()),
                             interval '1 month') AS gs
    ),
    -- Each enrolled field's area attributed to the month it was enrolled.
    enrolled AS (
      SELECT DISTINCT ON (pef.field_id)
             pef.field_id,
             f.area_acres,
             date_trunc('month', pe.enrolled_at) AS enrolled_month
        FROM program_enrollment_fields pef
        JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
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

export async function getProgramSplit(limit: number): Promise<ProgramSplitRow[]> {
  const rows = await prisma.$queryRaw<{ name: string; acres: number }[]>(Prisma.sql`
    SELECT p.name AS name,
           COALESCE(SUM(f.area_acres), 0)::float AS acres
      FROM programs p
      JOIN program_enrollments pe ON pe.program_id = p.id AND pe.deleted_at IS NULL
      JOIN program_enrollment_fields pef ON pef.enrollment_id = pe.id AND pef.deleted_at IS NULL
      JOIN fields f ON f.id = pef.field_id AND f.deleted_at IS NULL
     WHERE p.deleted_at IS NULL
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
  months: number
): Promise<AssessmentTrendRow[]> {
  const rows = await prisma.$queryRaw<
    { month: string; submitted: number; score: number | null }[]
  >(Prisma.sql`
    WITH bounds AS (
      SELECT date_trunc('month', now())
             - (${months - 1}::int * interval '1 month') AS start_month
    ),
    series AS (
      SELECT gs AS month_start
        FROM bounds,
             generate_series(bounds.start_month,
                             date_trunc('month', now()),
                             interval '1 month') AS gs
    ),
    subs AS (
      SELECT date_trunc('month', fa.submitted_at) AS m,
             fa.percentage
        FROM field_assessments fa
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
            AND fa.author_role = 'farmer'
            AND fa.status = 'submitted'
     WHERE p.deleted_at IS NULL
     GROUP BY p.id, p.name
     ORDER BY rhi DESC
     LIMIT ${limit};`);
  return rows.map((r) => ({ program: r.program, rhi: Math.round(r.rhi) }));
}
