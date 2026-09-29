import bcrypt from "bcryptjs";
import ApiError from "../utils/ApiError.js";
import { sendWelcomeEmail, sendPasswordChangedEmail } from "./mailer.service.js";
import { canCreateRole, canManageUser } from "../config/rbac.js";
import { getDefaultOrgId } from "./tenancy.service.js";
import { generateTempPassword } from "../utils/tempPassword.js";
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
  updatePassword,
  clearMustChangePassword,
  emailExists,
  setUserOrg,
  setUserAvatar,
  type PublicUser,
  type ListUsersFilters,
  type AssessorOption,
} from "../models/user.model.js";
import { uploadAvatarImage } from "./upload.service.js";
import { emitSync } from "../socket/liveSync.js";
import { broadcastToAdmins } from "./realtime.service.js";
import { notifyUser } from "./notification.service.js";
import {
  summarizeUserDeletion,
  deleteUserCascade,
  type DeletionLine,
} from "./cascadeDelete.service.js";
import { assessorAssignedEmail } from "./emailTemplates.js";
import {
  setFarmerAssessor,
  clearFarmerAssessor,
  findAssignmentForFarmer,
} from "../models/assessorAssignment.model.js";

const SALT_ROUNDS = 10;

interface CreateUserInput {
  fullName: string;
  email: string;
  phone: string;
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

  // The office never picks the password. One is generated, emailed, and the
  // account stays shut until the owner replaces it through the reset flow.
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

  const user = await createUserByAdmin({
    roleId: role.id,
    fullName: input.fullName,
    email,
    phone: input.phone,
    passwordHash,
    isActive: input.isActive ?? true,
    isEmailVerified: true,
    mustChangePassword: true,
  });

  const defaultOrgId = await getDefaultOrgId();
  if (defaultOrgId) {
    await setUserOrg(user.id, defaultOrgId);
  }

  void sendWelcomeEmail({
    to: email,
    fullName: input.fullName,
    password: tempPassword,
  });

  broadcastToAdmins("users");
  return user;
}

interface ListUsersInput {
  page: number;
  limit: number;
  role?: string;
  /** The only roles the caller may see. */
  roles?: string[];
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
    roles: input.roles,
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

  // Live sync both sides of the assignment.
  emitSync(farmerId, { resource: "enrollment", action: "updated" });
  emitSync(assessorId, { resource: "enrollment", action: "updated" });
  broadcastToAdmins("assignments", { farmerId, assessorId });

  // Live notification to BOTH the farmer and the assessor.
  void notifyUser({
    userId: farmerId,
    type: "assessor_assigned",
    title: "An assessor was assigned",
    body: `${assessor.full_name ?? "An assessor"} has been assigned to you.`,
    data: { assessorId },
    emailFor: (r) =>
      assessorAssignedEmail({
        fullName: r.fullName,
        assessorName: assessor.full_name,
      }),
  });
  void notifyUser({
    userId: assessorId,
    type: "assessor_assigned",
    title: "New assessment assignment",
    body: `You have been assigned to assess ${farmer.full_name ?? "a farmer"}.`,
    data: { farmerId },
    emailFor: (r) =>
      assessorAssignedEmail({
        fullName: r.fullName,
        assessorName: assessor.full_name,
      }),
  });

  return getUserById(farmerId);
}

export async function unassignUserAssessor(
  farmerId: string
): Promise<PublicUser> {
  const farmer = await findById(farmerId);
  if (!farmer) throw ApiError.notFound("User not found.");
  // Capture the current assessor before clearing so we can sync them too.
  const current = await findAssignmentForFarmer(farmerId);
  await clearFarmerAssessor(farmerId);
  emitSync(farmerId, { resource: "enrollment", action: "updated" });
  if (current?.assessor_id) {
    emitSync(current.assessor_id, { resource: "enrollment", action: "updated" });
  }
  broadcastToAdmins("assignments", { farmerId });
  return getUserById(farmerId);
}

interface UpdateUserInput {
  fullName?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
}

// A manager may only act on accounts below their own rank. This is what stops a
// program_administrator from editing, deactivating or deleting an admin or a
// super_admin (and an admin from touching a super_admin).
async function loadManageableTarget(id: string, actor: Actor) {
  const existing = await findById(id);
  if (!existing) throw ApiError.notFound("User not found.");
  if (!canManageUser(actor.role, existing.role_name)) {
    throw ApiError.forbidden(
      "You do not have permission to manage this account."
    );
  }
  return existing;
}

export async function editUser(
  id: string,
  input: UpdateUserInput,
  actor: Actor
): Promise<PublicUser> {
  await loadManageableTarget(id, actor);

  let roleId: number | undefined;
  if (input.role !== undefined) {
    // Changing a role is really assigning a new role, so it needs the same
    // permission as creating that role. This blocks promotion to admin by a
    // program_administrator.
    if (!canCreateRole(actor.role, input.role)) {
      throw ApiError.forbidden(
        `You do not have permission to assign the "${input.role}" role.`
      );
    }
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
  broadcastToAdmins("users");
  emitSync(id, { resource: "enrollment", action: "updated" });
  return updated;
}

export async function removeUser(id: string, actor: Actor): Promise<void> {
  if (id === actor.id) {
    throw ApiError.badRequest(
      "You cannot delete your own account from here. Use your profile settings."
    );
  }
  await loadManageableTarget(id, actor);
  // Their farms, fields, enrollments, assessments and visits go with them:
  // left behind they would be counted and listed with nobody to explain them.
  const ok = await deleteUserCascade(id);
  if (!ok) throw ApiError.notFound("User not found or already deleted.");
  await revokeAllForUser(id);
  broadcastToAdmins("users");
  broadcastToAdmins("farms");
  broadcastToAdmins("fields");
  broadcastToAdmins("enrollments");
}

/** What deleting this person would take with them, for the confirmation. */
export async function getUserDeletionSummary(
  id: string,
  actor: Actor
): Promise<DeletionLine[]> {
  await loadManageableTarget(id, actor);
  return summarizeUserDeletion(id);
}

export async function deleteOwnAccount(userId: string): Promise<void> {
  const ok = await deleteUserCascade(userId);
  if (!ok) throw ApiError.notFound("Account not found or already deleted.");
  await revokeAllForUser(userId);
}

export async function changeStatus(
  id: string,
  isActive: boolean,
  actor: Actor
): Promise<PublicUser> {
  if (id === actor.id && !isActive) {
    throw ApiError.badRequest("You cannot deactivate your own account.");
  }
  await loadManageableTarget(id, actor);
  const updated = await setUserStatus(id, isActive);
  if (!updated) throw ApiError.notFound("User not found.");
  // A deactivated user should not keep working with old sessions.
  if (!isActive) await revokeAllForUser(id);
  broadcastToAdmins("users");
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

export async function uploadOwnAvatar(
  userId: string,
  file: { buffer: Buffer; size?: number } | undefined
): Promise<PublicUser> {
  if (!file) {
    throw ApiError.badRequest("No image was uploaded. Please attach a photo.");
  }
  const url = await uploadAvatarImage(file);
  const updated = await setUserAvatar(userId, url);
  if (!updated) throw ApiError.notFound("User not found.");
  return updated;
}

export async function removeOwnAvatar(userId: string): Promise<PublicUser> {
  const updated = await setUserAvatar(userId, null);
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
  // Covers the case of a temporary password replaced from inside the account.
  await clearMustChangePassword(userId);

  void sendPasswordChangedEmail({ to: user.email, fullName: user.full_name });
}
