import { randomInt } from "node:crypto";
import prisma from "../db/prisma.js";

/**
 * An Enrollment ID belongs to one person and one program. It is issued when a
 * survey submission is accepted, and it is what lets that person register and
 * then enrol in that program.
 *
 * It can sit in two places. Anyone who came through a survey has it on their
 * submission. Farmers enrolled before this rule existed have no submission at
 * all, so the backfill put one on their enrolment instead. Every check here
 * looks at both, otherwise older farmers would be locked out of their own
 * programs.
 */

export interface EnrollmentIdHolder {
  enrollmentId: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  programId: string | null;
  programName: string | null;
}

/** Every Enrollment ID issued to this email address, from either source. */
export async function enrollmentIdsForEmail(
  email: string
): Promise<EnrollmentIdHolder[]> {
  const value = email.trim().toLowerCase();

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      enrollment_id: string;
      email: string;
      program_id: string | null;
      program_name: string | null;
    }>
  >(
    `
    SELECT s.enrollment_id, lower(wu.email) AS email,
           srv.program_id, p.name AS program_name
      FROM program_admin_survey_submissions s
      JOIN website_users wu ON wu.id = s.website_user_id
      JOIN program_admin_surveys srv
        ON srv.id = s.survey_id AND srv.deleted_at IS NULL
      LEFT JOIN programs p ON p.id = srv.program_id AND p.deleted_at IS NULL
     WHERE s.deleted_at IS NULL
       AND s.enrollment_id IS NOT NULL
       AND lower(wu.email) = $1
    UNION
    SELECT pe.enrollment_id, lower(u.email) AS email,
           pe.program_id, p.name AS program_name
      FROM program_enrollments pe
      JOIN users u ON u.id = pe.farmer_id AND u.deleted_at IS NULL
      LEFT JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
     WHERE pe.deleted_at IS NULL
       AND pe.enrollment_id IS NOT NULL
       AND lower(u.email) = $1
    `,
    value
  );

  return rows.map((r) => ({
    enrollmentId: r.enrollment_id,
    fullName: null,
    email: r.email,
    phone: null,
    programId: r.program_id,
    programName: r.program_name,
  }));
}

/** Who an Enrollment ID was issued to, or null when no such ID exists. */
export async function findEnrollmentId(
  enrollmentId: string
): Promise<EnrollmentIdHolder | null> {
  const value = enrollmentId.trim().toUpperCase();

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      enrollment_id: string;
      full_name: string | null;
      email: string;
      phone: string | null;
      program_id: string | null;
      program_name: string | null;
    }>
  >(
    `
    SELECT s.enrollment_id,
           NULLIF(btrim(concat_ws(' ', s.first_name, s.last_name)), '') AS full_name,
           lower(wu.email) AS email, wu.phone,
           srv.program_id, p.name AS program_name
      FROM program_admin_survey_submissions s
      JOIN website_users wu ON wu.id = s.website_user_id
      JOIN program_admin_surveys srv
        ON srv.id = s.survey_id AND srv.deleted_at IS NULL
      LEFT JOIN programs p ON p.id = srv.program_id AND p.deleted_at IS NULL
     WHERE s.deleted_at IS NULL AND upper(s.enrollment_id) = $1
    UNION
    SELECT pe.enrollment_id, u.full_name,
           lower(u.email) AS email, u.phone,
           pe.program_id, p.name AS program_name
      FROM program_enrollments pe
      JOIN users u ON u.id = pe.farmer_id AND u.deleted_at IS NULL
      LEFT JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
     WHERE pe.deleted_at IS NULL AND upper(pe.enrollment_id) = $1
     LIMIT 1
    `,
    value
  );

  const row = rows[0];
  if (!row) return null;
  return {
    enrollmentId: row.enrollment_id,
    fullName: row.full_name ?? null,
    email: row.email,
    phone: row.phone ?? null,
    programId: row.program_id,
    programName: row.program_name,
  };
}

/** Whether this farmer holds an Enrollment ID for this particular program. */
export async function holdsEnrollmentIdForProgram(
  farmerId: string,
  programId: string
): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ found: number }>>(
    `
    SELECT 1 AS found
      FROM program_admin_survey_submissions s
      JOIN website_users wu ON wu.id = s.website_user_id
      JOIN users u ON lower(u.email) = lower(wu.email) AND u.deleted_at IS NULL
      JOIN program_admin_surveys srv
        ON srv.id = s.survey_id AND srv.deleted_at IS NULL
     WHERE s.deleted_at IS NULL
       AND s.enrollment_id IS NOT NULL
       AND u.id = $1::uuid
       AND srv.program_id = $2::uuid
    UNION ALL
    SELECT 1 AS found
      FROM program_enrollments pe
     WHERE pe.deleted_at IS NULL
       AND pe.enrollment_id IS NOT NULL
       AND pe.farmer_id = $1::uuid
       AND pe.program_id = $2::uuid
     LIMIT 1
    `,
    farmerId,
    programId
  );
  return rows.length > 0;
}

/** The programs this farmer holds an Enrollment ID for. */
export async function programIdsHeldBy(farmerId: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ program_id: string }>>(
    `
    SELECT DISTINCT srv.program_id
      FROM program_admin_survey_submissions s
      JOIN website_users wu ON wu.id = s.website_user_id
      JOIN users u ON lower(u.email) = lower(wu.email) AND u.deleted_at IS NULL
      JOIN program_admin_surveys srv
        ON srv.id = s.survey_id AND srv.deleted_at IS NULL
     WHERE s.deleted_at IS NULL
       AND s.enrollment_id IS NOT NULL
       AND srv.program_id IS NOT NULL
       AND u.id = $1::uuid
    UNION
    SELECT DISTINCT pe.program_id
      FROM program_enrollments pe
     WHERE pe.deleted_at IS NULL
       AND pe.enrollment_id IS NOT NULL
       AND pe.farmer_id = $1::uuid
    `,
    farmerId
  );
  return rows.map((r) => r.program_id);
}

/** Whether an ID is already in use, across both places it can live. */
export async function enrollmentIdTaken(value: string): Promise<boolean> {
  return (await findEnrollmentId(value)) !== null;
}

/** The Enrollment ID this farmer holds for this program, if any. */
export async function enrollmentIdForProgram(
  farmerId: string,
  programId: string
): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ enrollment_id: string }>>(
    `
    SELECT s.enrollment_id
      FROM program_admin_survey_submissions s
      JOIN website_users wu ON wu.id = s.website_user_id
      JOIN users u ON lower(u.email) = lower(wu.email) AND u.deleted_at IS NULL
      JOIN program_admin_surveys srv
        ON srv.id = s.survey_id AND srv.deleted_at IS NULL
     WHERE s.deleted_at IS NULL
       AND s.enrollment_id IS NOT NULL
       AND u.id = $1::uuid
       AND srv.program_id = $2::uuid
     ORDER BY s.created_at DESC
     LIMIT 1
    `,
    farmerId,
    programId
  );
  return rows[0]?.enrollment_id ?? null;
}

/**
 * A fresh, unused Enrollment ID in the IIG-YYYY-NNNNNN shape. Used when your
 * team enrols someone by hand, so every enrolment carries an ID and the rest of
 * the flow keeps working for them.
 */
export async function issueEnrollmentId(): Promise<string> {
  const year = new Date().getFullYear();
  for (let i = 0; i < 20; i += 1) {
    const n = randomInt(100000, 1000000);
    const candidate = `IIG-${year}-${n}`;
    if (!(await enrollmentIdTaken(candidate))) return candidate;
  }
  throw new Error("Could not generate an Enrollment ID. Please retry.");
}
