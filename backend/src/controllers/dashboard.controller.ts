import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as service from "../services/dashboard.service.js";
import { getAdminDashboard, getProgramDashboard } from "../services/adminDashboard.service.js";
import type { PaginationQuery } from "../validators/pagination.schema.js";

function farmerId(req: Request): string {
  const id = req.user?.sub;
  if (!id) throw ApiError.unauthorized("Authentication required.");
  return id;
}

export const myDashboardFarms = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as PaginationQuery;
  const { farms, defaultFarmId, meta } = await service.getMyDashboardFarms({
    farmerId: farmerId(req),
    page: q.page,
    limit: q.limit,
    search: q.search,
  });
  return ApiResponse.send(
    res,
    200,
    "Dashboard farms fetched.",
    { farms, defaultFarmId },
    meta
  );
});

export const farmDashboard = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getFarmDashboard(req.params.farmId, farmerId(req));
  return ApiResponse.send(res, 200, "Farm dashboard fetched.", result);
});

export const myDashboardPrograms = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as PaginationQuery;
  const { programs, defaultProgramId, meta } = await service.getMyDashboardPrograms({
    farmerId: farmerId(req),
    page: q.page,
    limit: q.limit,
    search: q.search,
  });
  return ApiResponse.send(res, 200, "Dashboard programs fetched.", { programs, defaultProgramId }, meta);
});

export const programSummary = asyncHandler(async (req: Request, res: Response) => {
  const { year, trendYears } = req.query as unknown as { year?: number; trendYears?: number };
  const result = await service.getProgramSummaryReport(req.params.programId, farmerId(req), {
    year,
    trendYears,
  });
  return ApiResponse.send(res, 200, "Program summary fetched.", result);
});

export const farmSummary = asyncHandler(async (req: Request, res: Response) => {
  const { year, trendYears } = req.query as unknown as {
    year?: number;
    trendYears?: number;
  };
  const result = await service.getFarmSummaryReport(
    req.params.farmId,
    farmerId(req),
    { year, trendYears }
  );
  return ApiResponse.send(res, 200, "Farm summary fetched.", result);
});

export const adminDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const result = await getAdminDashboard();
  return ApiResponse.send(res, 200, "Admin dashboard fetched.", result);
});

export const programDashboard = asyncHandler(async (req: Request, res: Response) => {
  // A program administrator sees the totals for the programs they run.
  const ownerId =
    req.user?.role === "program_administrator" ? req.user.sub : null;
  const result = await getProgramDashboard(ownerId);
  return ApiResponse.send(res, 200, "Program dashboard fetched.", result);
});
