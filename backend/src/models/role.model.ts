import prisma from "../db/prisma.js";
import type { Role } from "../types/index.js";

const NON_SIGNUP_ROLES = [
  "super_admin",
  "admin",
  "program_administrator",
  "program_partner",
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
