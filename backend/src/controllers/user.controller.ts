import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as userService from "../services/user.service.js";
import type {
  CreateUserBody,
  UpdateUserBody,
  SetStatusBody,
  ListUsersQuery,
  AssignAssessorToUserBody,
} from "../validators/user.schema.js";

export const createUser = asyncHandler(async (req, res) => {
  const body = req.body as CreateUserBody;
  const user = await userService.createUser(body, {
    id: req.user!.sub,
    role: req.user!.role,
  });
  return ApiResponse.send(res, 201, "User created successfully.", { user });
});

export const listUsers = asyncHandler(async (req, res) => {
  const q = req.query as unknown as ListUsersQuery;
  const { users, meta } = await userService.getUsers({
    page: q.page,
    limit: q.limit,
    role: q.role,
    status: q.status,
    search: q.search,
    assessor: q.assessor,
  });
  return ApiResponse.send(res, 200, "Users fetched.", { users }, meta);
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  return ApiResponse.send(res, 200, "User fetched.", { user });
});

export const updateUser = asyncHandler(async (req, res) => {
  const body = req.body as UpdateUserBody;
  const user = await userService.editUser(req.params.id, body, {
    id: req.user!.sub,
    role: req.user!.role,
  });
  return ApiResponse.send(res, 200, "User updated successfully.", { user });
});

export const deleteUser = asyncHandler(async (req, res) => {
  await userService.removeUser(req.params.id, {
    id: req.user!.sub,
    role: req.user!.role,
  });
  return ApiResponse.send(res, 200, "User deleted successfully.");
});

export const restoreUser = asyncHandler(async (req, res) => {
  const user = await userService.restoreUserById(req.params.id, {
    id: req.user!.sub,
    role: req.user!.role,
  });
  return ApiResponse.send(res, 200, "User restored successfully.", { user });
});

export const setUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body as SetStatusBody;
  const user = await userService.changeStatus(req.params.id, isActive, {
    id: req.user!.sub,
    role: req.user!.role,
  });
  const label = isActive ? "activated" : "deactivated";
  return ApiResponse.send(res, 200, `User ${label} successfully.`, { user });
});

export const listAssessors = asyncHandler(async (_req, res) => {
  const assessors = await userService.getAssessorOptions();
  return ApiResponse.send(res, 200, "Assessors fetched.", { assessors });
});

export const assignAssessor = asyncHandler(async (req, res) => {
  const { assessorId } = req.body as AssignAssessorToUserBody;
  const user = await userService.assignUserAssessor(req.params.id, assessorId, {
    id: req.user!.sub,
    role: req.user!.role,
  });
  return ApiResponse.send(res, 200, "Assessor assigned successfully.", { user });
});

export const unassignAssessor = asyncHandler(async (req, res) => {
  const user = await userService.unassignUserAssessor(req.params.id);
  return ApiResponse.send(res, 200, "Assessor unassigned successfully.", { user });
});
