import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as service from "../services/program.service.js";
import type {
  CreateProgramBody,
  UpdateProgramBody,
  SetProgramVisibilityBody,
  ListProgramsQuery,
  EnrollFarmerBody,
  UpdateEnrollmentFieldsBody,
  SetEnrollmentAssessorBody,
  ListSubmissionsQuery,
  SelfEnrollBody,
  ListEnrollmentsQuery,
} from "../validators/program.schema.js";
import type { PaginationQuery } from "../validators/pagination.schema.js";

/** The query, for the handful of places that read a filter before validation. */
function q0(req: Request): Record<string, unknown> {
  return req.query as unknown as Record<string, unknown>;
}

/** True for a role that may only work with the programs it created. */
function ownProgramsOnly(role: string): boolean {
  return role === "program_administrator";
}

/**
 * Keeps a program administrator inside their own programs. Someone else's
 * program is reported as missing rather than forbidden, so the listing and the
 * detail tell the same story.
 */
async function assertOwnProgram(req: Request, id: string): Promise<void> {
  const actor = actorOf(req);
  if (!id || !ownProgramsOnly(actor.role)) return;
  const program = await service.getProgramById(id);
  if (program.created_by !== actor.id) {
    throw ApiError.notFound("Program not found.");
  }
}

function actorOf(req: Request): service.Actor {
  const id = req.user?.sub;
  if (!id) throw ApiError.unauthorized("Authentication required.");
  return { id, role: req.user!.role };
}

export const createProgram = asyncHandler(async (req: Request, res: Response) => {
  const program = await service.addProgram(req.body as CreateProgramBody, actorOf(req));
  return ApiResponse.send(res, 201, "Program created.", { program });
});

/** A code for a program being typed, so the form can fill it in as they go. */
export const suggestCode = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.query as { name?: string };
  const code = await service.suggestProgramCode((name ?? "").trim());
  return ApiResponse.send(res, 200, "Code suggested.", { code });
});

export const listPrograms = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListProgramsQuery;
  const actor = actorOf(req);
  const { programs, meta } = await service.getPrograms({
    page: q.page,
    limit: q.limit,
    status: q.status,
    search: q.search,
    // A program administrator runs their own programs and sees only those.
    createdBy: ownProgramsOnly(actor.role) ? actor.id : undefined,
  });
  return ApiResponse.send(res, 200, "Programs fetched.", { programs }, meta);
});

export const getProgram = asyncHandler(async (req: Request, res: Response) => {
  await assertOwnProgram(req, req.params.id);
  const program = await service.getProgramDetail(req.params.id);
  return ApiResponse.send(res, 200, "Program fetched.", { program });
});

export const updateProgram = asyncHandler(async (req: Request, res: Response) => {
  await assertOwnProgram(req, req.params.id);
  const program = await service.editProgram(
    req.params.id,
    req.body as UpdateProgramBody,
    actorOf(req)
  );
  return ApiResponse.send(res, 200, "Program updated.", { program });
});

/** What deleting this program takes with it, so the panel can spell it out. */
export const programDeletionSummary = asyncHandler(
  async (req: Request, res: Response) => {
    await assertOwnProgram(req, req.params.id);
    const items = await service.getProgramDeletionSummary(req.params.id);
    return ApiResponse.send(res, 200, "Deletion summary.", { items });
  }
);

export const deleteProgram = asyncHandler(async (req: Request, res: Response) => {
  await assertOwnProgram(req, req.params.id);
  await service.removeProgram(req.params.id);
  return ApiResponse.send(res, 200, "Program deleted.");
});

export const listEnrollments = asyncHandler(async (req: Request, res: Response) => {
  await assertOwnProgram(req, req.params.id);
  const enrollments = await service.getEnrollments(req.params.id);
  return ApiResponse.send(res, 200, "Enrollments fetched.", { enrollments });
});

export const listEnrollmentsPaged = asyncHandler(
  async (req: Request, res: Response) => {
  await assertOwnProgram(req, req.params.id);
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
  await assertOwnProgram(req, req.params.id);
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
  await assertOwnProgram(req, req.params.id);
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
  await assertOwnProgram(req, req.params.id);
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
  await assertOwnProgram(req, req.params.id);
    const result = await service.getEnrollmentAssessments(
      req.params.id,
      req.params.enrollmentId
    );
    return ApiResponse.send(res, 200, "Enrollment assessments fetched.", result);
  }
);

export const getProgramProgress = asyncHandler(
  async (req: Request, res: Response) => {
    await assertOwnProgram(req, req.params.id);
    const result = await service.getProgramProgress(req.params.id);
    return ApiResponse.send(res, 200, "Program progress fetched.", result);
  }
);

export const unenroll = asyncHandler(async (req: Request, res: Response) => {
  await assertOwnProgram(req, req.params.id);
  await service.unenroll(req.params.id, req.params.enrollmentId);
  return ApiResponse.send(res, 200, "Farmer unenrolled.");
});

function farmerId(req: Request): string {
  const id = req.user?.sub;
  if (!id) throw ApiError.unauthorized("Authentication required.");
  return id;
}

export const setProgramVisibility = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as SetProgramVisibilityBody;
    const program = await service.setProgramShownToFarmers(
      req.params.id,
      body.showToFarmers
    );
    return ApiResponse.send(
      res,
      200,
      body.showToFarmers
        ? "This program is now shown to enrolled farmers."
        : "This program is no longer shown to enrolled farmers.",
      { program }
    );
  }
);

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
  const actor = actorOf(req);
  if (q0(req).programId) await assertOwnProgram(req, q0(req).programId as string);
  const q = req.query as unknown as ListSubmissionsQuery;
  const result = await service.getSubmissions({
    page: q.page,
    limit: q.limit,
    programId: q.programId,
    fieldId: q.fieldId,
    authorRole: q.authorRole,
    reviewStatus: q.reviewStatus,
    // Not one program by id: the whole list belongs to their own programs.
    programOwnerId: ownProgramsOnly(actor.role) ? actor.id : undefined,
  });
  return ApiResponse.send(
    res,
    200,
    "Submissions fetched.",
    { submissions: result.submissions },
    result.meta
  );
});
