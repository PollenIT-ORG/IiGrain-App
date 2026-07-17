import prisma from "../db/prisma.js";
import env from "../config/env.js";
import ApiError from "../utils/ApiError.js";

export function isSaaSEnabled(): boolean {
  return env.saasEnabled;
}

export async function getDefaultOrgId(): Promise<string | null> {
  if (env.saasEnabled) return null;

  const org = await prisma.organizations.findFirst({
    where: { deleted_at: null, is_active: true },
    orderBy: { created_at: "asc" },
    select: { id: true },
  });
  return org?.id ?? null;
}

export async function requireDefaultOrgId(): Promise<string> {
  if (env.saasEnabled) {
    throw ApiError.badRequest(
      "An organization must be specified in multi-tenant mode."
    );
  }
  const orgId = await getDefaultOrgId();
  if (!orgId) {
    throw ApiError.badRequest(
      "No organization exists yet. Create an organization before adding members."
    );
  }
  return orgId;
}
