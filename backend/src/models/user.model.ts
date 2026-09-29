import prisma from "../db/prisma.js";
import type { User, Role } from "../types/index.js";
import type { Prisma } from "@prisma/client";

export interface UserWithRole extends User {
  role_name: string;
}

export interface AssignedAssessor {
  assignmentId: string;
  assessorId: string;
  assessorName: string | null;
  assessorEmail: string;
}

export interface PublicUser {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  is_email_verified: boolean;
  /** True while the temporary password the office set is still in place. */
  must_change_password: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  assigned_assessor?: AssignedAssessor | null;
}

const PUBLIC_USER_SELECT = {
  id: true,
  full_name: true,
  email: true,
  phone: true,
  avatar_url: true,
  is_active: true,
  is_email_verified: true,
  must_change_password: true,
  last_login_at: true,
  created_at: true,
  updated_at: true,
  roles: { select: { name: true } },
  assessor_assignments_assessor_assignments_farmer_idTousers: {
    where: { deleted_at: null },
    orderBy: { created_at: "desc" },
    take: 1,
    select: {
      id: true,
      assessor_id: true,
      users_assessor_assignments_assessor_idTousers: {
        select: { full_name: true, email: true },
      },
    },
  },
} satisfies Prisma.usersSelect;

type PublicUserRow = Prisma.usersGetPayload<{ select: typeof PUBLIC_USER_SELECT }>;

function toPublicUser(u: PublicUserRow): PublicUser {
  const a = u.assessor_assignments_assessor_assignments_farmer_idTousers[0];
  const assignedAssessor: AssignedAssessor | null = a
    ? {
        assignmentId: a.id,
        assessorId: a.assessor_id,
        assessorName: a.users_assessor_assignments_assessor_idTousers.full_name,
        assessorEmail: a.users_assessor_assignments_assessor_idTousers.email,
      }
    : null;
  return {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    phone: u.phone,
    avatar_url: u.avatar_url,
    role: u.roles.name,
    is_active: u.is_active,
    is_email_verified: u.is_email_verified,
    must_change_password: u.must_change_password,
    last_login_at: u.last_login_at,
    created_at: u.created_at,
    updated_at: u.updated_at,
    assigned_assessor: assignedAssessor,
  };
}

type UserWithRoleRow = Prisma.usersGetPayload<{ include: { roles: true } }>;

function toUserWithRole(u: UserWithRoleRow): UserWithRole {
  const { roles, ...rest } = u;
  return { ...(rest as unknown as User), role_name: roles.name };
}

export async function findByEmail(
  email: string
): Promise<UserWithRole | null> {
  const u = await prisma.users.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, deleted_at: null },
    include: { roles: true },
  });
  return u ? toUserWithRole(u) : null;
}

export async function findById(id: string): Promise<UserWithRole | null> {
  const u = await prisma.users.findFirst({
    where: { id, deleted_at: null },
    include: { roles: true },
  });
  return u ? toUserWithRole(u) : null;
}

// Minimal status lookup used on every authenticated request to confirm the
// account still exists and is active. Selects only what is needed so it stays
// cheap (a primary-key hit).
export async function getUserAuthStatus(
  id: string
): Promise<{ is_active: boolean; deleted_at: Date | null } | null> {
  const u = await prisma.users.findUnique({
    where: { id },
    select: { is_active: true, deleted_at: true },
  });
  return u ?? null;
}

// Includes soft-deleted rows - used when restoring, where the target is deleted.
export async function findRoleByName(name: string): Promise<Role | null> {
  const r = await prisma.roles.findFirst({
    where: { name, deleted_at: null },
  });
  return (r as Role | null) ?? null;
}

interface CreateUserParams {
  roleId: number;
  fullName: string | null;
  email: string;
  phone: string | null;
  passwordHash: string | null;
  orgId?: string | null;
}

export async function createUser(
  params: CreateUserParams
): Promise<UserWithRole> {
  const created = await prisma.users.create({
    data: {
      role_id: params.roleId,
      full_name: params.fullName,
      email: params.email,
      phone: params.phone,
      password_hash: params.passwordHash,
      org_id: params.orgId ?? null,
    },
    include: { roles: true },
  });
  return toUserWithRole(created);
}

export async function markLoggedIn(userId: string): Promise<void> {
  await prisma.users.updateMany({
    where: { id: userId },
    data: {
      last_login_at: new Date(),
      is_email_verified: true,
      updated_at: new Date(),
    },
  });
}

export async function updatePassword(
  userId: string,
  passwordHash: string
): Promise<void> {
  await prisma.users.updateMany({
    where: { id: userId },
    data: {
      password_hash: passwordHash,
      is_email_verified: true,
      updated_at: new Date(),
    },
  });
}

export async function setUserAvatar(
  userId: string,
  avatarUrl: string | null
): Promise<PublicUser | null> {
  await prisma.users.updateMany({
    where: { id: userId, deleted_at: null },
    data: { avatar_url: avatarUrl, updated_at: new Date() },
  });
  const u = await prisma.users.findFirst({
    where: { id: userId, deleted_at: null },
    select: PUBLIC_USER_SELECT,
  });
  return u ? toPublicUser(u) : null;
}

interface CreateByAdminParams {
  roleId: number;
  fullName: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  isActive: boolean;
  isEmailVerified: boolean;
  mustChangePassword: boolean;
}

export async function createUserByAdmin(
  params: CreateByAdminParams
): Promise<PublicUser> {
  const created = await prisma.users.create({
    data: {
      role_id: params.roleId,
      full_name: params.fullName,
      email: params.email,
      phone: params.phone,
      password_hash: params.passwordHash,
      is_active: params.isActive,
      is_email_verified: params.isEmailVerified,
      must_change_password: params.mustChangePassword,
    },
    select: PUBLIC_USER_SELECT,
  });
  return toPublicUser(created);
}

/** Cleared once the owner has replaced the password somebody else set. */
export async function clearMustChangePassword(id: string): Promise<void> {
  await prisma.users.updateMany({
    where: { id, must_change_password: true },
    data: { must_change_password: false, updated_at: new Date() },
  });
}

export async function findPublicById(id: string): Promise<PublicUser | null> {
  const u = await prisma.users.findFirst({
    where: { id, deleted_at: null },
    select: PUBLIC_USER_SELECT,
  });
  return u ? toPublicUser(u) : null;
}

export interface ListUsersFilters {
  role?: string;
  /** The only roles the caller may see, when their own role is limited. */
  roles?: string[];
  status?: "active" | "inactive";
  search?: string;
  assessor?: "assigned" | "unassigned";
  limit: number;
  offset: number;
}

export async function listUsers(
  filters: ListUsersFilters
): Promise<{ rows: PublicUser[]; total: number }> {
  const where: Prisma.usersWhereInput = { deleted_at: null };

  if (filters.role) where.roles = { name: filters.role };
  else if (filters.roles?.length) where.roles = { name: { in: filters.roles } };
  if (filters.status) where.is_active = filters.status === "active";

  if (filters.assessor === "assigned") {
    where.assessor_assignments_assessor_assignments_farmer_idTousers = {
      some: { deleted_at: null },
    };
  } else if (filters.assessor === "unassigned") {
    where.assessor_assignments_assessor_assignments_farmer_idTousers = {
      none: { deleted_at: null },
    };
  }
  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { full_name: { contains: s, mode: "insensitive" } },
      { email: { contains: s, mode: "insensitive" } },
      { phone: { contains: s, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.users.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: filters.limit,
      skip: filters.offset,
      select: PUBLIC_USER_SELECT,
    }),
    prisma.users.count({ where }),
  ]);

  return { rows: rows.map(toPublicUser), total };
}

interface UpdateUserParams {
  fullName?: string;
  phone?: string | null;
  roleId?: number;
  isActive?: boolean;
}

export async function updateUser(
  id: string,
  params: UpdateUserParams
): Promise<PublicUser | null> {
  const data: Prisma.usersUncheckedUpdateManyInput = {};
  if (params.fullName !== undefined) data.full_name = params.fullName;
  if (params.phone !== undefined) data.phone = params.phone;
  if (params.roleId !== undefined) data.role_id = params.roleId;
  if (params.isActive !== undefined) data.is_active = params.isActive;

  if (Object.keys(data).length === 0) return findPublicById(id);

  data.updated_at = new Date();

  const { count } = await prisma.users.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  if (!count) return null;
  return findPublicById(id);
}

export async function setUserStatus(
  id: string,
  isActive: boolean
): Promise<PublicUser | null> {
  const { count } = await prisma.users.updateMany({
    where: { id, deleted_at: null },
    data: { is_active: isActive, updated_at: new Date() },
  });
  if (!count) return null;
  return findPublicById(id);
}

export interface AssessorOption {
  id: string;
  full_name: string | null;
  email: string;
}

export async function listAssessors(): Promise<AssessorOption[]> {
  const rows = await prisma.users.findMany({
    where: { deleted_at: null, is_active: true, roles: { name: "assessor" } },
    orderBy: [{ full_name: "asc" }, { email: "asc" }],
    select: { id: true, full_name: true, email: true },
  });
  return rows;
}

export async function emailExists(
  email: string,
  excludeId?: string
): Promise<boolean> {
  const found = await prisma.users.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      deleted_at: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return found !== null;
}

export async function setUserOrg(
  userId: string,
  orgId: string | null
): Promise<boolean> {
  const { count } = await prisma.users.updateMany({
    where: { id: userId, deleted_at: null },
    data: { org_id: orgId, updated_at: new Date() },
  });
  return count > 0;
}

export async function listOrgMembers(orgId: string): Promise<PublicUser[]> {
  const rows = await prisma.users.findMany({
    where: { org_id: orgId, deleted_at: null },
    orderBy: { created_at: "desc" },
    select: PUBLIC_USER_SELECT,
  });
  return rows.map(toPublicUser);
}

export async function getUserOrgId(userId: string): Promise<string | null> {
  const u = await prisma.users.findFirst({
    where: { id: userId, deleted_at: null },
    select: { org_id: true },
  });
  return u?.org_id ?? null;
}
