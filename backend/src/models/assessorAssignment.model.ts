import prisma from "../db/prisma.js";
import { softDelete } from "../db/softDelete.js";

export interface PublicAssignment {
  id: string;
  assessor_id: string;
  assessor_name: string | null;
  assessor_email: string;
  farmer_id: string;
  farmer_name: string | null;
  farmer_email: string;
  assigned_by: string | null;
  org_id: string | null;
  note: string | null;
  created_at: Date;
  updated_at: Date;
}

const ASSIGNMENT_SELECT = {
  id: true,
  assessor_id: true,
  farmer_id: true,
  assigned_by: true,
  org_id: true,
  note: true,
  created_at: true,
  updated_at: true,
  users_assessor_assignments_assessor_idTousers: {
    select: { full_name: true, email: true },
  },
  users_assessor_assignments_farmer_idTousers: {
    select: { full_name: true, email: true },
  },
};

type AssignmentRow = {
  id: string;
  assessor_id: string;
  farmer_id: string;
  assigned_by: string | null;
  org_id: string | null;
  note: string | null;
  created_at: Date;
  updated_at: Date;
  users_assessor_assignments_assessor_idTousers: { full_name: string | null; email: string };
  users_assessor_assignments_farmer_idTousers: { full_name: string | null; email: string };
};

function toPublic(a: AssignmentRow): PublicAssignment {
  return {
    id: a.id,
    assessor_id: a.assessor_id,
    assessor_name: a.users_assessor_assignments_assessor_idTousers.full_name,
    assessor_email: a.users_assessor_assignments_assessor_idTousers.email,
    farmer_id: a.farmer_id,
    farmer_name: a.users_assessor_assignments_farmer_idTousers.full_name,
    farmer_email: a.users_assessor_assignments_farmer_idTousers.email,
    assigned_by: a.assigned_by,
    org_id: a.org_id,
    note: a.note,
    created_at: a.created_at,
    updated_at: a.updated_at,
  };
}

export async function findLiveAssignment(
  assessorId: string,
  farmerId: string
): Promise<{ id: string } | null> {
  return prisma.assessor_assignments.findFirst({
    where: { assessor_id: assessorId, farmer_id: farmerId, deleted_at: null },
    select: { id: true },
  });
}

interface CreateAssignmentParams {
  assessorId: string;
  farmerId: string;
  assignedBy: string | null;
  orgId: string | null;
  note: string | null;
}

export async function createAssignment(
  p: CreateAssignmentParams
): Promise<PublicAssignment> {
  const created = await prisma.assessor_assignments.create({
    data: {
      assessor_id: p.assessorId,
      farmer_id: p.farmerId,
      assigned_by: p.assignedBy,
      org_id: p.orgId,
      note: p.note,
    },
    select: ASSIGNMENT_SELECT,
  });
  return toPublic(created as AssignmentRow);
}

export interface ListAssignmentsFilters {
  assessorId?: string;
  farmerId?: string;
  orgId?: string;
  limit: number;
  offset: number;
}

export async function listAssignments(
  filters: ListAssignmentsFilters
): Promise<{ rows: PublicAssignment[]; total: number }> {
  const where: Record<string, unknown> = { deleted_at: null };
  if (filters.assessorId) where.assessor_id = filters.assessorId;
  if (filters.farmerId) where.farmer_id = filters.farmerId;
  if (filters.orgId) where.org_id = filters.orgId;

  const [rows, total] = await Promise.all([
    prisma.assessor_assignments.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: filters.limit,
      skip: filters.offset,
      select: ASSIGNMENT_SELECT,
    }),
    prisma.assessor_assignments.count({ where }),
  ]);

  return { rows: (rows as AssignmentRow[]).map(toPublic), total };
}

export async function softDeleteAssignment(id: string): Promise<boolean> {
  const affected = await softDelete("assessor_assignments", id);
  return affected > 0;
}

export async function findAssignmentById(
  id: string
): Promise<PublicAssignment | null> {
  const a = await prisma.assessor_assignments.findFirst({
    where: { id, deleted_at: null },
    select: ASSIGNMENT_SELECT,
  });
  return a ? toPublic(a as AssignmentRow) : null;
}

export async function findAssignmentForFarmer(
  farmerId: string
): Promise<PublicAssignment | null> {
  const a = await prisma.assessor_assignments.findFirst({
    where: { farmer_id: farmerId, deleted_at: null },
    orderBy: { created_at: "desc" },
    select: ASSIGNMENT_SELECT,
  });
  return a ? toPublic(a as AssignmentRow) : null;
}

interface SetFarmerAssessorParams {
  farmerId: string;
  assessorId: string;
  assignedBy: string | null;
  orgId: string | null;
  note: string | null;
}

export async function setFarmerAssessor(
  p: SetFarmerAssessorParams
): Promise<PublicAssignment> {
  return prisma.$transaction(async (tx) => {
    await tx.assessor_assignments.updateMany({
      where: { farmer_id: p.farmerId, deleted_at: null },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
    const created = await tx.assessor_assignments.create({
      data: {
        assessor_id: p.assessorId,
        farmer_id: p.farmerId,
        assigned_by: p.assignedBy,
        org_id: p.orgId,
        note: p.note,
      },
      select: ASSIGNMENT_SELECT,
    });
    return toPublic(created as AssignmentRow);
  });
}

export async function clearFarmerAssessor(farmerId: string): Promise<boolean> {
  const { count } = await prisma.assessor_assignments.updateMany({
    where: { farmer_id: farmerId, deleted_at: null },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
  return count > 0;
}
