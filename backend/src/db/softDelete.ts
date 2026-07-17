import prisma from "./prisma.js";

export type SoftDeleteTable =
  | "users"
  | "roles"
  | "otp_codes"
  | "login_logs"
  | "organizations"
  | "farms"
  | "fields"
  | "assessment_categories"
  | "assessment_questions"
  | "assessment_responses"
  | "assessor_assignments"
  | "field_soil"
  | "field_documents"
  | "programs"
  | "program_enrollments"
  | "program_enrollment_fields";

function delegateFor(table: SoftDeleteTable) {
  switch (table) {
    case "users": return prisma.users;
    case "roles": return prisma.roles;
    case "otp_codes": return prisma.otp_codes;
    case "login_logs": return prisma.login_logs;
    case "organizations": return prisma.organizations;
    case "farms": return prisma.farms;
    case "fields": return prisma.fields;
    case "assessment_categories": return prisma.assessment_categories;
    case "assessment_questions": return prisma.assessment_questions;
    case "assessment_responses": return prisma.assessment_responses;
    case "assessor_assignments": return prisma.assessor_assignments;
    case "field_soil": return prisma.field_soil;
    case "field_documents": return prisma.field_documents;
    case "programs": return prisma.programs;
    case "program_enrollments": return prisma.program_enrollments;
    case "program_enrollment_fields": return prisma.program_enrollment_fields;
  }
}

export function aliveClause(): string {
  return "deleted_at IS NULL";
}

export async function softDelete(
  table: SoftDeleteTable,
  id: string | number
): Promise<number> {
  const { count } = await (delegateFor(table) as {
    updateMany: (args: unknown) => Promise<{ count: number }>;
  }).updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: new Date() },
  });
  return count;
}

export async function restore(
  table: SoftDeleteTable,
  id: string | number
): Promise<number> {
  const { count } = await (delegateFor(table) as {
    updateMany: (args: unknown) => Promise<{ count: number }>;
  }).updateMany({
    where: { id, deleted_at: { not: null } },
    data: { deleted_at: null },
  });
  return count;
}

export async function hardDelete(
  table: SoftDeleteTable,
  id: string | number
): Promise<number> {
  const { count } = await (delegateFor(table) as {
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  }).deleteMany({ where: { id } });
  return count;
}
