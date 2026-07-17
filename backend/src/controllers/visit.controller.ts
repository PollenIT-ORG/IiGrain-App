import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as service from "../services/visit.service.js";
import { getIO } from "../socket/index.js";
import type {
  StartVisitBody,
  LocationBody,
  EndVisitBody,
} from "../validators/visit.schema.js";
import type { PublicVisit } from "../models/visit.model.js";

function userId(req: { user?: { sub: string } }): string {
  if (!req.user) throw ApiError.unauthorized("Authentication required.");
  return req.user.sub;
}

function broadcast(visit: PublicVisit, event: "visit:location" | "visit:status"): void {
  try {
    getIO().to(`visit:${visit.id}`).emit(event, visit);
  } catch {
    // socket not ready; the REST response still stands
  }
}

export const startVisit = asyncHandler(async (req, res) => {
  const body = req.body as StartVisitBody;
  const visit = await service.startVisit(userId(req), {
    fieldId: body.fieldId,
  });
  try {
    getIO().to(`user:${visit.farmer_id}`).emit("visit:incoming", visit);
  } catch {
    /* socket optional */
  }
  return ApiResponse.send(res, 201, "Visit started.", { visit });
});

export const pushLocation = asyncHandler(async (req, res) => {
  const body = req.body as LocationBody;
  const visit = await service.pushLocation(
    req.params.id,
    userId(req),
    body.latitude,
    body.longitude
  );
  broadcast(visit, "visit:location");
  return ApiResponse.send(res, 200, "Location updated.", { visit });
});

export const arriveVisit = asyncHandler(async (req, res) => {
  const visit = await service.arriveVisit(req.params.id, userId(req));
  broadcast(visit, "visit:status");
  return ApiResponse.send(res, 200, "Marked as arrived.", { visit });
});

export const endVisit = asyncHandler(async (req, res) => {
  const body = req.body as EndVisitBody;
  const visit = await service.finishVisit(
    req.params.id,
    userId(req),
    body.outcome
  );
  broadcast(visit, "visit:status");
  return ApiResponse.send(res, 200, "Visit ended.", { visit });
});

export const myAssessorVisit = asyncHandler(async (req, res) => {
  const visit = await service.getMyAssessorVisit(userId(req));
  return ApiResponse.send(res, 200, "Active visit fetched.", { visit });
});

export const myFarmerVisit = asyncHandler(async (req, res) => {
  const visit = await service.getMyFarmerVisit(userId(req));
  return ApiResponse.send(res, 200, "Active visit fetched.", { visit });
});

export const getVisit = asyncHandler(async (req, res) => {
  const visit = await service.getVisitForViewer(req.params.id, {
    id: userId(req),
    role: req.user!.role,
  });
  return ApiResponse.send(res, 200, "Visit fetched.", { visit });
});

export const listActiveVisits = asyncHandler(async (_req, res) => {
  const visits = await service.getActiveVisits();
  return ApiResponse.send(res, 200, "Active visits fetched.", { visits });
});
