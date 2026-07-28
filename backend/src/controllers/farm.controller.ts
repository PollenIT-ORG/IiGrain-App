import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as farmService from "../services/farm.service.js";
import type {
  CreateFarmBody,
  CreateMyFarmBody,
  UpdateFarmBody,
  UpdateMyFarmBody,
  ListFarmsQuery,
  MyFarmsQuery,
} from "../validators/farm.schema.js";

export const createFarm = asyncHandler(async (req, res) => {
  const farm = await farmService.createFarmFor(req.body as CreateFarmBody);
  return ApiResponse.send(res, 201, "Farm created successfully.", { farm });
});

export const listFarms = asyncHandler(async (req, res) => {
  const q = req.query as unknown as ListFarmsQuery;
  const { farms, meta } = await farmService.getFarms({
    page: q.page,
    limit: q.limit,
    status: q.status,
    ownerId: q.ownerId,
    orgId: q.orgId,
    search: q.search,
    sortBy: q.sortBy,
    order: q.order,
  });
  return ApiResponse.send(res, 200, "Farms fetched.", { farms }, meta);
});

export const getFarm = asyncHandler(async (req, res) => {
  const farm = await farmService.getFarmById(req.params.id);
  return ApiResponse.send(res, 200, "Farm fetched.", { farm });
});

export const updateFarm = asyncHandler(async (req, res) => {
  const farm = await farmService.editFarm(
    req.params.id,
    req.body as UpdateFarmBody
  );
  return ApiResponse.send(res, 200, "Farm updated successfully.", { farm });
});

export const deleteFarm = asyncHandler(async (req, res) => {
  await farmService.removeFarm(req.params.id);
  return ApiResponse.send(res, 200, "Farm deleted successfully.");
});

export const resetFarm = asyncHandler(async (req, res) => {
  const farm = await farmService.resetFarmById(req.params.id);
  return ApiResponse.send(res, 200, "Farm reset successfully.", { farm });
});

export const myFarms = asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) throw ApiError.unauthorized("Authentication required.");
  const q = req.query as unknown as MyFarmsQuery;
  const { farms, meta } = await farmService.getMyFarms({
    ownerId: userId,
    page: q.page,
    limit: q.limit,
    search: q.search,
  });
  return ApiResponse.send(res, 200, "Your farms fetched.", { farms }, meta);
});

export const myFarm = asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) throw ApiError.unauthorized("Authentication required.");
  const farm = await farmService.getMyFarmById(userId, req.params.id);
  return ApiResponse.send(res, 200, "Farm fetched.", { farm });
});

export const createMyFarm = asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) throw ApiError.unauthorized("Authentication required.");
  const farm = await farmService.createMyFarm(
    userId,
    req.body as CreateMyFarmBody
  );
  return ApiResponse.send(res, 201, "Farm created successfully.", { farm });
});

export const updateMyFarm = asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) throw ApiError.unauthorized("Authentication required.");
  const farm = await farmService.editMyFarm(
    userId,
    req.params.id,
    req.body as UpdateMyFarmBody
  );
  return ApiResponse.send(res, 200, "Farm updated successfully.", { farm });
});

export const deleteMyFarm = asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) throw ApiError.unauthorized("Authentication required.");
  await farmService.removeMyFarm(userId, req.params.id);
  return ApiResponse.send(res, 200, "Farm deleted successfully.");
});

export const resetMyFarm = asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) throw ApiError.unauthorized("Authentication required.");
  const farm = await farmService.resetMyFarm(userId, req.params.id);
  return ApiResponse.send(res, 200, "Farm reset successfully.", { farm });
});
