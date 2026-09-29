import ApiError from "../utils/ApiError.js";
import type { QuestionKind } from "../validators/assessment.schema.js";
import { surveyPublicLink } from "./programAdminSurvey.service.js";
import {
  resolveProgramSource,
  createProgramCopy,
  holdingTemplateId,
  programHasAnswers,
  assertTemplateNameFree,
  TEMPLATE_TX,
} from "./assessmentTemplate.service.js";
import { softDeleteTemplates } from "../models/assessmentTemplate.model.js";
import {
  holdsEnrollmentIdForProgram,
  enrollmentIdForProgram,
  issueEnrollmentId,
} from "../models/enrollmentId.model.js";
import prisma from "../db/prisma.js";
import { findById } from "../models/user.model.js";
import { getDefaultOrgId } from "./tenancy.service.js";
import { orgToday } from "../utils/datetime.js";
import {
  summarizeProgramDeletion,
  deleteProgramCascade,
  type DeletionLine,
} from "./cascadeDelete.service.js";
import {
  createProgram,
  listPrograms,
  findProgramById,
  updateProgram,
  programCodeExists,
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
  programHasSurvey,
  setProgramVisibility as setVisibility,
  getProgramAssessmentProgress,
  type PublicProgram,
  type PublicEnrollment,
  type SubmissionRow,
  type AvailableProgram,
  type EnrollableField,
  type ProgramStatusFilter,
} from "../models/program.model.js";
import {
  setFarmerAssessor,
  clearFarmerAssessor,
} from "../models/assessorAssignment.model.js";
import {
  findFieldAssessment,
  countFieldResponses,
} from "../models/assessmentMobile.model.js";
import { notifyUser, notifyUsers } from "./notification.service.js";
import { broadcastToAdmins } from "./realtime.service.js";
import { emitSync } from "../socket/liveSync.js";
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
  assessmentTemplateId?: string | null;
  // Only with "blank": which kind of questions the new assessment holds.
  questionKind?: QuestionKind;
  // The name the program's own assessment is listed and reused under.
  assessmentTemplateName?: string;
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

/**
 * A short code built from the program's name: the initial of each word, then a
 * number that makes it unique in the organization. "New Test Program" becomes
 * NTP-001, and NTP-002 if that is taken.
 */
export async function suggestProgramCode(name: string): Promise<string> {
  const orgId = await getDefaultOrgId();
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const letters = words
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join("")
    .slice(0, 4);
  // One word gives no initials worth reading, so take the start of it instead.
  const prefix =
    letters.length >= 2
      ? letters
      : (words[0] ?? "").replace(/[^A-Z]/g, "").slice(0, 3) || "PRG";

  if (!orgId) return `${prefix}-001`;
  for (let n = 1; n <= 999; n += 1) {
    const code = `${prefix}-${String(n).padStart(3, "0")}`;
    if (!(await programCodeExists(orgId, code))) return code;
  }
  // Every number taken, which needs a different shape rather than a 1000th try.
  return `${prefix}-${Date.now().toString().slice(-6)}`;
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

  // Left blank, a program still gets a code - it is what people quote when
  // they talk about the scheme.
  const code = nn(input.code) ?? (await suggestProgramCode(input.name));
  if (code && (await programCodeExists(orgId, code))) {
    throw ApiError.conflict("A program with this code already exists.");
  }

  // Every program answers its own copy of a template, so later edits to that template never reach it.
  const source = await resolveProgramSource(input.assessmentTemplateId, actor);
  if (input.assessmentTemplateName?.trim()) {
    await assertTemplateNameFree(actor, input.assessmentTemplateName.trim());
  }
  const holdingId = await holdingTemplateId(source);
  const name = input.name.trim();
  const createdId = await prisma.$transaction(async (tx) => {
    // The program points at a template until its copy exists, so the copy is inserted already tied to the program.
    const created = await createProgram(
      {
        orgId,
        name,
        code,
        description: nn(input.description),
        type: nn(input.type),
        startDate: nn(input.startDate),
        endDate: nn(input.endDate),
        userLimit: input.userLimit ?? null,
        isActive: input.isActive ?? true,
        createdBy: actor.id,
        assessmentTemplateId: holdingId,
      },
      tx
    );
    const copyId = await createProgramCopy(
      tx,
      source,
      { id: created.id, name },
      actor,
      input.questionKind,
      input.assessmentTemplateName
    );
    await tx.programs.update({
      where: { id: created.id },
      data: { assessment_template_id: copyId },
    });
    return created.id;
  }, TEMPLATE_TX);
  const program = await getProgramById(createdId);

  void notifyOrgFarmersOfNewProgram(orgId, program);
  broadcastToAdmins("programs", { programId: program.id });

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
  status?: ProgramStatusFilter;
  search?: string;
  /** Set for a program administrator, who only sees their own programs. */
  createdBy?: string;
}

export async function getPrograms(input: ListProgramsInput): Promise<{
  programs: PublicProgram[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { rows, total } = await listPrograms({
    status: input.status,
    // Ended and Scheduled are decided against the office's own day.
    today: input.status ? await orgToday() : undefined,
    search: input.search,
    createdBy: input.createdBy,
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
  assessmentTemplateId?: string | null;
  // Only with "blank": which kind of questions the new assessment holds.
  questionKind?: QuestionKind;
  // The name the program's own assessment is listed and reused under.
  assessmentTemplateName?: string;
}

export async function editProgram(
  id: string,
  input: UpdateProgramInput,
  actor: Actor
): Promise<PublicProgram> {
  const existing = await findProgramById(id);
  if (!existing) throw ApiError.notFound("Program not found.");

  const start = input.startDate !== undefined ? nn(input.startDate) : existing.start_date;
  const end = input.endDate !== undefined ? nn(input.endDate) : existing.end_date;
  if (start && end && end < start) {
    throw ApiError.badRequest("End date cannot be before start date.");
  }

  if (input.code !== undefined) {
    const code = nn(input.code);
    if (code && (await programCodeExists(existing.org_id, code, id))) {
      throw ApiError.conflict("Another program already uses this code.");
    }
  }

  if (input.userLimit !== undefined && input.userLimit !== null) {
    const enrolled = await countEnrollments(id);
    if (input.userLimit < enrolled) {
      throw ApiError.badRequest(
        `Limit (${input.userLimit}) is below the ${enrolled} farmer(s) already enrolled.`
      );
    }
  }

  // Moving the start date into the future would retroactively make already
  // enrolled fields unassessable and hide submitted work from the farmer.
  if (input.startDate !== undefined) {
    const newStart = nn(input.startDate);
    if (newStart && newStart > todayStr() && newStart !== existing.start_date) {
      const enrolled = await countEnrollments(id);
      if (enrolled > 0) {
        throw ApiError.badRequest(
          `This program already has ${enrolled} enrolled farmer(s), so its start date cannot be moved into the future.`
        );
      }
    }
  }

  if (input.assessmentTemplateId !== undefined) {
    await changeProgramTemplate(
      existing,
      input.assessmentTemplateId,
      input.name?.trim() || existing.name,
      actor,
      input.questionKind,
      input.assessmentTemplateName
    );
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
  broadcastToAdmins("programs", { programId: id });
  return updated;
}

/** The program, plus whether its assessment template may still be swapped. */
export async function getProgramDetail(
  id: string
): Promise<PublicProgram & { assessment_template_changeable: boolean }> {
  const program = await getProgramById(id);
  return { ...program, assessment_template_changeable: !(await programHasAnswers(id)) };
}

const TEMPLATE_ANSWERED =
  "Answers have already been given in this program, so its assessment template can no longer be changed.";

// Swaps the program's copy for a fresh copy of another template, only while nothing has been answered.
async function changeProgramTemplate(
  program: PublicProgram,
  templateId: string | null,
  programName: string,
  actor: Actor,
  questionKind?: QuestionKind,
  templateName?: string
): Promise<void> {
  const name = templateName?.trim();
  // The program's own assessment is listed by this name, so it cannot clash with another.
  if (name) await assertTemplateNameFree(actor, name, program.assessment_template_id);

  const unchanged = (id: string): boolean =>
    id === program.assessment_source_template_id || id === program.assessment_template_id;
  // Picking what is already in use keeps it; a name given with it only renames it.
  const keep = async (): Promise<void> => {
    if (!name) return;
    await prisma.assessment_templates.update({
      where: { id: program.assessment_template_id },
      data: { name, updated_at: new Date() },
    });
  };
  // The template already in use is accepted as is, even if it has since been hidden, switched off or deleted.
  if (templateId === "blank" ? program.assessment_source_template_id === null : templateId && unchanged(templateId)) {
    return keep();
  }
  const source = await resolveProgramSource(templateId, actor);
  if (source && unchanged(source.id)) return keep();

  if (await programHasAnswers(program.id)) throw ApiError.conflict(TEMPLATE_ANSWERED);
  await prisma.$transaction(async (tx) => {
    // Saving an answer checks this row through its foreign key, so holding it keeps answers out until the swap is done.
    await tx.$queryRaw`SELECT id FROM programs WHERE id = ${program.id}::uuid FOR UPDATE`;
    if (await programHasAnswers(program.id, tx)) throw ApiError.conflict(TEMPLATE_ANSWERED);
    const now = new Date();
    // Only the program's own copy goes; a template other programs still use stays.
    const previous = await tx.assessment_templates.findMany({
      where: { program_id: program.id, deleted_at: null },
      select: { id: true },
    });
    await softDeleteTemplates(tx, previous.map((t) => t.id), now);
    const copyId = await createProgramCopy(
      tx,
      source,
      { id: program.id, name: programName },
      actor,
      questionKind,
      name
    );
    await tx.programs.update({
      where: { id: program.id },
      data: { assessment_template_id: copyId, updated_at: now },
    });
  }, TEMPLATE_TX);
}

/** What deleting this program would take with it, for the confirmation. */
export async function getProgramDeletionSummary(
  id: string
): Promise<DeletionLine[]> {
  await getProgramById(id);
  return summarizeProgramDeletion(id);
}

/**
 * Deletes a program and everything that only existed as part of it: its
 * survey and the submissions to it, the enrollments, the assessments and the
 * visits. Nothing is left behind to be counted or listed without the program
 * that explained it. The panel warns before calling this.
 */
export async function removeProgram(id: string): Promise<void> {
  await getProgramById(id);
  const ok = await deleteProgramCascade(id);
  if (!ok) throw ApiError.notFound("Program not found.");
  broadcastToAdmins("programs", { programId: id });
  broadcastToAdmins("enrollments");
  broadcastToAdmins("program_admin_survey");
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
    select: {
      id: true,
      name: true,
      is_active: true,
      farms: { select: { name: true, is_active: true } },
    },
  });
  if (owned.length !== fieldIds.length) {
    throw ApiError.badRequest(
      "One or more selected fields do not belong to this farmer."
    );
  }

  // An inactive farm or field cannot be taken into a program.
  const inactiveFarm = owned.find((f) => !f.farms.is_active);
  if (inactiveFarm) {
    throw ApiError.badRequest(
      `The farm "${inactiveFarm.farms.name}" is inactive, so its fields cannot be enrolled in a program.`
    );
  }
  const inactiveField = owned.find((f) => !f.is_active);
  if (inactiveField) {
    throw ApiError.badRequest(
      `The field "${inactiveField.name}" is inactive and cannot be enrolled in a program.`
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
    // Their survey ID when they have one, otherwise a fresh one so a
    // hand-made enrolment still carries an ID like every other.
    enrollmentId:
      (await enrollmentIdForProgram(input.farmerId, programId)) ??
      (await issueEnrollmentId()),
  });

  await syncAssessorAssignment(input.farmerId, assessorId, actor.id);

  void notifyUser({
    userId: input.farmerId,
    type: "enrolled_in_program",
    title: "Enrolled in a program",
    body: `You have been enrolled in "${program.name}". New fields are now available: you can add soil details (pH, nutrients, moisture) for your field(s).`,
    data: { programId, enrollmentId: enrollment.id },
    emailFor: (r) =>
      enrolledInProgramEmail({
        fullName: r.fullName,
        programName: program.name,
        fieldNames: enrollment.fields.map((f) => f.field_name),
      }),
  });
  broadcastToAdmins("enrollments", { programId });
  // Live sync the farmer (enrolled by an admin), and the assessor if assigned.
  emitSync(input.farmerId, {
    resource: "enrollment",
    action: "enrolled",
    programId,
    enrollmentId: enrollment.id,
  });
  if (assessorId) {
    emitSync(assessorId, {
      resource: "enrollment",
      action: "enrolled",
      programId,
      enrollmentId: enrollment.id,
    });
    // Notify the farmer their assessor was assigned...
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
    // ...and notify the assessor they have a new assignment.
    void notifyUser({
      userId: assessorId,
      type: "assessor_assigned",
      title: "New assessment assignment",
      body: `You have been assigned to assess ${farmer.full_name ?? "a farmer"} in "${program.name}".`,
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

  // Any field being dropped from the enrollment must have no assessment work on
  // it, otherwise that assessment is orphaned: it disappears from the farmer's
  // history while still showing in the admin submissions list.
  const removed = enrollment.fields
    .map((f) => f.field_id)
    .filter((id) => !fieldIds.includes(id));
  if (removed.length > 0) {
    await assertFieldsDetachable(programId, removed);
  }

  const updated = await setEnrollmentFields(enrollmentId, fieldIds);
  if (!updated) throw ApiError.notFound("Enrollment not found.");
  broadcastToAdmins("enrollments", { programId });
  emitSync(enrollment.farmer_id, {
    resource: "enrollment",
    action: "updated",
    programId,
    enrollmentId,
  });
  if (enrollment.assessor_id) {
    emitSync(enrollment.assessor_id, {
      resource: "enrollment",
      action: "updated",
      programId,
      enrollmentId,
    });
  }
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

  // Sync the farmer, the newly assigned assessor, and the previous assessor (so
  // the assignment leaves their app too).
  emitSync(enrollment.farmer_id, {
    resource: "enrollment",
    action: "updated",
    programId,
    enrollmentId,
  });
  if (assessorId) {
    emitSync(assessorId, { resource: "enrollment", action: "updated", programId, enrollmentId });
  }
  if (enrollment.assessor_id && enrollment.assessor_id !== assessorId) {
    emitSync(enrollment.assessor_id, { resource: "enrollment", action: "updated", programId, enrollmentId });
  }

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
    void notifyUser({
      userId: assessorId,
      type: "assessor_assigned",
      title: "New assessment assignment",
      body: `You have been assigned to assess ${enrollment.farmer_name ?? "a farmer"}.`,
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

  // Unenrolling detaches every field, so the same protection applies: a farmer's
  // submitted assessment must not silently vanish from their history.
  await assertFieldsDetachable(
    programId,
    enrollment.fields.map((f) => f.field_id)
  );

  await softDeleteEnrollment(enrollmentId);
  broadcastToAdmins("enrollments", { programId });
  emitSync(enrollment.farmer_id, {
    resource: "enrollment",
    action: "unenrolled",
    programId,
    enrollmentId,
  });
  if (enrollment.assessor_id) {
    emitSync(enrollment.assessor_id, {
      resource: "enrollment",
      action: "unenrolled",
      programId,
      enrollmentId,
    });
  }
}

/**
 * What a farmer already on the platform is offered. Only programs someone has
 * opened up to farmers come back, each with the link to its survey so the app
 * can send them straight there.
 */
export type AvailableProgramForFarmer = Omit<AvailableProgram, "survey_token"> & {
  survey_url: string | null;
};

export async function getAvailableProgramsForFarmer(
  farmerId: string
): Promise<AvailableProgramForFarmer[]> {
  const rows = await listAvailableProgramsForFarmer(farmerId);
  return rows.map(({ survey_token, ...rest }) => ({
    ...rest,
    survey_url: survey_token ? surveyPublicLink(survey_token) : null,
  }));
}

/**
 * Turn the offer to existing farmers on or off. It can only go on once the
 * program has a survey, because that survey is where the farmer is sent.
 */
export async function setProgramShownToFarmers(
  id: string,
  showToFarmers: boolean
): Promise<PublicProgram> {
  await getProgramById(id); // 404s if it is gone
  if (showToFarmers && !(await programHasSurvey(id))) {
    throw ApiError.conflict(
      "Add a survey to this program before showing it to enrolled farmers."
    );
  }
  const updated = await setVisibility(id, showToFarmers);
  if (!updated) throw ApiError.notFound("Program not found.");
  return updated;
}

export interface EnrollableFieldsInput {
  farmerId: string;
  page: number;
  limit: number;
  search?: string;
}

export async function getEnrollableFieldsForFarmer(input: EnrollableFieldsInput): Promise<{
  fields: EnrollableField[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const offset = (input.page - 1) * input.limit;
  const { rows, total } = await listEnrollableFieldsForFarmer({
    farmerId: input.farmerId,
    search: input.search,
    limit: input.limit,
    offset,
  });
  return {
    fields: rows,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
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
  // Enrolling yourself needs the Enrollment ID for this exact program, which is
  // only issued once its survey has been completed and accepted. The list
  // already reflects this, but a farmer can still hold a program id from a
  // cached screen or an old link, so the rule is enforced on the way in too.
  // Only self-enrollment is gated: your team can still enroll anyone by hand.
  if (!(await holdsEnrollmentIdForProgram(farmerId, programId))) {
    throw ApiError.badRequest(
      "Please complete this program's survey first. You can enroll once your Enrollment ID for it has been issued."
    );
  }

  await assertFieldsOwnedByFarmer(input.fieldIds, farmerId);

  const existing = await findEnrollment(programId, farmerId);
  if (existing) {
    // Already enrolled: ADD the selected fields to the same enrollment. Existing
    // fields are always kept (this flow never unenrolls). Fields already enrolled
    // are ignored (no duplicates), so the call is idempotent.
    const current = await findEnrollmentById(existing.id);
    const currentIds = current ? current.fields.map((f) => f.field_id) : [];
    const added = input.fieldIds.filter((id) => !currentIds.includes(id));
    const union = Array.from(new Set([...currentIds, ...input.fieldIds]));
    const updated = await setEnrollmentFields(existing.id, union);

    if (added.length > 0) {
      const addedNames = (updated?.fields ?? [])
        .filter((f) => added.includes(f.field_id))
        .map((f) => f.field_name);
      void notifyUser({
        userId: farmerId,
        type: "enrolled_in_program",
        title: "Fields added to a program",
        body: `You added ${added.length} field(s) to "${program.name}". New fields are now available: you can add soil details (pH, nutrients, moisture) for them.`,
        data: { programId, enrollmentId: existing.id },
        emailFor: (r) =>
          enrolledInProgramEmail({
            fullName: r.fullName,
            programName: program.name,
            fieldNames: addedNames,
          }),
      });
      broadcastToAdmins("enrollments", { programId });
      emitSync(farmerId, {
        resource: "enrollment",
        action: "enrolled",
        programId,
        enrollmentId: existing.id,
      });
    }

    return updated ?? current!;
  }

  if (program.user_limit !== null) {
    const enrolled = await countEnrollments(programId);
    if (enrolled >= program.user_limit) {
      throw ApiError.badRequest("This program is full.");
    }
  }

  const enrollment = await createEnrollment({
    programId,
    farmerId,
    fieldIds: input.fieldIds,
    assessorId: null,
    enrolledBy: farmerId,
    note: nn(input.note),
    enrollmentId: await enrollmentIdForProgram(farmerId, programId),
  });

  void notifyUser({
    userId: farmerId,
    type: "enrolled_in_program",
    title: "Enrolled in a program",
    body: `You have enrolled in "${program.name}". New fields are now available: you can add soil details (pH, nutrients, moisture) for your field(s).`,
    data: { programId, enrollmentId: enrollment.id },
    emailFor: (r) =>
      enrolledInProgramEmail({
        fullName: r.fullName,
        programName: program.name,
        fieldNames: enrollment.fields.map((f) => f.field_name),
      }),
  });
  broadcastToAdmins("enrollments", { programId });
  emitSync(farmerId, {
    resource: "enrollment",
    action: "enrolled",
    programId,
    enrollmentId: enrollment.id,
  });

  return enrollment;
}

// A field may only be detached from a program while nothing has been assessed on
// it. Checks BOTH roles: a farmer must not be able to destroy an assessor's work
// (and vice versa), and an admin must not silently orphan a submitted assessment
// (which would vanish from the farmer's history while still showing to admins).
async function assertFieldsDetachable(
  programId: string,
  fieldIds: string[]
): Promise<void> {
  for (const fieldId of fieldIds) {
    for (const role of ["farmer", "assessor"] as const) {
      const submission = await findFieldAssessment(fieldId, programId, role);
      if (submission?.status === "submitted") {
        throw ApiError.conflict(
          role === "farmer"
            ? "This field has a submitted assessment and cannot be removed from the program."
            : "This field has a submitted assessor assessment and cannot be removed from the program."
        );
      }
      const answered = await countFieldResponses(fieldId, programId, role);
      if (answered > 0) {
        throw ApiError.conflict(
          role === "farmer"
            ? "This field has an assessment in progress. Discard the assessment first, then remove the field."
            : "This field has an assessor assessment in progress. It must be discarded before the field can be removed."
        );
      }
    }
  }
}

export interface SelfUnenrollResult {
  programId: string;
  fieldId: string;
  unenrolled: true;
  enrollmentRemoved: boolean;
}

// A farmer removes one of their own fields from a program. Allowed only while the
// field's assessment has not been started; an in-progress assessment must be
// discarded first, and a submitted one blocks unenrollment entirely.
export async function selfUnenrollField(
  programId: string,
  fieldId: string,
  farmerId: string
): Promise<SelfUnenrollResult> {
  const enrollment = await findEnrollment(programId, farmerId);
  if (!enrollment) {
    throw ApiError.notFound("You are not enrolled in this program.");
  }

  const full = await findEnrollmentById(enrollment.id);
  const currentIds = full ? full.fields.map((f) => f.field_id) : [];
  if (!currentIds.includes(fieldId)) {
    throw ApiError.notFound("This field is not enrolled in this program.");
  }

  const submission = await findFieldAssessment(fieldId, programId, "farmer");
  if (submission?.status === "submitted") {
    throw ApiError.conflict(
      "You cannot unenroll this field because you have already submitted its assessment."
    );
  }

  const answered = await countFieldResponses(fieldId, programId, "farmer");
  if (answered > 0) {
    throw ApiError.conflict(
      "You have an assessment in progress for this field. Discard the assessment first, then unenroll the field."
    );
  }

  // Also protect the assessor's work on this field.
  await assertFieldsDetachable(programId, [fieldId]);

  // Not started: remove just this field. If it was the last one, drop the whole
  // enrollment so no empty enrollment is left behind.
  const remaining = currentIds.filter((id) => id !== fieldId);
  let enrollmentRemoved = false;
  if (remaining.length === 0) {
    await softDeleteEnrollment(enrollment.id);
    enrollmentRemoved = true;
  } else {
    await setEnrollmentFields(enrollment.id, remaining);
  }

  broadcastToAdmins("enrollments", { programId });
  emitSync(farmerId, {
    resource: "enrollment",
    action: "unenrolled",
    programId,
    fieldId,
    enrollmentId: enrollment.id,
  });
  // Tell the assigned assessor too, so the field the farmer just left drops off
  // their list in real time (the same notice admin-side unenroll already sends).
  if (full?.assessor_id) {
    emitSync(full.assessor_id, {
      resource: "enrollment",
      action: "unenrolled",
      programId,
      fieldId,
      enrollmentId: enrollment.id,
    });
  }
  return { programId, fieldId, unenrolled: true, enrollmentRemoved };
}

export interface ListSubmissionsInput {
  page: number;
  limit: number;
  programId?: string;
  fieldId?: string;
  authorRole?: "farmer" | "assessor";
  reviewStatus?: "in_review" | "approved";
  /** Set for a program administrator: only their own programs' submissions. */
  programOwnerId?: string;
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
    assessmentId: r.assessment_id,
    reviewStatus: r.review_status as "in_review" | "approved",
    submittedAt: r.submitted_at ? r.submitted_at.toISOString() : null,
  };
}

export async function getSubmissions(input: ListSubmissionsInput) {
  const { rows, total } = await listSubmissions({
    programId: input.programId,
    fieldId: input.fieldId,
    authorRole: input.authorRole,
    reviewStatus: input.reviewStatus,
    programOwnerId: input.programOwnerId,
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

/** One side of a field's assessment, with the id the review screen opens on. */
export interface EnrollmentAssessmentSide {
  submitted: boolean;
  percentage: number | null;
  assessmentId: string | null;
  reviewStatus: "in_review" | "approved" | null;
}

export interface EnrollmentFieldAssessment {
  field: { id: string; name: string; farm_name: string | null };
  farmer: EnrollmentAssessmentSide;
  assessor: EnrollmentAssessmentSide;
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

export interface ProgramProgressResult {
  totalFields: number;
  farmerSubmitted: number;
  assessorSubmitted: number;
  farmerPct: number;
  assessorPct: number;
}

export async function getProgramProgress(
  programId: string
): Promise<ProgramProgressResult> {
  const program = await findProgramById(programId);
  if (!program) throw ApiError.notFound("Program not found.");

  const p = await getProgramAssessmentProgress(programId);
  const pct = (n: number): number =>
    p.total_fields > 0 ? Math.round((n / p.total_fields) * 1000) / 10 : 0;

  return {
    totalFields: p.total_fields,
    farmerSubmitted: p.farmer_submitted,
    assessorSubmitted: p.assessor_submitted,
    farmerPct: pct(p.farmer_submitted),
    assessorPct: pct(p.assessor_submitted),
  };
}

// One submission as the status table reads it, submitted or not.
function assessmentSide(
  row: { id: string; status: string; percentage: unknown; review_status: string | null } | null
): EnrollmentAssessmentSide {
  const submitted = row?.status === "submitted";
  return {
    submitted,
    percentage: row ? Number(row.percentage) : null,
    assessmentId: submitted ? row.id : null,
    reviewStatus: submitted ? (row.review_status as "in_review" | "approved") : null,
  };
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
      where: { field_id: f.field_id, program_id: programId, author_role: "farmer" },
      select: { id: true, status: true, percentage: true, review_status: true },
    });
    const assessorSub = await prisma.field_assessments.findFirst({
      where: { field_id: f.field_id, program_id: programId, author_role: "assessor" },
      select: { id: true, status: true, percentage: true, review_status: true },
    });
    fields.push({
      field: { id: f.field_id, name: f.field_name, farm_name: f.farm_name },
      farmer: assessmentSide(farmerSub),
      assessor: assessmentSide(assessorSub),
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
