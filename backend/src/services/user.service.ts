import bcrypt from "bcryptjs";
import ApiError from "../utils/ApiError.js";
import { sendWelcomeEmail, sendPasswordChangedEmail } from "./mailer.service.js";
import { canCreateRole } from "../config/rbac.js";
import { getDefaultOrgId } from "./tenancy.service.js";
import { revokeAllForUser } from "../models/refreshToken.model.js";
import {
  findRoleByName,
  findPublicById,
  findById,
  createUserByAdmin,
  listUsers,
  listAssessors,
  updateUser,
  setUserStatus,
  softDeleteUser,
  restoreUser,
  updatePassword,
  emailExists,
  setUserOrg,
  type PublicUser,
  type ListUsersFilters,
  type AssessorOption,
} from "../models/user.model.js";
import {
  setFarmerAssessor,
  clearFarmerAssessor,
} from "../models/assessorAssignment.model.js";

const SALT_ROUNDS = 10;

interface CreateUserInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  isActive?: boolean;
}

export interface Actor {
  id: string;
  role: string;
}

export async function createUser(
  input: CreateUserInput,
  actor: Actor
): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();

  if (!canCreateRole(actor.role, input.role)) {
    throw ApiError.forbidden(
      `You do not have permission to create a "${input.role}" account.`
    );
  }

  if (await emailExists(email)) {
    throw ApiError.conflict("A user with this email already exists.");
  }

  const role = await findRoleByName(input.role);
  if (!role) {
    throw ApiError.badRequest(`"${input.role}" is not a valid role.`);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await createUserByAdmin({
    roleId: role.id,
    fullName: input.fullName,
    email,
    phone: input.phone,
    passwordHash,
    isActive: input.isActive ?? true,
    isEmailVerified: true,
  });

  const defaultOrgId = await getDefaultOrgId();
  if (defaultOrgId) {
    await setUserOrg(user.id, defaultOrgId);
  }

  void sendWelcomeEmail({
    to: email,
    fullName: input.fullName,
    password: input.password,
  });

  return user;
}

interface ListUsersInput {
  page: number;
  limit: number;
  role?: string;
  status?: "active" | "inactive";
  search?: string;
  assessor?: "assigned" | "unassigned";
}

export async function getUsers(input: ListUsersInput): Promise<{
  users: PublicUser[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const filters: ListUsersFilters = {
    role: input.role,
    status: input.status,
    search: input.search,
    assessor: input.assessor,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  };

  const { rows, total } = await listUsers(filters);

  return {
    users: rows,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function getUserById(id: string): Promise<PublicUser> {
  const user = await findPublicById(id);
  if (!user) throw ApiError.notFound("User not found.");
  return user;
}

export async function getAssessorOptions(): Promise<AssessorOption[]> {
  return listAssessors();
}

interface AssessorActor {
  id: string;
  role: string;
}

export async function assignUserAssessor(
  farmerId: string,
  assessorId: string,
  actor: AssessorActor
): Promise<PublicUser> {
  const farmer = await findById(farmerId);
  if (!farmer) throw ApiError.notFound("User not found.");
  if (farmer.role_name !== "farmer") {
    throw ApiError.badRequest("Only farmers can be assigned an assessor.");
  }

  const assessor = await findById(assessorId);
  if (!assessor) throw ApiError.notFound("The selected assessor was not found.");
  if (assessor.role_name !== "assessor") {
    throw ApiError.badRequest("The selected user is not an assessor.");
  }

  const orgId = await getDefaultOrgId();
  await setFarmerAssessor({
    farmerId,
    assessorId,
    assignedBy: actor.id,
    orgId,
    note: null,
  });

  return getUserById(farmerId);
}

export async function unassignUserAssessor(
  farmerId: string
): Promise<PublicUser> {
  const farmer = await findById(farmerId);
  if (!farmer) throw ApiError.notFound("User not found.");
  await clearFarmerAssessor(farmerId);
  return getUserById(farmerId);
}

interface UpdateUserInput {
  fullName?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
}

export async function editUser(
  id: string,
  input: UpdateUserInput
): Promise<PublicUser> {
  const existing = await findById(id);
  if (!existing) throw ApiError.notFound("User not found.");

  let roleId: number | undefined;
  if (input.role !== undefined) {
    const role = await findRoleByName(input.role);
    if (!role)
      throw ApiError.badRequest(
        `"${input.role}" is not a valid role. Choose farmer, assessor, program_partner, or admin.`
      );
    roleId = role.id;
  }

  const updated = await updateUser(id, {
    fullName: input.fullName,
    phone: input.phone,
    roleId,
    isActive: input.isActive,
  });
  if (!updated) throw ApiError.notFound("User not found.");
  return updated;
}

export async function removeUser(id: string): Promise<void> {
  const ok = await softDeleteUser(id);
  if (!ok) throw ApiError.notFound("User not found or already deleted.");
}

export async function deleteOwnAccount(userId: string): Promise<void> {
  const ok = await softDeleteUser(userId);
  if (!ok) throw ApiError.notFound("Account not found or already deleted.");
  await revokeAllForUser(userId);
}

export async function restoreUserById(id: string): Promise<PublicUser> {
  const ok = await restoreUser(id);
  if (!ok) {
    throw ApiError.notFound("No deleted user found to restore.");
  }
  const user = await findPublicById(id);
  if (!user) throw ApiError.notFound("User not found after restore.");
  return user;
}

export async function changeStatus(
  id: string,
  isActive: boolean
): Promise<PublicUser> {
  const updated = await setUserStatus(id, isActive);
  if (!updated) throw ApiError.notFound("User not found.");
  return updated;
}

export async function updateOwnProfile(
  userId: string,
  input: { fullName?: string; phone?: string }
): Promise<PublicUser> {
  const updated = await updateUser(userId, {
    fullName: input.fullName,
    phone: input.phone,
  });
  if (!updated) throw ApiError.notFound("User not found.");
  return updated;
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await findById(userId);
  if (!user) throw ApiError.notFound("User not found.");

  if (!user.password_hash) {
    throw ApiError.badRequest("This account has no password set.");
  }

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) {
    throw ApiError.unauthorized("Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await updatePassword(userId, passwordHash);

  void sendPasswordChangedEmail({ to: user.email, fullName: user.full_name });
}
