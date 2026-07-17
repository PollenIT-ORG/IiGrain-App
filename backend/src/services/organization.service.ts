import ApiError from "../utils/ApiError.js";
import {
  createOrg,
  listOrgs,
  findOrgById,
  updateOrg,
  softDeleteOrg,
  codeExists,
  type PublicOrganization,
  type ListOrgsFilters,
} from "../models/organization.model.js";
import {
  findPublicById,
  setUserOrg,
  listOrgMembers,
  type PublicUser,
} from "../models/user.model.js";
import { getDefaultOrgId } from "./tenancy.service.js";

function nn(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

interface CreateInput {
  name: string;
  code: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  isActive?: boolean;
}

export async function createOrganization(
  input: CreateInput
): Promise<PublicOrganization> {
  const code = input.code.trim();
  if (await codeExists(code)) {
    throw ApiError.conflict("An organization with this code already exists.");
  }
  return createOrg({
    name: input.name.trim(),
    code,
    description: nn(input.description),
    contactEmail: nn(input.contactEmail),
    contactPhone: nn(input.contactPhone),
    address: nn(input.address),
    isActive: input.isActive ?? true,
  });
}

interface ListInput {
  page: number;
  limit: number;
  status?: "active" | "inactive";
  search?: string;
}

export async function getOrganizations(input: ListInput): Promise<{
  organizations: PublicOrganization[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const filters: ListOrgsFilters = {
    status: input.status,
    search: input.search,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  };
  const { rows, total } = await listOrgs(filters);
  return {
    organizations: rows,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function getOrganizationById(
  id: string
): Promise<PublicOrganization> {
  const org = await findOrgById(id);
  if (!org) throw ApiError.notFound("Organization not found.");
  return org;
}

export async function getOrganizationWithMembers(
  id: string
): Promise<{ organization: PublicOrganization; members: PublicUser[] }> {
  const organization = await getOrganizationById(id);
  const members = await listOrgMembers(id);
  return { organization, members };
}

export async function getCurrentOrganization(): Promise<PublicOrganization | null> {
  const orgId = await getDefaultOrgId();
  if (!orgId) return null;
  return findOrgById(orgId);
}

interface UpdateInput {
  name?: string;
  code?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  isActive?: boolean;
}

export async function editOrganization(
  id: string,
  input: UpdateInput
): Promise<PublicOrganization> {
  const existing = await findOrgById(id);
  if (!existing) throw ApiError.notFound("Organization not found.");

  if (input.code !== undefined && (await codeExists(input.code.trim(), id))) {
    throw ApiError.conflict("Another organization already uses this code.");
  }

  const updated = await updateOrg(id, {
    name: input.name?.trim(),
    code: input.code?.trim(),
    description:
      input.description !== undefined ? nn(input.description) : undefined,
    contactEmail:
      input.contactEmail !== undefined ? nn(input.contactEmail) : undefined,
    contactPhone:
      input.contactPhone !== undefined ? nn(input.contactPhone) : undefined,
    address: input.address !== undefined ? nn(input.address) : undefined,
    isActive: input.isActive,
  });
  if (!updated) throw ApiError.notFound("Organization not found.");
  return updated;
}

export async function removeOrganization(id: string): Promise<void> {
  const ok = await softDeleteOrg(id);
  if (!ok) throw ApiError.notFound("Organization not found.");
}

export async function assignUser(
  orgId: string,
  userId: string
): Promise<PublicUser> {
  const org = await findOrgById(orgId);
  if (!org) throw ApiError.notFound("Organization not found.");

  const user = await findPublicById(userId);
  if (!user) throw ApiError.notFound("User not found.");

  await setUserOrg(userId, orgId);
  return (await findPublicById(userId)) as PublicUser;
}

export async function unassignUser(
  orgId: string,
  userId: string
): Promise<void> {
  const user = await findPublicById(userId);
  if (!user) throw ApiError.notFound("User not found.");
  await setUserOrg(userId, null);
  void orgId;
}
