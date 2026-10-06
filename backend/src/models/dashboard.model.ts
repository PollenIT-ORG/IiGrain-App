import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";

export interface DashboardFarm {
  id: string;
  name: string;
  field_count: number;
}

export interface DashboardFarmsFilters {
  farmerId: string;
  search?: string;
  limit: number;
  offset: number;
}

export async function listDashboardFarms(
  filters: DashboardFarmsFilters
): Promise<{ rows: DashboardFarm[]; total: number }> {
  const search = filters.search?.trim();
  const searchSql = search
    ? Prisma.sql`AND fm.name ILIKE ${"%" + search + "%"}`
    : Prisma.empty;

  // field_count is the total number of fields on the farm (all non-deleted
  // fields), not just the ones enrolled in a program.
  const rows = await prisma.$queryRaw<DashboardFarm[]>(Prisma.sql`
    SELECT fm.id,
           fm.name,
           COALESCE(cnt.c, 0)::int AS field_count
      FROM farms fm
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS c
          FROM fields f
         WHERE f.farm_id = fm.id AND f.deleted_at IS NULL
      ) cnt ON true
     WHERE fm.deleted_at IS NULL AND fm.owner_id = ${filters.farmerId}::uuid
       ${searchSql}
     ORDER BY fm.created_at DESC
     LIMIT ${filters.limit} OFFSET ${filters.offset};`);

  const countRows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
      FROM farms fm
     WHERE fm.deleted_at IS NULL AND fm.owner_id = ${filters.farmerId}::uuid
       ${searchSql};`);

  return { rows, total: Number(countRows[0]?.count ?? 0) };
}

// The dashboard's default selected farm stays stable regardless of paging or
// search: the farmer's most recently created farm.
export async function getDefaultDashboardFarmId(
  farmerId: string
): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM farms
     WHERE deleted_at IS NULL AND owner_id = ${farmerId}::uuid
     ORDER BY created_at DESC
     LIMIT 1;`);
  return rows[0]?.id ?? null;
}

export async function findOwnedFarm(
  farmId: string,
  farmerId: string
): Promise<{ id: string; name: string } | null> {
  const f = await prisma.farms.findFirst({
    where: { id: farmId, deleted_at: null, owner_id: farmerId },
    select: { id: true, name: true },
  });
  return f;
}

export interface CategoryScoreRow {
  id: string;
  name: string;
  sort_order: number;
  answered: number;
  total_score: number;
  max_score: number;
  percentage: number | null;
}

export async function getFarmCategoryScores(
  farmId: string,
  farmerId: string
): Promise<CategoryScoreRow[]> {
  return prisma.$queryRaw<CategoryScoreRow[]>(Prisma.sql`
    WITH enrolled_fields AS (
      SELECT DISTINCT pef.field_id
        FROM program_enrollment_fields pef
        JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
        JOIN fields f ON f.id = pef.field_id AND f.deleted_at IS NULL AND f.farm_id = ${farmId}::uuid
       WHERE pef.deleted_at IS NULL AND pe.farmer_id = ${farmerId}::uuid
    )
    -- Categories follow the Global template; answers from any template count toward the category with the same name.
    SELECT gc.id,
           gc.name,
           gc.sort_order,
           COUNT(ar.id)::int                          AS answered,
           COALESCE(SUM(COALESCE(ar.review_score, ar.score)), 0)::int AS total_score,
           COALESCE(SUM(aq.max_score) FILTER (WHERE COALESCE(ar.review_score, ar.score) IS NOT NULL), 0)::int AS max_score,
           CASE WHEN COUNT(ar.id) FILTER (WHERE COALESCE(ar.review_score, ar.score) IS NOT NULL) > 0
                THEN ROUND((COALESCE(SUM(COALESCE(ar.review_score, ar.score)), 0)::numeric
                             / NULLIF(SUM(aq.max_score) FILTER (WHERE COALESCE(ar.review_score, ar.score) IS NOT NULL), 0)) * 100, 2)
                ELSE NULL END                         AS percentage
      FROM assessment_categories gc
      JOIN assessment_templates gt
             ON gt.id = gc.template_id AND gt.is_global = true AND gt.deleted_at IS NULL
      JOIN assessment_categories ac
             ON LOWER(ac.name) = LOWER(gc.name)
            AND ac.deleted_at IS NULL AND ac.is_active = true
      JOIN assessment_questions aq
             ON aq.category_id = ac.id
            AND aq.deleted_at IS NULL AND aq.is_active = true
      LEFT JOIN assessment_responses ar
             ON ar.question_id = aq.id
            AND ar.deleted_at IS NULL
            AND ar.author_role = 'farmer'
            AND ar.field_id IN (SELECT field_id FROM enrolled_fields)
     WHERE gc.deleted_at IS NULL AND gc.is_active = true
     GROUP BY gc.id, gc.name, gc.sort_order, gc.created_at
     HAVING COUNT(aq.id) > 0
        -- The input based Global template's forms show only once something was answered in them.
        AND (COUNT(ar.id) > 0 OR MAX(COALESCE(gt.question_kind, 'mcq')) = 'mcq')
     ORDER BY gc.sort_order ASC, gc.created_at ASC;`);
}

// Earliest year the farm dashboard may be viewed for. Never before the farmer
// registered; otherwise the first year they enrolled a field or submitted an
// assessment, falling back to the year the farm was created.
export async function getFarmStartYear(
  farmId: string,
  farmerId: string
): Promise<number> {
  const rows = await prisma.$queryRaw<{ start_year: number }[]>(Prisma.sql`
    SELECT GREATEST(
             EXTRACT(YEAR FROM u.created_at)::int,
             COALESCE(
               LEAST(
                 (SELECT MIN(EXTRACT(YEAR FROM pe.enrolled_at))::int
                    FROM program_enrollments pe
                    JOIN program_enrollment_fields pef
                           ON pef.enrollment_id = pe.id AND pef.deleted_at IS NULL
                    JOIN fields ef ON ef.id = pef.field_id
                           AND ef.deleted_at IS NULL AND ef.farm_id = fm.id
                   WHERE pe.deleted_at IS NULL AND pe.farmer_id = ${farmerId}::uuid),
                 (SELECT MIN(EXTRACT(YEAR FROM fa.submitted_at))::int
                    FROM field_assessments fa
                    JOIN fields af ON af.id = fa.field_id
                           AND af.deleted_at IS NULL AND af.farm_id = fm.id
                   WHERE fa.author_role = 'farmer' AND fa.status = 'submitted' AND fa.review_status = 'approved'
                     AND fa.submitted_at IS NOT NULL)
               ),
               EXTRACT(YEAR FROM fm.created_at)::int
             )
           )::int AS start_year
      FROM farms fm
      JOIN users u ON u.id = fm.owner_id
     WHERE fm.id = ${farmId}::uuid AND fm.deleted_at IS NULL;`);
  return rows[0]?.start_year ?? new Date().getFullYear();
}

export interface RhiTrendRow {
  year: number;
  score: number;
}

// One Regen Health Index point per year: the average of that year's submitted
// farmer assessments for this farm.
export async function getFarmRhiTrend(
  farmId: string,
  farmerId: string
): Promise<RhiTrendRow[]> {
  return prisma.$queryRaw<RhiTrendRow[]>(Prisma.sql`
    SELECT EXTRACT(YEAR FROM fa.submitted_at)::int AS year,
           ROUND(AVG(fa.percentage))::int          AS score
      FROM field_assessments fa
      JOIN fields f ON f.id = fa.field_id AND f.deleted_at IS NULL
             AND f.farm_id = ${farmId}::uuid
      JOIN farms fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL
             AND fm.owner_id = ${farmerId}::uuid
     WHERE fa.author_role = 'farmer' AND fa.status = 'submitted' AND fa.review_status = 'approved'
       AND fa.submitted_at IS NOT NULL
     GROUP BY 1
     ORDER BY 1 ASC;`);
}

// Category scores for ONE year: for each category, the average of that category's
// score across every assessment submitted in that year (each assessment counts
// once). Categories with no data that year come back with percentage = null.
export async function getFarmCategoryScoresByYear(
  farmId: string,
  farmerId: string,
  year: number
): Promise<CategoryScoreRow[]> {
  return prisma.$queryRaw<CategoryScoreRow[]>(Prisma.sql`
    WITH per_assessment AS (
      SELECT fa.id                       AS assessment_id,
             LOWER(ac.name)              AS category_key,
             COUNT(DISTINCT ar.question_id)::int AS answered,
             SUM(COALESCE(ar.review_score, ar.score))::int AS total_score,
             SUM(aq.max_score)::int      AS max_score
        FROM field_assessments fa
        JOIN fields f ON f.id = fa.field_id AND f.deleted_at IS NULL
               AND f.farm_id = ${farmId}::uuid
        JOIN farms fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL
               AND fm.owner_id = ${farmerId}::uuid
        JOIN assessment_responses ar
               ON ar.field_id = fa.field_id
              AND ar.program_id = fa.program_id
              AND ar.author_role = fa.author_role
              AND ar.deleted_at IS NULL
        JOIN assessment_questions aq ON aq.id = ar.question_id
               AND aq.deleted_at IS NULL AND aq.is_active = true
        JOIN assessment_categories ac ON ac.id = aq.category_id
               AND ac.deleted_at IS NULL AND ac.is_active = true
       WHERE fa.author_role = 'farmer' AND fa.status = 'submitted' AND fa.review_status = 'approved'
         AND fa.submitted_at IS NOT NULL
         AND EXTRACT(YEAR FROM fa.submitted_at)::int = ${year}
       GROUP BY fa.id, LOWER(ac.name)
    )
    -- Categories follow the Global template; each assessment counts toward the category with the same name.
    SELECT gc.id,
           gc.name,
           gc.sort_order,
           COALESCE(SUM(pa.answered), 0)::int    AS answered,
           COALESCE(SUM(pa.total_score), 0)::int AS total_score,
           COALESCE(SUM(pa.max_score), 0)::int   AS max_score,
           CASE WHEN COUNT(pa.assessment_id) > 0
                THEN ROUND(AVG(pa.total_score::numeric
                               / NULLIF(pa.max_score, 0) * 100), 2)
                ELSE NULL END                     AS percentage
      FROM assessment_categories gc
      JOIN assessment_templates gt
             ON gt.id = gc.template_id AND gt.is_global = true AND gt.deleted_at IS NULL
      LEFT JOIN per_assessment pa ON pa.category_key = LOWER(gc.name)
     WHERE gc.deleted_at IS NULL AND gc.is_active = true
     GROUP BY gc.id, gc.name, gc.sort_order
     ORDER BY gc.sort_order ASC, gc.name ASC;`);
}

export interface FarmSummaryRow {
  assessments_completed: number;
  average_score: number | null;
}

export async function getFarmSummaryByYear(
  farmId: string,
  farmerId: string,
  year: number
): Promise<FarmSummaryRow> {
  const rows = await prisma.$queryRaw<FarmSummaryRow[]>(Prisma.sql`
    SELECT COUNT(*)::int                  AS assessments_completed,
           ROUND(AVG(fa.percentage), 2)   AS average_score
      FROM field_assessments fa
      JOIN fields f ON f.id = fa.field_id AND f.deleted_at IS NULL
             AND f.farm_id = ${farmId}::uuid
      JOIN farms fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL
             AND fm.owner_id = ${farmerId}::uuid
     WHERE fa.author_role = 'farmer' AND fa.status = 'submitted' AND fa.review_status = 'approved'
       AND fa.submitted_at IS NOT NULL
       AND EXTRACT(YEAR FROM fa.submitted_at)::int = ${year};`);
  return rows[0] ?? { assessments_completed: 0, average_score: null };
}

export async function getFarmSummary(
  farmId: string,
  farmerId: string
): Promise<FarmSummaryRow> {
  const rows = await prisma.$queryRaw<FarmSummaryRow[]>(Prisma.sql`
    WITH enrolled_fields AS (
      SELECT DISTINCT pef.field_id
        FROM program_enrollment_fields pef
        JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
        JOIN fields f ON f.id = pef.field_id AND f.deleted_at IS NULL AND f.farm_id = ${farmId}::uuid
       WHERE pef.deleted_at IS NULL AND pe.farmer_id = ${farmerId}::uuid
    )
    SELECT COUNT(*)::int                       AS assessments_completed,
           ROUND(AVG(fa.percentage), 2)        AS average_score
      FROM field_assessments fa
     WHERE fa.author_role = 'farmer'
       AND fa.status = 'submitted' AND fa.review_status = 'approved'
       AND fa.field_id IN (SELECT field_id FROM enrolled_fields);`);
  return rows[0] ?? { assessments_completed: 0, average_score: null };
}

export interface ActivityRow {
  type: string;
  title: string;
  detail: string | null;
  at: Date;
  field_id: string | null;
  field_name: string | null;
}

export async function getFarmRecentActivity(
  farmId: string,
  farmerId: string,
  limit: number
): Promise<ActivityRow[]> {
  return prisma.$queryRaw<ActivityRow[]>(Prisma.sql`
    WITH enrolled_fields AS (
      SELECT DISTINCT pef.field_id
        FROM program_enrollment_fields pef
        JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
        JOIN fields f ON f.id = pef.field_id AND f.deleted_at IS NULL AND f.farm_id = ${farmId}::uuid
       WHERE pef.deleted_at IS NULL AND pe.farmer_id = ${farmerId}::uuid
    ),
    -- 1. Submitted self-assessments.
    ev_submitted AS (
      SELECT 'assessment_submitted'            AS type,
             'Self assessment completed'       AS title,
             (fa.answered || '/' || fa.total_questions || ' answered · ' || fa.percentage || '%') AS detail,
             fa.submitted_at                   AS at,
             f.id                              AS field_id,
             f.name                            AS field_name
        FROM field_assessments fa
        JOIN fields f ON f.id = fa.field_id
       WHERE fa.author_role = 'farmer'
         AND fa.status = 'submitted' AND fa.review_status = 'approved'
         AND fa.submitted_at IS NOT NULL
         AND fa.field_id IN (SELECT field_id FROM enrolled_fields)
    ),
    -- 2. First answer saved on a field = assessment started (only if the field
    --    has not been submitted in any program yet, so a completed field's story
    --    is not duplicated).
    ev_started AS (
      SELECT 'assessment_started'              AS type,
             'Assessment started'              AS title,
             NULL::text                        AS detail,
             MIN(ar.created_at)                AS at,
             f.id                              AS field_id,
             f.name                            AS field_name
        FROM assessment_responses ar
        JOIN fields f ON f.id = ar.field_id
       WHERE ar.author_role = 'farmer'
         AND ar.deleted_at IS NULL
         AND ar.field_id IN (SELECT field_id FROM enrolled_fields)
         AND NOT EXISTS (
           SELECT 1 FROM field_assessments fa
            WHERE fa.field_id = ar.field_id
              AND fa.author_role = 'farmer'
              AND fa.status = 'submitted' AND fa.review_status = 'approved'
         )
       GROUP BY f.id, f.name
    ),
    -- 3. Enrollment events (per enrollment; label the enrolled program).
    ev_enrolled AS (
      SELECT 'enrolled_in_program'             AS type,
             'Enrolled in ' || p.name          AS title,
             NULL::text                        AS detail,
             pe.enrolled_at                    AS at,
             NULL::uuid                        AS field_id,
             p.name                            AS field_name
        FROM program_enrollments pe
        JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
       WHERE pe.deleted_at IS NULL
         AND pe.farmer_id = ${farmerId}::uuid
         AND EXISTS (
           SELECT 1 FROM program_enrollment_fields pef
             JOIN fields f ON f.id = pef.field_id AND f.farm_id = ${farmId}::uuid AND f.deleted_at IS NULL
            WHERE pef.enrollment_id = pe.id AND pef.deleted_at IS NULL
         )
    )
    SELECT * FROM (
      SELECT * FROM ev_submitted
      UNION ALL SELECT * FROM ev_started
      UNION ALL SELECT * FROM ev_enrolled
    ) feed
     WHERE feed.at IS NOT NULL
     ORDER BY feed.at DESC
     LIMIT ${limit};`);
}

export interface UpcomingProgramRow {
  program_id: string;
  program_name: string;
  start_date: string;
  end_date: string | null;
  already_enrolled: boolean;
}

export async function getFarmUpcomingPrograms(
  farmId: string,
  farmerId: string
): Promise<UpcomingProgramRow[]> {
  return prisma.$queryRaw<UpcomingProgramRow[]>(Prisma.sql`
    SELECT p.id                                  AS program_id,
           p.name                                AS program_name,
           to_char(p.start_date, 'YYYY-MM-DD')   AS start_date,
           to_char(p.end_date, 'YYYY-MM-DD')     AS end_date,
           EXISTS (
             SELECT 1 FROM program_enrollments pe
              WHERE pe.program_id = p.id AND pe.farmer_id = ${farmerId}::uuid
                AND pe.deleted_at IS NULL
           )                                     AS already_enrolled
      FROM programs p
     WHERE p.deleted_at IS NULL
       AND p.is_active = true
       AND p.start_date IS NOT NULL
       AND p.start_date > org_today()
       AND p.org_id IN (
         SELECT fm.org_id FROM farms fm
          WHERE fm.id = ${farmId}::uuid AND fm.deleted_at IS NULL AND fm.org_id IS NOT NULL
       )
     ORDER BY p.start_date ASC, p.created_at DESC;`);
}

// ------------------------------ Program dashboard ------------------------------

export type DashboardProgramStatus = "active" | "scheduled" | "ended" | "inactive";

export interface DashboardProgramRow {
  id: string;
  name: string;
  code: string | null;
  start_date: Date | null;
  end_date: Date | null;
  status: DashboardProgramStatus;
  fields_enrolled: number;
  assessments_completed: number;
}

// The farmer's live enrolled fields per program, and whether the farmer has submitted each one.
const MY_PROGRAM_FIELDS = (farmerId: string) => Prisma.sql`
  SELECT DISTINCT pe.program_id,
         pef.field_id,
         EXISTS (
           SELECT 1 FROM field_assessments fa
            WHERE fa.field_id = pef.field_id AND fa.program_id = pe.program_id
              AND fa.author_role = 'farmer' AND fa.status = 'submitted' AND fa.review_status = 'approved'
         ) AS submitted
    FROM program_enrollments pe
    JOIN program_enrollment_fields pef ON pef.enrollment_id = pe.id AND pef.deleted_at IS NULL
    JOIN fields f ON f.id = pef.field_id AND f.deleted_at IS NULL
   WHERE pe.farmer_id = ${farmerId}::uuid AND pe.deleted_at IS NULL`;

// Same reading as the program badge: switched off wins, then past its end, then not yet started.
const PROGRAM_STATUS = Prisma.sql`
  CASE WHEN NOT p.is_active THEN 'inactive'
       WHEN p.end_date IS NOT NULL AND p.end_date < org_today() THEN 'ended'
       WHEN p.start_date IS NOT NULL AND p.start_date > org_today() THEN 'scheduled'
       ELSE 'active' END`;

const PROGRAM_ORDER = Prisma.sql`
  CASE status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
  start_date DESC NULLS LAST, name ASC, id ASC`;

export interface DashboardProgramsFilters {
  farmerId: string;
  search?: string;
  limit: number;
  offset: number;
}

// The farmer's programs with their numbers, as the CTE `listed` the list, the count and the default all read from.
function listedPrograms(farmerId: string, search?: string): Prisma.Sql {
  const term = search?.trim();
  const searchSql = term
    ? Prisma.sql`AND (p.name ILIKE ${"%" + term + "%"} OR p.code ILIKE ${"%" + term + "%"})`
    : Prisma.empty;
  return Prisma.sql`
    WITH mine AS (${MY_PROGRAM_FIELDS(farmerId)}),
    stats AS (
      SELECT program_id,
             COUNT(*)::int                          AS fields_enrolled,
             COUNT(*) FILTER (WHERE submitted)::int AS assessments_completed
        FROM mine
       GROUP BY program_id
    ),
    listed AS (
      SELECT p.id, p.name, p.code, p.start_date, p.end_date,
             ${PROGRAM_STATUS} AS status,
             s.fields_enrolled, s.assessments_completed
        FROM stats s
        JOIN programs p ON p.id = s.program_id AND p.deleted_at IS NULL
       WHERE true ${searchSql}
    )`;
}

/** Programs the farmer has at least one live enrolled field in, running ones first. */
export async function listDashboardPrograms(
  filters: DashboardProgramsFilters
): Promise<{ rows: DashboardProgramRow[]; total: number }> {
  const base = listedPrograms(filters.farmerId, filters.search);
  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<DashboardProgramRow[]>(Prisma.sql`
      ${base}
      SELECT * FROM listed
       ORDER BY ${PROGRAM_ORDER}
       LIMIT ${filters.limit} OFFSET ${filters.offset};`),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      ${base}
      SELECT COUNT(*)::bigint AS count FROM listed;`),
  ]);
  return { rows, total: Number(countRows[0]?.count ?? 0) };
}

/** The program the dashboard opens on, whatever the paging or search: the first in list order. */
export async function getDefaultDashboardProgramId(farmerId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    ${listedPrograms(farmerId)}
    SELECT id FROM listed
     ORDER BY ${PROGRAM_ORDER}
     LIMIT 1;`);
  return rows[0]?.id ?? null;
}

/** One program the farmer takes part in, with the numbers for its enrolled fields; null when they have no field in it. */
export async function findDashboardProgram(
  programId: string,
  farmerId: string
): Promise<DashboardProgramRow | null> {
  const rows = await prisma.$queryRaw<DashboardProgramRow[]>(Prisma.sql`
    WITH mine AS (${MY_PROGRAM_FIELDS(farmerId)})
    SELECT p.id, p.name, p.code, p.start_date, p.end_date,
           ${PROGRAM_STATUS} AS status,
           COUNT(*)::int                          AS fields_enrolled,
           COUNT(*) FILTER (WHERE m.submitted)::int AS assessments_completed
      FROM mine m
      JOIN programs p ON p.id = m.program_id AND p.deleted_at IS NULL
     WHERE m.program_id = ${programId}::uuid
     GROUP BY p.id;`);
  return rows[0] ?? null;
}

// The farmer's submitted assessments in this program, on fields they own.
const MY_PROGRAM_ASSESSMENTS = (programId: string, farmerId: string) => Prisma.sql`
  SELECT fa.id, fa.field_id, fa.program_id, fa.author_role, fa.percentage, fa.submitted_at
    FROM field_assessments fa
    JOIN fields f ON f.id = fa.field_id AND f.deleted_at IS NULL
    JOIN farms fm ON fm.id = f.farm_id AND fm.deleted_at IS NULL AND fm.owner_id = ${farmerId}::uuid
   WHERE fa.program_id = ${programId}::uuid
     AND fa.author_role = 'farmer' AND fa.status = 'submitted' AND fa.review_status = 'approved' AND fa.submitted_at IS NOT NULL`;

// First viewable year: not before the farmer registered, else their first enrollment or submission in the program, else the program's year.
export async function getProgramStartYear(programId: string, farmerId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ start_year: number }[]>(Prisma.sql`
    SELECT GREATEST(
             EXTRACT(YEAR FROM u.created_at)::int,
             COALESCE(
               LEAST(
                 (SELECT MIN(EXTRACT(YEAR FROM pe.enrolled_at))::int
                    FROM program_enrollments pe
                   WHERE pe.program_id = p.id AND pe.farmer_id = u.id AND pe.deleted_at IS NULL),
                 (SELECT MIN(EXTRACT(YEAR FROM a.submitted_at))::int
                    FROM (${MY_PROGRAM_ASSESSMENTS(programId, farmerId)}) a)
               ),
               EXTRACT(YEAR FROM p.created_at)::int
             )
           )::int AS start_year
      FROM programs p
      JOIN users u ON u.id = ${farmerId}::uuid
     WHERE p.id = ${programId}::uuid;`);
  return rows[0]?.start_year ?? new Date().getFullYear();
}

/** One Regen Health Index point per year: the average of that year's submitted farmer assessments in the program. */
export async function getProgramRhiTrend(programId: string, farmerId: string): Promise<RhiTrendRow[]> {
  return prisma.$queryRaw<RhiTrendRow[]>(Prisma.sql`
    SELECT EXTRACT(YEAR FROM a.submitted_at)::int AS year,
           ROUND(AVG(a.percentage))::int          AS score
      FROM (${MY_PROGRAM_ASSESSMENTS(programId, farmerId)}) a
     GROUP BY 1
     ORDER BY 1 ASC;`);
}

// Category scores for one year from the program's own categories, each assessment counting once.
export async function getProgramCategoryScoresByYear(
  programId: string,
  farmerId: string,
  year: number
): Promise<CategoryScoreRow[]> {
  return prisma.$queryRaw<CategoryScoreRow[]>(Prisma.sql`
    WITH per_assessment AS (
      SELECT a.id                      AS assessment_id,
             aq.category_id,
             COUNT(DISTINCT ar.question_id)::int AS answered,
             SUM(COALESCE(ar.review_score, ar.score))::int AS total_score,
             SUM(aq.max_score)::int    AS max_score
        FROM (${MY_PROGRAM_ASSESSMENTS(programId, farmerId)}) a
        JOIN assessment_responses ar
               ON ar.field_id = a.field_id
              AND ar.program_id = a.program_id
              AND ar.author_role = a.author_role
              AND ar.deleted_at IS NULL
        JOIN assessment_questions aq ON aq.id = ar.question_id
               AND aq.deleted_at IS NULL AND aq.is_active = true
       WHERE EXTRACT(YEAR FROM a.submitted_at)::int = ${year}
       GROUP BY a.id, aq.category_id
    )
    SELECT ac.id,
           ac.name,
           ac.sort_order,
           COALESCE(SUM(pa.answered), 0)::int    AS answered,
           COALESCE(SUM(pa.total_score), 0)::int AS total_score,
           COALESCE(SUM(pa.max_score), 0)::int   AS max_score,
           CASE WHEN COUNT(pa.assessment_id) > 0
                THEN ROUND(AVG(pa.total_score::numeric / NULLIF(pa.max_score, 0) * 100), 2)
                ELSE NULL END                     AS percentage
      FROM programs p
      JOIN assessment_categories ac
             ON ac.template_id = p.assessment_template_id
            AND ac.deleted_at IS NULL AND ac.is_active = true
      LEFT JOIN per_assessment pa ON pa.category_id = ac.id
     WHERE p.id = ${programId}::uuid
     GROUP BY ac.id, ac.name, ac.sort_order, ac.created_at
     ORDER BY ac.sort_order ASC, ac.created_at ASC;`);
}

/** The farmer's latest events in one program: submitted and started assessments, and the enrollment itself. */
export async function getProgramRecentActivity(
  programId: string,
  farmerId: string,
  limit: number
): Promise<ActivityRow[]> {
  return prisma.$queryRaw<ActivityRow[]>(Prisma.sql`
    WITH enrolled_fields AS (
      SELECT DISTINCT pef.field_id
        FROM program_enrollment_fields pef
        JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
        JOIN fields f ON f.id = pef.field_id AND f.deleted_at IS NULL
       WHERE pef.deleted_at IS NULL AND pe.farmer_id = ${farmerId}::uuid AND pe.program_id = ${programId}::uuid
    ),
    ev_submitted AS (
      SELECT 'assessment_submitted'            AS type,
             'Self assessment completed'       AS title,
             (fa.answered || '/' || fa.total_questions || ' answered · ' || fa.percentage || '%') AS detail,
             fa.submitted_at                   AS at,
             f.id                              AS field_id,
             f.name                            AS field_name
        FROM field_assessments fa
        JOIN fields f ON f.id = fa.field_id
       WHERE fa.program_id = ${programId}::uuid
         AND fa.author_role = 'farmer'
         AND fa.status = 'submitted' AND fa.review_status = 'approved'
         AND fa.submitted_at IS NOT NULL
         AND fa.field_id IN (SELECT field_id FROM enrolled_fields)
    ),
    -- A field's first saved answer, only while that field is not submitted in this program.
    ev_started AS (
      SELECT 'assessment_started'              AS type,
             'Assessment started'              AS title,
             NULL::text                        AS detail,
             MIN(ar.created_at)                AS at,
             f.id                              AS field_id,
             f.name                            AS field_name
        FROM assessment_responses ar
        JOIN fields f ON f.id = ar.field_id
       WHERE ar.program_id = ${programId}::uuid
         AND ar.author_role = 'farmer'
         AND ar.deleted_at IS NULL
         AND ar.field_id IN (SELECT field_id FROM enrolled_fields)
         AND NOT EXISTS (
           SELECT 1 FROM field_assessments fa
            WHERE fa.field_id = ar.field_id
              AND fa.program_id = ar.program_id
              AND fa.author_role = 'farmer'
              AND fa.status = 'submitted' AND fa.review_status = 'approved'
         )
       GROUP BY f.id, f.name
    ),
    ev_enrolled AS (
      SELECT 'enrolled_in_program'             AS type,
             'Enrolled in ' || p.name          AS title,
             NULL::text                        AS detail,
             pe.enrolled_at                    AS at,
             NULL::uuid                        AS field_id,
             p.name                            AS field_name
        FROM program_enrollments pe
        JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
       WHERE pe.deleted_at IS NULL
         AND pe.farmer_id = ${farmerId}::uuid
         AND pe.program_id = ${programId}::uuid
    )
    SELECT * FROM (
      SELECT * FROM ev_submitted
      UNION ALL SELECT * FROM ev_started
      UNION ALL SELECT * FROM ev_enrolled
    ) feed
     WHERE feed.at IS NOT NULL
     ORDER BY feed.at DESC
     LIMIT ${limit};`);
}

/** Programs in the same organization as this one that have not started yet, leaving out hidden ones the farmer is not in. */
export async function getProgramUpcomingPrograms(
  programId: string,
  farmerId: string
): Promise<UpcomingProgramRow[]> {
  return prisma.$queryRaw<UpcomingProgramRow[]>(Prisma.sql`
    SELECT p.id                                  AS program_id,
           p.name                                AS program_name,
           to_char(p.start_date, 'YYYY-MM-DD')   AS start_date,
           to_char(p.end_date, 'YYYY-MM-DD')     AS end_date,
           EXISTS (
             SELECT 1 FROM program_enrollments pe
              WHERE pe.program_id = p.id AND pe.farmer_id = ${farmerId}::uuid
                AND pe.deleted_at IS NULL
           )                                     AS already_enrolled
      FROM programs p
     WHERE p.deleted_at IS NULL
       AND p.is_active = true
       AND p.start_date IS NOT NULL
       AND p.start_date > org_today()
       AND p.org_id = (SELECT org_id FROM programs WHERE id = ${programId}::uuid)
       AND (p.show_to_farmers = true OR EXISTS (
         SELECT 1 FROM program_enrollments pe
          WHERE pe.program_id = p.id AND pe.farmer_id = ${farmerId}::uuid AND pe.deleted_at IS NULL))
     ORDER BY p.start_date ASC, p.created_at DESC;`);
}

export async function getProgramSummaryByYear(
  programId: string,
  farmerId: string,
  year: number
): Promise<FarmSummaryRow> {
  const rows = await prisma.$queryRaw<FarmSummaryRow[]>(Prisma.sql`
    SELECT COUNT(*)::int                 AS assessments_completed,
           ROUND(AVG(a.percentage), 2)   AS average_score
      FROM (${MY_PROGRAM_ASSESSMENTS(programId, farmerId)}) a
     WHERE EXTRACT(YEAR FROM a.submitted_at)::int = ${year};`);
  return rows[0] ?? { assessments_completed: 0, average_score: null };
}
