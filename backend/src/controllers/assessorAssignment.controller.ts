import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as service from "../services/assessorAssignment.service.js";
import type {
  AssignAssessorBody,
  ListAssignmentsQuery,
} from "../validators/assessorAssignment.schema.js";

export const assignAssessor = asyncHandler(async (req, res) => {
  const body = req.body as AssignAssessorBody;
  const assignment = await service.assignAssessor(body, {
    id: req.user!.sub,
    role: req.user!.role,
  });
  return ApiResponse.send(res, 201, "Assessor assigned successfully.", {
    assignment,
  });
});

export const listAssignments = asyncHandler(async (req, res) => {
  const q = req.query as unknown as ListAssignmentsQuery;
  const { rows, meta } = await service.getAssignments({
    assessorId: q.assessorId,
    farmerId: q.farmerId,
    page: q.page,
    limit: q.limit,
  });
  return ApiResponse.send(res, 200, "Assignments fetched.", { assignments: rows }, meta);
});

export const unassignAssessor = asyncHandler(async (req, res) => {
  await service.unassign(req.params.id);
  return ApiResponse.send(res, 200, "Assignment removed successfully.");
});
