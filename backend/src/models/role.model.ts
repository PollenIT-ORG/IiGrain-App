import prisma from "../db/prisma.js";
import type { Role } from "../types/index.js";

// Sign-up creates a farmer and nothing else: it needs an Enrollment ID, which
// only a farmer has. An assessor account is made by a program administrator, so
// the app must never offer that as a choice.
const NON_SIGNUP_ROLES = [
  "super_admin",
  "admin",
  "program_administrator",
  "program_partner",
  "assessor",
];

export async function listSelfSignupRoles(): Promise<
  Pick<Role, "id" | "name" | "description">[]
> {
  const rows = await prisma.roles.findMany({
    where: {
      name: { notIn: NON_SIGNUP_ROLES },
      deleted_at: null,
    },
    orderBy: { id: "asc" },
    select: { id: true, name: true, description: true },
  });
  return rows as Pick<Role, "id" | "name" | "description">[];
}
