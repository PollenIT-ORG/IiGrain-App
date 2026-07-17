import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import env from "../config/env.js";

export const getConfig = asyncHandler(async (_req, res) => {
  return ApiResponse.send(res, 200, "Config fetched.", {
    saasEnabled: env.saasEnabled,
  });
});
