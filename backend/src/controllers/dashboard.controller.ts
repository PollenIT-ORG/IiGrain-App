import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as service from "../services/dashboard.service.js";
import { getAdminDashboard } from "../services/adminDashboard.service.js";

function farmerId(req: Request): string {
  const id = req.user?.sub;
  if (!id) throw ApiError.unauthorized("Authentication required.");
  return id;
}

export const myDashboardFarms = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getMyDashboardFarms(farmerId(req));
  return ApiResponse.send(res, 200, "Dashboard farms fetched.", result);
});

export const farmDashboard = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getFarmDashboard(req.params.farmId, farmerId(req));
  return ApiResponse.send(res, 200, "Farm dashboard fetched.", result);
});

export const adminDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const result = await getAdminDashboard();
  return ApiResponse.send(res, 200, "Admin dashboard fetched.", result);
});
