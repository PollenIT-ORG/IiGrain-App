import ApiError from "../utils/ApiError.js";
import { findById } from "../models/user.model.js";
import { getDefaultOrgId } from "./tenancy.service.js";
import {
  createAssignment,
  listAssignments,
  findLiveAssignment,
  softDeleteAssignment,
  findAssignmentById,
  type PublicAssignment,
} from "../models/assessorAssignment.model.js";
import { notifyUser } from "./notification.service.js";
import { assessorAssignedEmail } from "./emailTemplates.js";

async function assertUserRole(
  userId: string,
  expectedRole: string,
  label: string
): Promise<void> {
  const user = await findById(userId);
  if (!user) throw ApiError.notFound(`The selected ${label} was not found.`);
  if (user.role_name !== expectedRole) {
    throw ApiError.badRequest(`The selected ${label} is not a ${expectedRole}.`);
  }
}

interface AssignInput {
  assessorId: string;
  farmerId: string;
  note?: string;
}

export interface Actor {
  id: string;
  role: string;
}

export async function assignAssessor(
  input: AssignInput,
  actor: Actor
): Promise<PublicAssignment> {
  await assertUserRole(input.assessorId, "assessor", "assessor");
  await assertUserRole(input.farmerId, "farmer", "farmer");

  const existing = await findLiveAssignment(input.assessorId, input.farmerId);
  if (existing) {
    throw ApiError.conflict(
      "This assessor is already assigned to this farmer."
    );
  }

  const orgId = await getDefaultOrgId();

  const assignment = await createAssignment({
    assessorId: input.assessorId,
    farmerId: input.farmerId,
    assignedBy: actor.id,
    orgId,
    note: input.note?.trim() ? input.note.trim() : null,
  });

  void notifyUser({
    userId: input.farmerId,
    type: "assessor_assigned",
    title: "An assessor was assigned",
    body: assignment.assessor_name
      ? `${assignment.assessor_name} has been assigned as your assessor.`
      : "An assessor has been assigned to you.",
    data: { assignmentId: assignment.id, assessorId: input.assessorId },
    emailFor: (r) =>
      assessorAssignedEmail({
        fullName: r.fullName,
        assessorName: assignment.assessor_name,
      }),
  });

  return assignment;
}

interface ListInput {
  assessorId?: string;
  farmerId?: string;
  page: number;
  limit: number;
}

export async function getAssignments(input: ListInput): Promise<{
  rows: PublicAssignment[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { rows, total } = await listAssignments({
    assessorId: input.assessorId,
    farmerId: input.farmerId,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  });
  return {
    rows,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function unassign(id: string): Promise<void> {
  const found = await findAssignmentById(id);
  if (!found) throw ApiError.notFound("Assignment not found.");
  await softDeleteAssignment(id);
}
