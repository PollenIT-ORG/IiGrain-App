import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as userService from "../services/user.service.js";
import { getUserOrgId } from "../models/user.model.js";
import { findOrgById } from "../models/organization.model.js";
import type {
  UpdateProfileBody,
  ChangePasswordBody,
} from "../validators/user.schema.js";

function currentUserId(req: { user?: { sub: string } }): string {
  if (!req.user) throw ApiError.unauthorized("Authentication required.");
  return req.user.sub;
}

export const getMyProfile = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(currentUserId(req));
  return ApiResponse.send(res, 200, "Profile fetched.", { user });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const body = req.body as UpdateProfileBody;
  const user = await userService.updateOwnProfile(currentUserId(req), body);
  return ApiResponse.send(res, 200, "Profile updated successfully.", { user });
});

export const getMyOrganization = asyncHandler(async (req, res) => {
  const orgId = await getUserOrgId(currentUserId(req));
  const organization = orgId ? await findOrgById(orgId) : null;
  return ApiResponse.send(res, 200, "Organization fetched.", { organization });
});

export const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body as ChangePasswordBody;
  await userService.changeOwnPassword(
    currentUserId(req),
    currentPassword,
    newPassword
  );
  return ApiResponse.send(res, 200, "Password changed successfully.");
});

export const deleteMyAccount = asyncHandler(async (req, res) => {
  await userService.deleteOwnAccount(currentUserId(req));
  return ApiResponse.send(res, 200, "Your account has been deleted.");
});
