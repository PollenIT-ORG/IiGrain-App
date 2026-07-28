import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import {
  createFieldFor,
  getFields,
  getFieldById,
  editField,
  removeField,
  getMyFarmFields,
  getMyFarmFieldById,
  createMyFarmField,
  editMyFarmField,
  removeMyFarmField,
  resetFieldById,
  resetMyFarmField,
} from "../services/field.service.js";

export const createField = asyncHandler(async (req: Request, res: Response) => {
  if (!req.body.farmId) throw ApiError.badRequest("farmId is required.");
  const field = await createFieldFor(req.body);
  ApiResponse.send(res, 201, "Field created successfully.", { field });
});

export const listFields = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, farmId, ownerId, isActive, search } =
    req.query as Record<string, string | undefined>;
  const result = await getFields({
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
    farmId: farmId || undefined,
    ownerId: ownerId || undefined,
    isActive:
      isActive === "true" ? true : isActive === "false" ? false : undefined,
    search: search || undefined,
  });
  ApiResponse.send(res, 200, "Fields retrieved successfully.", result, result.meta);
});

export const getField = asyncHandler(async (req: Request, res: Response) => {
  const field = await getFieldById(req.params.id);
  ApiResponse.send(res, 200, "Field retrieved successfully.", { field });
});

export const updateField = asyncHandler(async (req: Request, res: Response) => {
  const field = await editField(req.params.id, req.body);
  ApiResponse.send(res, 200, "Field updated successfully.", { field });
});

export const deleteField = asyncHandler(async (req: Request, res: Response) => {
  await removeField(req.params.id);
  ApiResponse.send(res, 200, "Field deleted successfully.");
});

export const resetField = asyncHandler(async (req: Request, res: Response) => {
  const field = await resetFieldById(req.params.id);
  ApiResponse.send(res, 200, "Field reset successfully.", { field });
});

export const myFarmFields = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const fields = await getMyFarmFields(req.params.farmId, userId);
  ApiResponse.send(res, 200, "Fields retrieved successfully.", { fields });
});

export const myFarmField = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const field = await getMyFarmFieldById(
    req.params.farmId,
    req.params.id,
    userId
  );
  ApiResponse.send(res, 200, "Field retrieved successfully.", { field });
});

export const createMyField = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const body = { ...req.body, farmId: req.params.farmId };
  const field = await createMyFarmField(req.params.farmId, userId, body);
  ApiResponse.send(res, 201, "Field created successfully.", { field });
});

export const updateMyField = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const field = await editMyFarmField(
    req.params.farmId,
    req.params.id,
    userId,
    req.body
  );
  ApiResponse.send(res, 200, "Field updated successfully.", { field });
});

export const deleteMyField = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  await removeMyFarmField(req.params.farmId, req.params.id, userId);
  ApiResponse.send(res, 200, "Field deleted successfully.");
});

export const resetMyField = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const field = await resetMyFarmField(req.params.farmId, req.params.id, userId);
  ApiResponse.send(res, 200, "Field reset successfully.", { field });
});
