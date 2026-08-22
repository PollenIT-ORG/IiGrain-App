import prisma from "../db/prisma.js";
import { softDelete } from "../db/softDelete.js";
import type { Prisma } from "@prisma/client";
import type { Organization } from "../types/index.js";

export interface PublicOrganization {
  id: string;
  name: string;
  code: string;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_hours: string | null;
  address: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  /** The timezone every date and time in the panel is shown in. */
  timezone: string;
  /** "12h" or "24h": the clock the panel uses. */
  time_format: string;
  is_active: boolean;
  member_count: number;
  created_at: Date;
  updated_at: Date;
}

const PUBLIC_ORG_SELECT = {
  id: true,
  name: true,
  code: true,
  description: true,
  contact_email: true,
  contact_phone: true,
  contact_hours: true,
  address: true,
  logo_url: true,
  favicon_url: true,
  timezone: true,
  time_format: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  _count: { select: { users: { where: { deleted_at: null } } } },
} satisfies Prisma.organizationsSelect;

type PublicOrgRow = Prisma.organizationsGetPayload<{
  select: typeof PUBLIC_ORG_SELECT;
}>;

function toPublicOrg(o: PublicOrgRow): PublicOrganization {
  return {
    id: o.id,
    name: o.name,
    code: o.code,
    description: o.description,
    contact_email: o.contact_email,
    contact_phone: o.contact_phone,
    contact_hours: o.contact_hours,
    address: o.address,
    logo_url: o.logo_url,
    favicon_url: o.favicon_url,
    timezone: o.timezone,
    time_format: o.time_format,
    is_active: o.is_active,
    member_count: o._count.users,
    created_at: o.created_at,
    updated_at: o.updated_at,
  };
}

export async function codeExists(
  code: string,
  excludeId?: string
): Promise<boolean> {
  const found = await prisma.organizations.findFirst({
    where: {
      code: { equals: code, mode: "insensitive" },
      deleted_at: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return found !== null;
}

export async function findOrgById(
  id: string
): Promise<PublicOrganization | null> {
  const o = await prisma.organizations.findFirst({
    where: { id, deleted_at: null },
    select: PUBLIC_ORG_SELECT,
  });
  return o ? toPublicOrg(o) : null;
}

interface CreateOrgParams {
  name: string;
  code: string;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactHours: string | null;
  address: string | null;
  isActive: boolean;
}

export async function createOrg(
  p: CreateOrgParams
): Promise<PublicOrganization> {
  const created = await prisma.organizations.create({
    data: {
      name: p.name,
      code: p.code,
      description: p.description,
      contact_email: p.contactEmail,
      contact_phone: p.contactPhone,
      contact_hours: p.contactHours,
      address: p.address,
      is_active: p.isActive,
    },
    select: PUBLIC_ORG_SELECT,
  });
  return toPublicOrg(created);
}

export interface ListOrgsFilters {
  search?: string;
  status?: "active" | "inactive";
  limit: number;
  offset: number;
}

export async function listOrgs(
  filters: ListOrgsFilters
): Promise<{ rows: PublicOrganization[]; total: number }> {
  const where: Prisma.organizationsWhereInput = { deleted_at: null };

  if (filters.status) where.is_active = filters.status === "active";
  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { code: { contains: s, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.organizations.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: filters.limit,
      skip: filters.offset,
      select: PUBLIC_ORG_SELECT,
    }),
    prisma.organizations.count({ where }),
  ]);

  return { rows: rows.map(toPublicOrg), total };
}

interface UpdateOrgParams {
  name?: string;
  code?: string;
  description?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactHours?: string | null;
  address?: string | null;
  timezone?: string;
  timeFormat?: string;
  isActive?: boolean;
}

export async function updateOrg(
  id: string,
  p: UpdateOrgParams
): Promise<PublicOrganization | null> {
  const data: Prisma.organizationsUpdateManyMutationInput = {};
  if (p.name !== undefined) data.name = p.name;
  if (p.code !== undefined) data.code = p.code;
  if (p.description !== undefined) data.description = p.description;
  if (p.contactEmail !== undefined) data.contact_email = p.contactEmail;
  if (p.contactPhone !== undefined) data.contact_phone = p.contactPhone;
  if (p.contactHours !== undefined) data.contact_hours = p.contactHours;
  if (p.address !== undefined) data.address = p.address;
  if (p.timezone !== undefined) data.timezone = p.timezone;
  if (p.timeFormat !== undefined) data.time_format = p.timeFormat;
  if (p.isActive !== undefined) data.is_active = p.isActive;

  if (Object.keys(data).length === 0) return findOrgById(id);

  data.updated_at = new Date();

  const { count } = await prisma.organizations.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  if (!count) return null;
  return findOrgById(id);
}

// Sets or clears the organization's logo or favicon URL.
export async function setOrgBranding(
  id: string,
  field: "logo_url" | "favicon_url",
  url: string | null
): Promise<PublicOrganization | null> {
  const { count } = await prisma.organizations.updateMany({
    where: { id, deleted_at: null },
    data: { [field]: url, updated_at: new Date() },
  });
  if (!count) return null;
  return findOrgById(id);
}

// The default (first) organization - used by the public config to expose
// branding app-wide, including on the login screen.
export async function findDefaultOrgBranding(): Promise<{
  logo_url: string | null;
  favicon_url: string | null;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_hours: string | null;
  address: string | null;
  timezone: string;
  time_format: string;
} | null> {
  const o = await prisma.organizations.findFirst({
    where: { deleted_at: null },
    orderBy: { created_at: "asc" },
    select: {
      logo_url: true,
      favicon_url: true,
      timezone: true,
      time_format: true,
      name: true,
      contact_email: true,
      contact_phone: true,
      contact_hours: true,
      address: true,
    },
  });
  return o ?? null;
}

export async function softDeleteOrg(id: string): Promise<boolean> {
  const affected = await softDelete("organizations", id);
  if (affected > 0) {
    await prisma.users.updateMany({
      where: { org_id: id },
      data: { org_id: null },
    });
  }
  return affected > 0;
}

export async function findOrgRowById(
  id: string
): Promise<Organization | null> {
  const o = await prisma.organizations.findFirst({
    where: { id, deleted_at: null },
  });
  return (o as Organization | null) ?? null;
}
