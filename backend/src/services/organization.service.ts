import ApiError from "../utils/ApiError.js";
import {
  broadcastToAdmins,
  broadcastConfigChanged,
} from "./realtime.service.js";
import {
  createOrg,
  listOrgs,
  findOrgById,
  updateOrg,
  softDeleteOrg,
  codeExists,
  setOrgBranding,
  type PublicOrganization,
  type ListOrgsFilters,
} from "../models/organization.model.js";
import { uploadBrandingImage } from "./upload.service.js";
import {
  findPublicById,
  findById,
  setUserOrg,
  listOrgMembers,
  type PublicUser,
} from "../models/user.model.js";
import { getDefaultOrgId } from "./tenancy.service.js";
import { applyClock, describeClock } from "./clock.service.js";
import logger from "../utils/logger.js";

function nn(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

interface CreateInput {
  name: string;
  code: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactHours?: string;
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
  const org = await createOrg({
    name: input.name.trim(),
    code,
    description: nn(input.description),
    contactEmail: nn(input.contactEmail),
    contactPhone: nn(input.contactPhone),
    contactHours: nn(input.contactHours),
    address: nn(input.address),
    isActive: input.isActive ?? true,
  });
  broadcastToAdmins("organizations", { orgId: org.id });
  return org;
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
  contactHours?: string;
  address?: string;
  timezone?: string;
  timeFormat?: string;
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
    contactHours:
      input.contactHours !== undefined ? nn(input.contactHours) : undefined,
    address: input.address !== undefined ? nn(input.address) : undefined,
    timezone: input.timezone?.trim() || undefined,
    timeFormat: input.timeFormat,
    isActive: input.isActive,
  });
  if (!updated) throw ApiError.notFound("Organization not found.");

  // Saving the setting is all it takes: the same routine `npm run db:clock`
  // runs is run here, so the database and everything reading from it are on
  // the new clock straight away, with no command and no restart.
  if (input.timezone !== undefined || input.timeFormat !== undefined) {
    try {
      logger.info(describeClock(await applyClock()));
    } catch (err) {
      logger.error("Could not apply the new clock to the database.", err);
    }
  }

  broadcastToAdmins("organizations", { orgId: id });
  broadcastConfigChanged();
  return updated;
}

export async function removeOrganization(id: string): Promise<void> {
  const ok = await softDeleteOrg(id);
  if (!ok) throw ApiError.notFound("Organization not found.");
  broadcastToAdmins("organizations", { orgId: id });
  broadcastConfigChanged();
}

async function setBranding(
  id: string,
  kind: "logo" | "favicon",
  file: { buffer: Buffer; size?: number } | null
): Promise<PublicOrganization> {
  const org = await findOrgById(id);
  if (!org) throw ApiError.notFound("Organization not found.");
  const field = kind === "logo" ? "logo_url" : "favicon_url";
  const url = file ? await uploadBrandingImage(file, kind) : null;
  const updated = await setOrgBranding(id, field, url);
  if (!updated) throw ApiError.notFound("Organization not found.");
  broadcastToAdmins("organizations", { orgId: id });
  broadcastConfigChanged();
  return updated;
}

export function setLogo(
  id: string,
  file: { buffer: Buffer; size?: number }
): Promise<PublicOrganization> {
  return setBranding(id, "logo", file);
}

export function removeLogo(id: string): Promise<PublicOrganization> {
  return setBranding(id, "logo", null);
}

export function setFavicon(
  id: string,
  file: { buffer: Buffer; size?: number }
): Promise<PublicOrganization> {
  return setBranding(id, "favicon", file);
}

export function removeFavicon(id: string): Promise<PublicOrganization> {
  return setBranding(id, "favicon", null);
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
  const user = await findById(userId);
  if (!user) throw ApiError.notFound("User not found.");
  if (user.org_id !== orgId) {
    throw ApiError.conflict("This user is not a member of this organization.");
  }
  await setUserOrg(userId, null);
}
