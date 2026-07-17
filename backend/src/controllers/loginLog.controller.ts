import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { listLoginLogs } from "../models/loginLog.model.js";

export const getLoginLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10)
  );
  const offset = (page - 1) * limit;

  const { rows, total } = await listLoginLogs(limit, offset);

  return ApiResponse.send(res, 200, "Login logs fetched.", { logs: rows }, {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});
