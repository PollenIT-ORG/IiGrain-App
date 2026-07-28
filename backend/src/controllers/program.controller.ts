import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as service from "../services/program.service.js";
import type {
  CreateProgramBody,
  UpdateProgramBody,
  ListProgramsQuery,
  EnrollFarmerBody,
  UpdateEnrollmentFieldsBody,
  SetEnrollmentAssessorBody,
  ListSubmissionsQuery,
  SelfEnrollBody,
  ListEnrollmentsQuery,
} from "../validators/program.schema.js";
import type { PaginationQuery } from "../validators/pagination.schema.js";

function actorOf(req: Request): service.Actor {
  const id = req.user?.sub;
  if (!id) throw ApiError.unauthorized("Authentication required.");
  return { id, role: req.user!.role };
}

export const createProgram = asyncHandler(async (req: Request, res: Response) => {
  const program = await service.addProgram(req.body as CreateProgramBody, actorOf(req));
  return ApiResponse.send(res, 201, "Program created.", { program });
});

export const listPrograms = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListProgramsQuery;
  const { programs, meta } = await service.getPrograms({
    page: q.page,
    limit: q.limit,
    isActive: q.isActive,
    search: q.search,
  });
  return ApiResponse.send(res, 200, "Programs fetched.", { programs }, meta);
});

export const getProgram = asyncHandler(async (req: Request, res: Response) => {
  const program = await service.getProgramById(req.params.id);
  return ApiResponse.send(res, 200, "Program fetched.", { program });
});

export const updateProgram = asyncHandler(async (req: Request, res: Response) => {
  const program = await service.editProgram(
    req.params.id,
    req.body as UpdateProgramBody
  );
  return ApiResponse.send(res, 200, "Program updated.", { program });
});

export const deleteProgram = asyncHandler(async (req: Request, res: Response) => {
  await service.removeProgram(req.params.id);
  return ApiResponse.send(res, 200, "Program deleted.");
});

export const listEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const enrollments = await service.getEnrollments(req.params.id);
  return ApiResponse.send(res, 200, "Enrollments fetched.", { enrollments });
});

export const listEnrollmentsPaged = asyncHandler(
  async (req: Request, res: Response) => {
    const q = req.query as unknown as ListEnrollmentsQuery;
    const { enrollments, meta } = await service.getEnrollmentsPaged({
      programId: req.params.id,
      page: q.page,
      limit: q.limit,
      search: q.search,
      assessor: q.assessor,
    });
    return ApiResponse.send(res, 200, "Enrollments fetched.", { enrollments }, meta);
  }
);

export const enrollFarmer = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as EnrollFarmerBody;
  const enrollment = await service.enrollFarmer(
    req.params.id,
    {
      farmerId: body.farmerId,
      fieldIds: body.fieldIds,
      assessorId: body.assessorId ?? null,
      note: body.note ?? null,
    },
    actorOf(req)
  );
  return ApiResponse.send(res, 201, "Farmer enrolled.", { enrollment });
});

export const updateEnrollmentFields = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as UpdateEnrollmentFieldsBody;
    const enrollment = await service.updateEnrollmentFields(
      req.params.id,
      req.params.enrollmentId,
      body.fieldIds
    );
    return ApiResponse.send(res, 200, "Enrollment updated.", { enrollment });
  }
);

export const setEnrollmentAssessor = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as SetEnrollmentAssessorBody;
    const enrollment = await service.updateEnrollmentAssessor(
      req.params.id,
      req.params.enrollmentId,
      body.assessorId ?? null,
      actorOf(req)
    );
    return ApiResponse.send(res, 200, "Assessor updated.", { enrollment });
  }
);

export const getEnrollmentAssessments = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await service.getEnrollmentAssessments(
      req.params.id,
      req.params.enrollmentId
    );
    return ApiResponse.send(res, 200, "Enrollment assessments fetched.", result);
  }
);

export const getProgramProgress = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await service.getProgramProgress(req.params.id);
    return ApiResponse.send(res, 200, "Program progress fetched.", result);
  }
);

export const unenroll = asyncHandler(async (req: Request, res: Response) => {
  await service.unenroll(req.params.id, req.params.enrollmentId);
  return ApiResponse.send(res, 200, "Farmer unenrolled.");
});

function farmerId(req: Request): string {
  const id = req.user?.sub;
  if (!id) throw ApiError.unauthorized("Authentication required.");
  return id;
}

export const myAvailablePrograms = asyncHandler(async (req: Request, res: Response) => {
  const programs = await service.getAvailableProgramsForFarmer(farmerId(req));
  return ApiResponse.send(res, 200, "Available programs fetched.", { programs });
});

export const myEnrollableFields = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as PaginationQuery;
  const { fields, meta } = await service.getEnrollableFieldsForFarmer({
    farmerId: farmerId(req),
    page: q.page,
    limit: q.limit,
    search: q.search,
  });
  return ApiResponse.send(res, 200, "Enrollable fields fetched.", { fields }, meta);
});

export const selfEnroll = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as SelfEnrollBody;
  const enrollment = await service.selfEnroll(req.params.id, farmerId(req), {
    fieldIds: body.fieldIds,
    note: body.note ?? null,
  });
  return ApiResponse.send(res, 201, "Enrolled successfully.", { enrollment });
});

export const selfUnenrollField = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await service.selfUnenrollField(
      req.params.id,
      req.params.fieldId,
      farmerId(req)
    );
    return ApiResponse.send(res, 200, "Field unenrolled from the program.", result);
  }
);

export const listSubmissions = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListSubmissionsQuery;
  const result = await service.getSubmissions({
    page: q.page,
    limit: q.limit,
    programId: q.programId,
    authorRole: q.authorRole,
  });
  return ApiResponse.send(
    res,
    200,
    "Submissions fetched.",
    { submissions: result.submissions },
    result.meta
  );
});
