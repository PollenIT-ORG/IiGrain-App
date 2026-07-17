import ApiError from "../utils/ApiError.js";
import prisma from "../db/prisma.js";
import { findById } from "../models/user.model.js";
import { getDefaultOrgId } from "./tenancy.service.js";
import {
  createProgram,
  listPrograms,
  findProgramById,
  updateProgram,
  softDeleteProgram,
  countEnrollments,
  listEnrollments,
  findEnrollment,
  findEnrollmentById,
  createEnrollment,
  setEnrollmentFields,
  setEnrollmentAssessor,
  softDeleteEnrollment,
  listSubmissions,
  listEnrollmentsPaged,
  listAvailableProgramsForFarmer,
  listEnrollableFieldsForFarmer,
  type PublicProgram,
  type PublicEnrollment,
  type SubmissionRow,
  type AvailableProgram,
  type EnrollableField,
} from "../models/program.model.js";
import {
  setFarmerAssessor,
  clearFarmerAssessor,
} from "../models/assessorAssignment.model.js";
import { notifyUser, notifyUsers } from "./notification.service.js";
import { broadcastToAdmins } from "./realtime.service.js";
import {
  newProgramEmail,
  enrolledInProgramEmail,
  assessorAssignedEmail,
} from "./emailTemplates.js";

export interface Actor {
  id: string;
  role: string;
}

export interface CreateProgramInput {
  name: string;
  code?: string | null;
  description?: string | null;
  type?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  userLimit?: number | null;
  isActive?: boolean;
}

function nn(v: string | null | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function assertProgramEnrollable(program: {
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}): void {
  if (!program.is_active) {
    throw ApiError.badRequest("This program is not open for enrollment.");
  }
  const today = todayStr();
  if (program.start_date && program.start_date > today) {
    throw ApiError.badRequest(
      `Enrollment opens on ${program.start_date}. This program hasn't started yet.`
    );
  }
  if (program.end_date && program.end_date < today) {
    throw ApiError.badRequest("This program has ended; enrollment is closed.");
  }
}

export async function addProgram(
  input: CreateProgramInput,
  actor: Actor
): Promise<PublicProgram> {
  const orgId = await getDefaultOrgId();
  if (!orgId) {
    throw ApiError.badRequest(
      "No organization is configured yet. Create an organization first."
    );
  }
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw ApiError.badRequest("End date cannot be before start date.");
  }

  const program = await createProgram({
    orgId,
    name: input.name.trim(),
    code: nn(input.code),
    description: nn(input.description),
    type: nn(input.type),
    startDate: nn(input.startDate),
    endDate: nn(input.endDate),
    userLimit: input.userLimit ?? null,
    isActive: input.isActive ?? true,
    createdBy: actor.id,
  });

  void notifyOrgFarmersOfNewProgram(orgId, program);

  return program;
}

async function notifyOrgFarmersOfNewProgram(
  orgId: string,
  program: PublicProgram
): Promise<void> {
  if (!program.is_active) return;
  const farmers = await prisma.users.findMany({
    where: {
      deleted_at: null,
      org_id: orgId,
      roles: { name: "farmer" },
    },
    select: { id: true },
  });
  await notifyUsers(
    farmers.map((f) => f.id),
    {
      type: "new_program_available",
      title: "New program available",
      body: `A new program "${program.name}" is now available. Tap to view.`,
      data: { programId: program.id },
      emailFor: (r) =>
        newProgramEmail({
          fullName: r.fullName,
          programName: program.name,
          startDate: program.start_date,
          endDate: program.end_date,
        }),
    }
  );
}

export interface ListProgramsInput {
  page: number;
  limit: number;
  isActive?: boolean;
  search?: string;
}

export async function getPrograms(input: ListProgramsInput): Promise<{
  programs: PublicProgram[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { rows, total } = await listPrograms({
    isActive: input.isActive,
    search: input.search,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  });
  return {
    programs: rows,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function getProgramById(id: string): Promise<PublicProgram> {
  const program = await findProgramById(id);
  if (!program) throw ApiError.notFound("Program not found.");
  return program;
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

export async function editProgram(
  id: string,
  input: UpdateProgramInput
): Promise<PublicProgram> {
  const existing = await findProgramById(id);
  if (!existing) throw ApiError.notFound("Program not found.");

  const start = input.startDate !== undefined ? nn(input.startDate) : existing.start_date;
  const end = input.endDate !== undefined ? nn(input.endDate) : existing.end_date;
  if (start && end && end < start) {
    throw ApiError.badRequest("End date cannot be before start date.");
  }

  if (input.userLimit !== undefined && input.userLimit !== null) {
    const enrolled = await countEnrollments(id);
    if (input.userLimit < enrolled) {
      throw ApiError.badRequest(
        `Limit (${input.userLimit}) is below the ${enrolled} farmer(s) already enrolled.`
      );
    }
  }

  const updated = await updateProgram(id, {
    name: input.name?.trim(),
    code: input.code !== undefined ? nn(input.code) : undefined,
    description: input.description !== undefined ? nn(input.description) : undefined,
    type: input.type !== undefined ? nn(input.type) : undefined,
    startDate: input.startDate !== undefined ? nn(input.startDate) : undefined,
    endDate: input.endDate !== undefined ? nn(input.endDate) : undefined,
    userLimit: input.userLimit,
    isActive: input.isActive,
  });
  if (!updated) throw ApiError.notFound("Program not found.");
  return updated;
}

export async function removeProgram(id: string): Promise<void> {
  const ok = await softDeleteProgram(id);
  if (!ok) throw ApiError.notFound("Program not found.");
}

export async function getEnrollments(
  programId: string
): Promise<PublicEnrollment[]> {
  await getProgramById(programId);
  return listEnrollments(programId);
}

export interface ListEnrollmentsInput {
  programId: string;
  page: number;
  limit: number;
  search?: string;
  assessor?: "assigned" | "unassigned";
}

export async function getEnrollmentsPaged(input: ListEnrollmentsInput): Promise<{
  enrollments: PublicEnrollment[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  await getProgramById(input.programId);
  const { rows, total } = await listEnrollmentsPaged({
    programId: input.programId,
    search: input.search,
    assessor: input.assessor,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  });
  return {
    enrollments: rows,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

async function assertFieldsOwnedByFarmer(
  fieldIds: string[],
  farmerId: string
): Promise<void> {
  if (fieldIds.length === 0) {
    throw ApiError.badRequest("Select at least one field to enroll.");
  }
  const owned = await prisma.fields.findMany({
    where: {
      id: { in: fieldIds },
      deleted_at: null,
      farms: { deleted_at: null, owner_id: farmerId },
    },
    select: { id: true },
  });
  if (owned.length !== fieldIds.length) {
    throw ApiError.badRequest(
      "One or more selected fields do not belong to this farmer."
    );
  }
}

export interface EnrollInput {
  farmerId: string;
  fieldIds: string[];
  assessorId?: string | null;
  note?: string | null;
}

async function assertAssessor(assessorId: string | null): Promise<void> {
  if (!assessorId) return;
  const assessor = await findById(assessorId);
  if (!assessor) throw ApiError.notFound("The selected assessor was not found.");
  if (assessor.role_name !== "assessor") {
    throw ApiError.badRequest("The selected user is not an assessor.");
  }
}

async function syncAssessorAssignment(
  farmerId: string,
  assessorId: string | null,
  actorId: string
): Promise<void> {
  if (assessorId) {
    const orgId = await getDefaultOrgId();
    await setFarmerAssessor({
      farmerId,
      assessorId,
      assignedBy: actorId,
      orgId,
      note: null,
    });
  } else {
    await clearFarmerAssessor(farmerId);
  }
}

export async function enrollFarmer(
  programId: string,
  input: EnrollInput,
  actor: Actor
): Promise<PublicEnrollment> {
  const program = await findProgramById(programId);
  if (!program) throw ApiError.notFound("Program not found.");
  assertProgramEnrollable(program);

  const farmer = await findById(input.farmerId);
  if (!farmer) throw ApiError.notFound("The selected farmer was not found.");
  if (farmer.role_name !== "farmer") {
    throw ApiError.badRequest("Only farmers can be enrolled in a program.");
  }

  const assessorId = input.assessorId ?? null;
  await assertAssessor(assessorId);

  const dup = await findEnrollment(programId, input.farmerId);
  if (dup) {
    throw ApiError.conflict("This farmer is already enrolled in this program.");
  }

  if (program.user_limit !== null) {
    const enrolled = await countEnrollments(programId);
    if (enrolled >= program.user_limit) {
      throw ApiError.badRequest(
        `This program is full (limit ${program.user_limit} farmers).`
      );
    }
  }

  await assertFieldsOwnedByFarmer(input.fieldIds, input.farmerId);

  const enrollment = await createEnrollment({
    programId,
    farmerId: input.farmerId,
    fieldIds: input.fieldIds,
    assessorId,
    enrolledBy: actor.id,
    note: nn(input.note),
  });

  await syncAssessorAssignment(input.farmerId, assessorId, actor.id);

  void notifyUser({
    userId: input.farmerId,
    type: "enrolled_in_program",
    title: "Enrolled in a program",
    body: `You have been enrolled in "${program.name}".`,
    data: { programId, enrollmentId: enrollment.id },
    emailFor: (r) =>
      enrolledInProgramEmail({
        fullName: r.fullName,
        programName: program.name,
        fieldNames: enrollment.fields.map((f) => f.field_name),
      }),
  });
  broadcastToAdmins("enrollments", { programId });
  if (assessorId) {
    void notifyUser({
      userId: input.farmerId,
      type: "assessor_assigned",
      title: "An assessor was assigned",
      body: `An assessor has been assigned for "${program.name}".`,
      data: { programId, enrollmentId: enrollment.id },
      emailFor: (r) =>
        assessorAssignedEmail({
          fullName: r.fullName,
          assessorName: enrollment.assessor_name,
          programName: program.name,
        }),
    });
  }

  return enrollment;
}

export async function updateEnrollmentFields(
  programId: string,
  enrollmentId: string,
  fieldIds: string[]
): Promise<PublicEnrollment> {
  const enrollment = await findEnrollmentById(enrollmentId);
  if (!enrollment || enrollment.program_id !== programId) {
    throw ApiError.notFound("Enrollment not found.");
  }
  await assertFieldsOwnedByFarmer(fieldIds, enrollment.farmer_id);

  const updated = await setEnrollmentFields(enrollmentId, fieldIds);
  if (!updated) throw ApiError.notFound("Enrollment not found.");
  return updated;
}

export async function updateEnrollmentAssessor(
  programId: string,
  enrollmentId: string,
  assessorId: string | null,
  actor: Actor
): Promise<PublicEnrollment> {
  const enrollment = await findEnrollmentById(enrollmentId);
  if (!enrollment || enrollment.program_id !== programId) {
    throw ApiError.notFound("Enrollment not found.");
  }
  await assertAssessor(assessorId);

  const updated = await setEnrollmentAssessor(enrollmentId, assessorId);
  if (!updated) throw ApiError.notFound("Enrollment not found.");

  await syncAssessorAssignment(enrollment.farmer_id, assessorId, actor.id);

  if (assessorId) {
    void notifyUser({
      userId: enrollment.farmer_id,
      type: "assessor_assigned",
      title: "An assessor was assigned",
      body: "An assessor has been assigned to your enrollment.",
      data: { programId, enrollmentId },
      emailFor: (r) =>
        assessorAssignedEmail({
          fullName: r.fullName,
          assessorName: updated.assessor_name,
        }),
    });
  }

  return updated;
}

export async function unenroll(
  programId: string,
  enrollmentId: string
): Promise<void> {
  const enrollment = await findEnrollmentById(enrollmentId);
  if (!enrollment || enrollment.program_id !== programId) {
    throw ApiError.notFound("Enrollment not found.");
  }
  await softDeleteEnrollment(enrollmentId);
}

export async function getAvailableProgramsForFarmer(
  farmerId: string
): Promise<AvailableProgram[]> {
  return listAvailableProgramsForFarmer(farmerId);
}

export async function getEnrollableFieldsForFarmer(
  farmerId: string
): Promise<EnrollableField[]> {
  return listEnrollableFieldsForFarmer(farmerId);
}

export interface SelfEnrollInput {
  fieldIds: string[];
  note?: string | null;
}

export async function selfEnroll(
  programId: string,
  farmerId: string,
  input: SelfEnrollInput
): Promise<PublicEnrollment> {
  const program = await findProgramById(programId);
  if (!program) throw ApiError.notFound("Program not found.");
  assertProgramEnrollable(program);

  const dup = await findEnrollment(programId, farmerId);
  if (dup) {
    throw ApiError.conflict("You are already enrolled in this program.");
  }

  if (program.user_limit !== null) {
    const enrolled = await countEnrollments(programId);
    if (enrolled >= program.user_limit) {
      throw ApiError.badRequest("This program is full.");
    }
  }

  await assertFieldsOwnedByFarmer(input.fieldIds, farmerId);

  const enrollment = await createEnrollment({
    programId,
    farmerId,
    fieldIds: input.fieldIds,
    assessorId: null,
    enrolledBy: farmerId,
    note: nn(input.note),
  });

  void notifyUser({
    userId: farmerId,
    type: "enrolled_in_program",
    title: "Enrolled in a program",
    body: `You have enrolled in "${program.name}".`,
    data: { programId, enrollmentId: enrollment.id },
    emailFor: (r) =>
      enrolledInProgramEmail({
        fullName: r.fullName,
        programName: program.name,
        fieldNames: enrollment.fields.map((f) => f.field_name),
      }),
  });
  broadcastToAdmins("enrollments", { programId });

  return enrollment;
}

export interface ListSubmissionsInput {
  page: number;
  limit: number;
  programId?: string;
  authorRole?: "farmer" | "assessor";
}

function toSubmission(r: SubmissionRow) {
  return {
    fieldId: r.field_id,
    fieldName: r.field_name,
    farmName: r.farm_name,
    farmerId: r.farmer_id,
    farmerName: r.farmer_name,
    authorRole: r.author_role,
    authorId: r.author_id,
    authorName: r.author_name,
    programId: r.program_id,
    programName: r.program_name,
    answered: r.answered,
    totalQuestions: r.total_questions,
    percentage: Number(r.percentage),
    submittedAt: r.submitted_at ? r.submitted_at.toISOString() : null,
  };
}

export async function getSubmissions(input: ListSubmissionsInput) {
  const { rows, total } = await listSubmissions({
    programId: input.programId,
    authorRole: input.authorRole,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  });
  return {
    submissions: rows.map(toSubmission),
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export interface EnrollmentFieldAssessment {
  field: { id: string; name: string; farm_name: string | null };
  farmer: { submitted: boolean; percentage: number | null };
  assessor: { submitted: boolean; percentage: number | null };
}

export interface EnrollmentAssessmentsResult {
  enrollment: {
    id: string;
    farmer_id: string;
    farmer_name: string | null;
    assessor_id: string | null;
    assessor_name: string | null;
  };
  fields: EnrollmentFieldAssessment[];
}

export async function getEnrollmentAssessments(
  programId: string,
  enrollmentId: string
): Promise<EnrollmentAssessmentsResult> {
  const enrollment = await findEnrollmentById(enrollmentId);
  if (!enrollment || enrollment.program_id !== programId) {
    throw ApiError.notFound("Enrollment not found.");
  }

  const fields: EnrollmentFieldAssessment[] = [];
  for (const f of enrollment.fields) {
    const farmerSub = await prisma.field_assessments.findFirst({
      where: { field_id: f.field_id, author_role: "farmer" },
      select: { status: true, percentage: true },
    });
    const assessorSub = await prisma.field_assessments.findFirst({
      where: { field_id: f.field_id, author_role: "assessor" },
      select: { status: true, percentage: true },
    });
    fields.push({
      field: { id: f.field_id, name: f.field_name, farm_name: f.farm_name },
      farmer: {
        submitted: farmerSub?.status === "submitted",
        percentage: farmerSub ? Number(farmerSub.percentage) : null,
      },
      assessor: {
        submitted: assessorSub?.status === "submitted",
        percentage: assessorSub ? Number(assessorSub.percentage) : null,
      },
    });
  }

  return {
    enrollment: {
      id: enrollment.id,
      farmer_id: enrollment.farmer_id,
      farmer_name: enrollment.farmer_name,
      assessor_id: enrollment.assessor_id,
      assessor_name: enrollment.assessor_name,
    },
    fields,
  };
}
