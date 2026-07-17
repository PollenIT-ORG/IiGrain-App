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
  address: string | null;
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
  address: true,
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
    address: o.address,
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
  address?: string | null;
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
  if (p.address !== undefined) data.address = p.address;
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
