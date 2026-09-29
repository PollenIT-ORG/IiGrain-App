import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { softDelete } from "../db/softDelete.js";

export interface PublicProgram {
  id: string;
  org_id: string;
  org_name: string | null;
  name: string;
  code: string | null;
  description: string | null;
  type: string | null;
  start_date: string | null;
  end_date: string | null;
  user_limit: number | null;
  is_active: boolean;
  // Whether the program is offered to farmers already on the platform.
  show_to_farmers: boolean;
  // Whether a survey is attached. The toggle above cannot be turned on without
  // one, so the panel needs to know.
  has_survey: boolean;
  // The assessment the program's farmers and assessors answer, and the template it started from.
  assessment_template_id: string;
  assessment_template_name: string;
  assessment_source_template_id: string | null;
  created_by: string | null;
  enrolled_count: number;
  created_at: Date;
  updated_at: Date;
}

const dateOnly = (d: Date | null): string | null =>
  d === null ? null : d.toISOString().slice(0, 10);

const PROGRAM_SELECT = {
  id: true,
  org_id: true,
  name: true,
  code: true,
  description: true,
  type: true,
  start_date: true,
  end_date: true,
  user_limit: true,
  is_active: true,
  show_to_farmers: true,
  created_by: true,
  created_at: true,
  updated_at: true,
  assessment_template_id: true,
  assessment_template: { select: { name: true, program_id: true, copied_from_id: true } },
  organizations: { select: { name: true } },
  _count: {
    select: {
      program_enrollments: { where: { deleted_at: null } },
      program_admin_surveys: { where: { deleted_at: null } },
    },
  },
} satisfies Prisma.programsSelect;

type ProgramRow = Prisma.programsGetPayload<{ select: typeof PROGRAM_SELECT }>;

type ProgramDb = Prisma.TransactionClient | typeof prisma;

function toPublicProgram(p: ProgramRow): PublicProgram {
  const template = p.assessment_template;
  return {
    id: p.id,
    org_id: p.org_id,
    org_name: p.organizations?.name ?? null,
    name: p.name,
    code: p.code,
    description: p.description,
    type: p.type,
    start_date: dateOnly(p.start_date),
    end_date: dateOnly(p.end_date),
    user_limit: p.user_limit,
    is_active: p.is_active,
    show_to_farmers: p.show_to_farmers,
    has_survey: p._count.program_admin_surveys > 0,
    assessment_template_id: p.assessment_template_id,
    assessment_template_name: template.name,
    // A program's own copy points back to its source, null when it started blank; a shared template is its own source.
    assessment_source_template_id:
      template.program_id === p.id ? template.copied_from_id : p.assessment_template_id,
    created_by: p.created_by,
    enrolled_count: p._count.program_enrollments,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

export interface CreateProgramInput {
  orgId: string;
  name: string;
  code: string | null;
  description: string | null;
  type: string | null;
  startDate: string | null;
  endDate: string | null;
  userLimit: number | null;
  isActive: boolean;
  createdBy: string | null;
  assessmentTemplateId: string;
}

export async function createProgram(
  input: CreateProgramInput,
  db: ProgramDb = prisma
): Promise<PublicProgram> {
  const row = await db.programs.create({
    data: {
      org_id: input.orgId,
      name: input.name,
      code: input.code,
      description: input.description,
      type: input.type,
      start_date: input.startDate ? new Date(input.startDate) : null,
      end_date: input.endDate ? new Date(input.endDate) : null,
      user_limit: input.userLimit,
      is_active: input.isActive,
      created_by: input.createdBy,
      assessment_template_id: input.assessmentTemplateId,
    },
    select: PROGRAM_SELECT,
  });
  return toPublicProgram(row);
}

// Program codes are unique per organization (case-insensitive), ignoring
// soft-deleted rows. An empty code is not checked - only real codes must be
// unique.
export async function programCodeExists(
  orgId: string,
  code: string,
  excludeId?: string
): Promise<boolean> {
  const found = await prisma.programs.findFirst({
    where: {
      org_id: orgId,
      code: { equals: code, mode: "insensitive" },
      deleted_at: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return found !== null;
}

/** The same four states the panel shows on each program. */
export type ProgramStatusFilter = "active" | "inactive" | "ended" | "scheduled";

export interface ListProgramsFilters {
  orgId?: string;
  status?: ProgramStatusFilter;
  /** Today on the organization's clock, YYYY-MM-DD, for the date-based ones. */
  today?: string;
  search?: string;
  // A program administrator only ever sees the programs they run.
  createdBy?: string;
  limit: number;
  offset: number;
}

export async function listPrograms(
  filters: ListProgramsFilters
): Promise<{ rows: PublicProgram[]; total: number }> {
  const where: Prisma.programsWhereInput = { deleted_at: null };
  if (filters.orgId) where.org_id = filters.orgId;
  if (filters.createdBy) where.created_by = filters.createdBy;

  // Turned off by hand wins over any date, exactly as the badge reads it: a
  // program is Ended once past its end date, Scheduled before it starts, and
  // Active in between.
  if (filters.status === "inactive") {
    where.is_active = false;
  } else if (filters.status) {
    const today = new Date(`${filters.today}T00:00:00.000Z`);
    where.is_active = true;
    if (filters.status === "ended") {
      where.end_date = { lt: today };
    } else if (filters.status === "scheduled") {
      where.start_date = { gt: today };
    } else {
      // AND, not OR: the search below owns `where.OR`.
      where.AND = [
        { OR: [{ end_date: null }, { end_date: { gte: today } }] },
        { OR: [{ start_date: null }, { start_date: { lte: today } }] },
      ];
    }
  }

  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { code: { contains: s, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.programs.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: filters.limit,
      skip: filters.offset,
      select: PROGRAM_SELECT,
    }),
    prisma.programs.count({ where }),
  ]);
  return { rows: rows.map(toPublicProgram), total };
}

/** How many programs someone has created, for "you need a program first". */
export async function countProgramsCreatedBy(
  createdBy: string
): Promise<number> {
  return prisma.programs.count({
    where: { created_by: createdBy, deleted_at: null },
  });
}

export async function findProgramById(
  id: string
): Promise<PublicProgram | null> {
  const p = await prisma.programs.findFirst({
    where: { id, deleted_at: null },
    select: PROGRAM_SELECT,
  });
  return p ? toPublicProgram(p) : null;
}

export interface UpdateProgramInput {
  name?: string;
  code?: string | null;
  description?: string | null;
  type?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  userLimit?: number | null;
  isActive?: boolean;
}

export async function updateProgram(
  id: string,
  input: UpdateProgramInput
): Promise<PublicProgram | null> {
  const data: Prisma.programsUncheckedUpdateManyInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.code !== undefined) data.code = input.code;
  if (input.description !== undefined) data.description = input.description;
  if (input.type !== undefined) data.type = input.type;
  if (input.startDate !== undefined) {
    data.start_date = input.startDate ? new Date(input.startDate) : null;
  }
  if (input.endDate !== undefined) {
    data.end_date = input.endDate ? new Date(input.endDate) : null;
  }
  if (input.userLimit !== undefined) data.user_limit = input.userLimit;
  if (input.isActive !== undefined) data.is_active = input.isActive;

  if (Object.keys(data).length === 0) return findProgramById(id);
  data.updated_at = new Date();

  const { count } = await prisma.programs.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  if (!count) return null;
  return findProgramById(id);
}

export async function softDeleteProgram(id: string): Promise<boolean> {
  const affected = await softDelete("programs", id);
  return affected > 0;
}

export async function programHasSubmittedAssessment(
  programId: string
): Promise<boolean> {
  const r = await prisma.field_assessments.findFirst({
    where: { program_id: programId, status: "submitted" },
    select: { id: true },
  });
  return r !== null;
}

// Soft-deletes a program together with its enrollments and enrollment-fields, so
// no field is left attached to a removed program. Callers must first confirm the
// program has no submitted assessment (those are preserved by deactivating, not
// deleting). One transaction.
export async function softDeleteProgramCascade(id: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const { count } = await tx.programs.updateMany({
      where: { id, deleted_at: null },
      data: { deleted_at: now },
    });
    if (count === 0) return false;
    const enrollments = await tx.program_enrollments.findMany({
      where: { program_id: id, deleted_at: null },
      select: { id: true },
    });
    const enrollmentIds = enrollments.map((e) => e.id);
    if (enrollmentIds.length > 0) {
      await tx.program_enrollments.updateMany({
        where: { id: { in: enrollmentIds } },
        data: { deleted_at: now, updated_at: now },
      });
      await tx.program_enrollment_fields.updateMany({
        where: { enrollment_id: { in: enrollmentIds }, deleted_at: null },
        data: { deleted_at: now, updated_at: now },
      });
    }
    return true;
  });
}

export async function countEnrollments(programId: string): Promise<number> {
  return prisma.program_enrollments.count({
    where: { program_id: programId, deleted_at: null },
  });
}

export interface PublicEnrollment {
  id: string;
  program_id: string;
  farmer_id: string;
  /** What the farmer quotes when they call about this program. */
  enrollment_id: string | null;
  farmer_name: string | null;
  farmer_email: string;
  assessor_id: string | null;
  assessor_name: string | null;
  assessor_email: string | null;
  enrolled_by: string | null;
  status: string;
  note: string | null;
  enrolled_at: Date;
  fields: Array<{
    id: string;
    field_id: string;
    field_name: string;
    area_acres: number | null;
    farm_name: string | null;
  }>;
  created_at: Date;
  updated_at: Date;
}

const ENROLLMENT_SELECT = {
  id: true,
  program_id: true,
  farmer_id: true,
  enrollment_id: true,
  assessor_id: true,
  enrolled_by: true,
  status: true,
  note: true,
  enrolled_at: true,
  created_at: true,
  updated_at: true,
  users_program_enrollments_farmer_idTousers: {
    select: { full_name: true, email: true },
  },
  users_program_enrollments_assessor_idTousers: {
    select: { full_name: true, email: true },
  },
  program_enrollment_fields: {
    where: { deleted_at: null },
    select: {
      id: true,
      field_id: true,
      fields: {
        select: {
          name: true,
          area_acres: true,
          farms: { select: { name: true } },
        },
      },
    },
  },
} satisfies Prisma.program_enrollmentsSelect;

type EnrollmentRow = Prisma.program_enrollmentsGetPayload<{
  select: typeof ENROLLMENT_SELECT;
}>;

function toPublicEnrollment(e: EnrollmentRow): PublicEnrollment {
  const assessor = e.users_program_enrollments_assessor_idTousers;
  return {
    id: e.id,
    program_id: e.program_id,
    farmer_id: e.farmer_id,
    enrollment_id: e.enrollment_id,
    farmer_name: e.users_program_enrollments_farmer_idTousers.full_name,
    farmer_email: e.users_program_enrollments_farmer_idTousers.email,
    assessor_id: e.assessor_id,
    assessor_name: assessor?.full_name ?? null,
    assessor_email: assessor?.email ?? null,
    enrolled_by: e.enrolled_by,
    status: e.status,
    note: e.note,
    enrolled_at: e.enrolled_at,
    fields: e.program_enrollment_fields.map((f) => ({
      id: f.id,
      field_id: f.field_id,
      field_name: f.fields.name,
      area_acres: f.fields.area_acres === null ? null : Number(f.fields.area_acres),
      farm_name: f.fields.farms?.name ?? null,
    })),
    created_at: e.created_at,
    updated_at: e.updated_at,
  };
}

export async function listEnrollments(
  programId: string
): Promise<PublicEnrollment[]> {
  const rows = await prisma.program_enrollments.findMany({
    where: { program_id: programId, deleted_at: null },
    orderBy: { enrolled_at: "desc" },
    select: ENROLLMENT_SELECT,
  });
  return rows.map(toPublicEnrollment);
}

export interface ListEnrollmentsFilters {
  programId: string;
  search?: string;
  assessor?: "assigned" | "unassigned";
  limit: number;
  offset: number;
}

export async function listEnrollmentsPaged(
  filters: ListEnrollmentsFilters
): Promise<{ rows: PublicEnrollment[]; total: number }> {
  const where: Prisma.program_enrollmentsWhereInput = {
    program_id: filters.programId,
    deleted_at: null,
  };
  if (filters.search) {
    const s = filters.search;
    where.users_program_enrollments_farmer_idTousers = {
      OR: [
        { full_name: { contains: s, mode: "insensitive" } },
        { email: { contains: s, mode: "insensitive" } },
      ],
    };
  }
  if (filters.assessor === "assigned") where.assessor_id = { not: null };
  else if (filters.assessor === "unassigned") where.assessor_id = null;

  const [rows, total] = await Promise.all([
    prisma.program_enrollments.findMany({
      where,
      orderBy: { enrolled_at: "desc" },
      take: filters.limit,
      skip: filters.offset,
      select: ENROLLMENT_SELECT,
    }),
    prisma.program_enrollments.count({ where }),
  ]);
  return { rows: rows.map(toPublicEnrollment), total };
}

export async function findEnrollmentById(
  id: string
): Promise<PublicEnrollment | null> {
  const e = await prisma.program_enrollments.findFirst({
    where: { id, deleted_at: null },
    select: ENROLLMENT_SELECT,
  });
  return e ? toPublicEnrollment(e) : null;
}

export async function findEnrollment(
  programId: string,
  farmerId: string
): Promise<{ id: string } | null> {
  return prisma.program_enrollments.findFirst({
    where: { program_id: programId, farmer_id: farmerId, deleted_at: null },
    select: { id: true },
  });
}

export interface EnrollInput {
  /** The Enrollment ID to record against this enrolment. */
  enrollmentId?: string | null;
  programId: string;
  farmerId: string;
  fieldIds: string[];
  assessorId: string | null;
  enrolledBy: string | null;
  note: string | null;
}

export async function createEnrollment(
  input: EnrollInput
): Promise<PublicEnrollment> {
  const id = await prisma.$transaction(async (tx) => {
    const enrollment = await tx.program_enrollments.create({
      data: {
        program_id: input.programId,
        farmer_id: input.farmerId,
        assessor_id: input.assessorId,
        enrolled_by: input.enrolledBy,
        note: input.note,
        // Every enrolment carries an ID: the one from their accepted survey
        // where there is one, otherwise a fresh one for a manual enrolment.
        enrollment_id: input.enrollmentId,
      },
      select: { id: true },
    });
    if (input.fieldIds.length > 0) {
      await tx.program_enrollment_fields.createMany({
        data: input.fieldIds.map((fieldId) => ({
          enrollment_id: enrollment.id,
          field_id: fieldId,
        })),
      });
    }
    return enrollment.id;
  });
  const created = await findEnrollmentById(id);
  return created!;
}

export async function setEnrollmentFields(
  enrollmentId: string,
  fieldIds: string[]
): Promise<PublicEnrollment | null> {
  await prisma.$transaction(async (tx) => {
    await tx.program_enrollment_fields.updateMany({
      where: {
        enrollment_id: enrollmentId,
        deleted_at: null,
        field_id: { notIn: fieldIds.length ? fieldIds : ["00000000-0000-0000-0000-000000000000"] },
      },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
    for (const fieldId of fieldIds) {
      const existing = await tx.program_enrollment_fields.findFirst({
        where: { enrollment_id: enrollmentId, field_id: fieldId, deleted_at: null },
        select: { id: true },
      });
      if (!existing) {
        await tx.program_enrollment_fields.create({
          data: { enrollment_id: enrollmentId, field_id: fieldId },
        });
      }
    }
  });
  return findEnrollmentById(enrollmentId);
}

export interface AvailableProgramField {
  id: string;
  name: string;
  crop: string | null;
  farm_name: string;
  enrolled: boolean;
}

export interface AvailableProgram {
  id: string;
  // The token of the program's survey, turned into a link by the service.
  survey_token: string | null;
  /**
   * Whether this farmer holds an Enrollment ID for this program. Without one
   * they can see the program and open its survey, but not enrol.
   */
  can_enroll: boolean;
  /** The Enrollment ID this farmer holds for the program, null until one is issued. */
  enrollment_id: string | null;
  name: string;
  code: string | null;
  description: string | null;
  type: string | null;
  start_date: string | null;
  end_date: string | null;
  user_limit: number | null;
  enrolled_count: number;
  is_full: boolean;
  already_enrolled: boolean;
  /** Acres the farmer entered on this program's survey, before any field exists. */
  survey_acres: number | null;
  fields: AvailableProgramField[];
}

/** Flips whether the program is offered to farmers already on the platform. */
export async function setProgramVisibility(
  id: string,
  showToFarmers: boolean
): Promise<PublicProgram | null> {
  const found = await prisma.programs.findFirst({
    where: { id, deleted_at: null },
    select: { id: true },
  });
  if (!found) return null;
  const row = await prisma.programs.update({
    where: { id },
    data: { show_to_farmers: showToFarmers, updated_at: new Date() },
    select: PROGRAM_SELECT,
  });
  return toPublicProgram(row);
}

/** Whether a survey is attached to this program right now. */
export async function programHasSurvey(programId: string): Promise<boolean> {
  const found = await prisma.program_admin_surveys.findFirst({
    where: { program_id: programId, deleted_at: null },
    select: { id: true },
  });
  return found !== null;
}

export async function listAvailableProgramsForFarmer(
  farmerId: string
): Promise<AvailableProgram[]> {
  // Programs the farmer can enroll in: STARTED and not yet ended. Programs the
  // farmer is already enrolled in stay in the list (so more fields can be added
  // while the program runs); each program carries per-field enrollment status.
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      code: string | null;
      description: string | null;
      type: string | null;
      start_date: Date | null;
      end_date: Date | null;
      user_limit: number | null;
      enrolled_count: number;
      already_enrolled: boolean;
      survey_token: string | null;
      can_enroll: boolean;
      enrollment_id: string | null;
      show_to_farmers: boolean;
      survey_acres: unknown;
    }>
  >(Prisma.sql`
    SELECT * FROM (
      SELECT p.id, p.name, p.code, p.description, p.type,
             p.start_date, p.end_date, p.user_limit, p.show_to_farmers,
             srv.token AS survey_token,
             COALESCE(cnt.c, 0)::int AS enrolled_count,
             EXISTS (
               SELECT 1 FROM program_enrollments pe2
                WHERE pe2.program_id = p.id
                  AND pe2.farmer_id = ${farmerId}::uuid
                  AND pe2.deleted_at IS NULL
             ) AS already_enrolled,
             -- Holding an Enrollment ID for this program is what allows
             -- enrolling. It lives on the accepted survey submission, or on the
             -- enrolment itself for farmers who predate the survey flow.
             eid.enrollment_id IS NOT NULL AS can_enroll,
             eid.enrollment_id,
             sacres.total_acres AS survey_acres
        FROM programs p
        -- The ID on the enrolment comes first as it is the one on record, then the latest survey ID.
        LEFT JOIN LATERAL (
          SELECT ids.enrollment_id
            FROM (
              SELECT pe3.enrollment_id, 0 AS pref, pe3.created_at
                FROM program_enrollments pe3
               WHERE pe3.deleted_at IS NULL
                 AND pe3.enrollment_id IS NOT NULL
                 AND pe3.farmer_id = ${farmerId}::uuid
                 AND pe3.program_id = p.id
              UNION ALL
              SELECT sub.enrollment_id, 1 AS pref, sub.created_at
                FROM program_admin_survey_submissions sub
                JOIN website_users wu ON wu.id = sub.website_user_id
                JOIN users usr
                  ON lower(usr.email) = lower(wu.email)
                 AND usr.deleted_at IS NULL
                JOIN program_admin_surveys psv
                  ON psv.id = sub.survey_id AND psv.deleted_at IS NULL
               WHERE sub.deleted_at IS NULL
                 AND sub.enrollment_id IS NOT NULL
                 AND usr.id = ${farmerId}::uuid
                 AND psv.program_id = p.id
            ) ids
           ORDER BY ids.pref, ids.created_at DESC
           LIMIT 1
        ) eid ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS c
            FROM program_enrollments pe
           WHERE pe.program_id = p.id AND pe.deleted_at IS NULL
        ) cnt ON true
        LEFT JOIN LATERAL (
          SELECT s.token
            FROM program_admin_surveys s
           WHERE s.program_id = p.id AND s.deleted_at IS NULL
           ORDER BY s.created_at DESC
           LIMIT 1
        ) srv ON true
        LEFT JOIN LATERAL (
          SELECT sub.total_acres
            FROM program_admin_survey_submissions sub
            JOIN website_users wu ON wu.id = sub.website_user_id
            JOIN users usr
              ON lower(usr.email) = lower(wu.email) AND usr.deleted_at IS NULL
            JOIN program_admin_surveys psv
              ON psv.id = sub.survey_id AND psv.deleted_at IS NULL
           WHERE sub.deleted_at IS NULL
             AND usr.id = ${farmerId}::uuid
             AND psv.program_id = p.id
           ORDER BY sub.created_at DESC
           LIMIT 1
        ) sacres ON true
       WHERE p.deleted_at IS NULL
         AND p.is_active = true
         AND (p.start_date IS NULL OR p.start_date <= org_today())
         AND (p.end_date IS NULL OR p.end_date >= org_today())
       ORDER BY p.created_at DESC
    ) t
    -- Either it has been opened up to farmers so they can find it and apply,
    -- or this farmer already holds its Enrollment ID, in which case it stays
    -- visible whatever the toggle says.
    WHERE t.show_to_farmers = true OR t.can_enroll;`);

  const fields = await prisma.fields.findMany({
    where: {
      deleted_at: null,
      is_active: true,
      farms: { deleted_at: null, owner_id: farmerId, is_active: true },
    },
    orderBy: { created_at: "desc" },
    select: { id: true, name: true, crop: true, farms: { select: { name: true } } },
  });

  // (program_id, field_id) pairs this farmer currently has enrolled.
  const pairs = await prisma.$queryRaw<
    Array<{ program_id: string; field_id: string }>
  >(Prisma.sql`
    SELECT pe.program_id, pef.field_id
      FROM program_enrollments pe
      JOIN program_enrollment_fields pef
             ON pef.enrollment_id = pe.id AND pef.deleted_at IS NULL
     WHERE pe.farmer_id = ${farmerId}::uuid AND pe.deleted_at IS NULL;`);

  const enrolledByProgram = new Map<string, Set<string>>();
  for (const pr of pairs) {
    let set = enrolledByProgram.get(pr.program_id);
    if (!set) {
      set = new Set<string>();
      enrolledByProgram.set(pr.program_id, set);
    }
    set.add(pr.field_id);
  }

  return rows.map((r) => {
    const enrolledSet = enrolledByProgram.get(r.id) ?? new Set<string>();
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      description: r.description,
      type: r.type,
      start_date: dateOnly(r.start_date),
      end_date: dateOnly(r.end_date),
      user_limit: r.user_limit,
      survey_token: r.survey_token,
      can_enroll: r.can_enroll,
      enrollment_id: r.enrollment_id,
      enrolled_count: r.enrolled_count,
      is_full: r.user_limit !== null && r.enrolled_count >= r.user_limit,
      already_enrolled: r.already_enrolled,
      survey_acres: r.survey_acres === null ? null : Number(r.survey_acres),
      fields: fields.map((f) => ({
        id: f.id,
        name: f.name,
        crop: f.crop,
        farm_name: f.farms.name,
        enrolled: enrolledSet.has(f.id),
      })),
    };
  });
}

export interface EnrollableField {
  id: string;
  name: string;
  crop: string | null;
  farm_name: string;
}

export interface EnrollableFieldsFilters {
  farmerId: string;
  search?: string;
  limit: number;
  offset: number;
}

export async function listEnrollableFieldsForFarmer(
  filters: EnrollableFieldsFilters
): Promise<{ rows: EnrollableField[]; total: number }> {
  // Only enrollable fields: an inactive field, or a field on an inactive farm,
  // cannot be taken into a program.
  const where: Prisma.fieldsWhereInput = {
    deleted_at: null,
    is_active: true,
    farms: { deleted_at: null, owner_id: filters.farmerId, is_active: true },
  };
  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { crop: { contains: s, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.fields.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: filters.limit,
      skip: filters.offset,
      select: {
        id: true,
        name: true,
        crop: true,
        farms: { select: { name: true } },
      },
    }),
    prisma.fields.count({ where }),
  ]);

  return {
    rows: rows.map((f) => ({
      id: f.id,
      name: f.name,
      crop: f.crop,
      farm_name: f.farms.name,
    })),
    total,
  };
}

export interface SubmissionRow {
  field_id: string;
  field_name: string;
  farm_name: string | null;
  farmer_id: string;
  farmer_name: string | null;
  author_role: string;
  author_id: string | null;
  author_name: string | null;
  program_id: string | null;
  program_name: string | null;
  answered: number;
  total_questions: number;
  percentage: string;
  review_status: string;
  assessment_id: string;
  submitted_at: Date | null;
}

export interface ListSubmissionsFilters {
  programId?: string;
  fieldId?: string;
  authorRole?: "farmer" | "assessor";
  reviewStatus?: "in_review" | "approved";
  /** Limits the list to the programs this person runs. */
  programOwnerId?: string;
  limit: number;
  offset: number;
}

export async function listSubmissions(
  filters: ListSubmissionsFilters
): Promise<{ rows: SubmissionRow[]; total: number }> {
  const where = Prisma.sql`
    fa.status = 'submitted'
    ${filters.programId ? Prisma.sql`AND fa.program_id = ${filters.programId}::uuid` : Prisma.empty}
    ${filters.fieldId ? Prisma.sql`AND fa.field_id = ${filters.fieldId}::uuid` : Prisma.empty}
    ${filters.authorRole ? Prisma.sql`AND fa.author_role = ${filters.authorRole}` : Prisma.empty}
    ${filters.reviewStatus ? Prisma.sql`AND fa.review_status = ${filters.reviewStatus}` : Prisma.empty}
    ${
      // A subquery, not a join: this clause is also used by the count, which
      // reads from field_assessments alone.
      filters.programOwnerId
        ? Prisma.sql`AND fa.program_id IN (
             SELECT id FROM programs
              WHERE deleted_at IS NULL
                AND created_by = ${filters.programOwnerId}::uuid
           )`
        : Prisma.empty
    }
  `;

  const rows = await prisma.$queryRaw<SubmissionRow[]>(Prisma.sql`
    SELECT f.id                    AS field_id,
           f.name                  AS field_name,
           fm.name                 AS farm_name,
           owner.id                AS farmer_id,
           owner.full_name         AS farmer_name,
           fa.author_role          AS author_role,
           fa.author_id            AS author_id,
           author.full_name        AS author_name,
           fa.program_id           AS program_id,
           p.name                  AS program_name,
           fa.answered             AS answered,
           fa.total_questions      AS total_questions,
           fa.percentage           AS percentage,
           fa.review_status        AS review_status,
           fa.id                   AS assessment_id,
           fa.submitted_at         AS submitted_at
      FROM field_assessments fa
      JOIN fields f  ON f.id = fa.field_id
      JOIN farms  fm ON fm.id = f.farm_id
      JOIN users  owner  ON owner.id = fm.owner_id
      LEFT JOIN users author ON author.id = fa.author_id
      LEFT JOIN programs p ON p.id = fa.program_id
     WHERE ${where}
     ORDER BY fa.submitted_at DESC NULLS LAST
     LIMIT ${filters.limit} OFFSET ${filters.offset};`);

  const countRows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count FROM field_assessments fa WHERE ${where};`);
  const total = Number(countRows[0]?.count ?? 0);

  return { rows, total };
}

export interface ProgramAssessmentProgress {
  total_fields: number;
  farmer_submitted: number;
  assessor_submitted: number;
}

// Per-program rollup: of the fields enrolled in this program, how many have a
// submitted farmer assessment and how many a submitted assessor assessment.
export async function getProgramAssessmentProgress(
  programId: string
): Promise<ProgramAssessmentProgress> {
  const rows = await prisma.$queryRaw<ProgramAssessmentProgress[]>(Prisma.sql`
    WITH enrolled AS (
      SELECT DISTINCT pef.field_id
        FROM program_enrollments pe
        JOIN program_enrollment_fields pef
               ON pef.enrollment_id = pe.id AND pef.deleted_at IS NULL
       WHERE pe.program_id = ${programId}::uuid
         AND pe.deleted_at IS NULL
    )
    SELECT
      (SELECT COUNT(*)::int FROM enrolled) AS total_fields,
      COUNT(*) FILTER (
        WHERE fa.author_role = 'farmer' AND fa.status = 'submitted'
      )::int AS farmer_submitted,
      COUNT(*) FILTER (
        WHERE fa.author_role = 'assessor' AND fa.status = 'submitted'
      )::int AS assessor_submitted
      FROM enrolled e
      LEFT JOIN field_assessments fa
             ON fa.field_id = e.field_id
            AND fa.program_id = ${programId}::uuid;`);
  return (
    rows[0] ?? { total_fields: 0, farmer_submitted: 0, assessor_submitted: 0 }
  );
}

export async function setEnrollmentAssessor(
  enrollmentId: string,
  assessorId: string | null
): Promise<PublicEnrollment | null> {
  await prisma.program_enrollments.updateMany({
    where: { id: enrollmentId, deleted_at: null },
    data: { assessor_id: assessorId, updated_at: new Date() },
  });
  return findEnrollmentById(enrollmentId);
}

export async function softDeleteEnrollment(id: string): Promise<boolean> {
  const affected = await softDelete("program_enrollments", id);
  if (affected > 0) {
    await prisma.program_enrollment_fields.updateMany({
      where: { enrollment_id: id, deleted_at: null },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
  }
  return affected > 0;
}
