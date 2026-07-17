import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { listSelfSignupRoles } from "../models/role.model.js";

export const getRoles = asyncHandler(async (_req, res) => {
  const roles = await listSelfSignupRoles();
  return ApiResponse.send(res, 200, "Roles fetched.", { roles });
});
