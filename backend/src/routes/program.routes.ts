import { Router } from "express";
import {
  createProgram,
  listPrograms,
  getProgram,
  updateProgram,
  setProgramVisibility,
  deleteProgram,
  programDeletionSummary,
  listEnrollments,
  listEnrollmentsPaged,
  enrollFarmer,
  updateEnrollmentFields,
  setEnrollmentAssessor,
  getEnrollmentAssessments,
  getProgramProgress,
  unenroll,
  listSubmissions,
  suggestCode,
  myAvailablePrograms,
  myEnrollableFields,
  selfEnroll,
  selfUnenrollField,
} from "../controllers/program.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  createProgramSchema,
  updateProgramSchema,
  setProgramVisibilitySchema,
  listProgramsQuerySchema,
  enrollFarmerSchema,
  updateEnrollmentFieldsSchema,
  setEnrollmentAssessorSchema,
  listSubmissionsQuerySchema,
  listEnrollmentsQuerySchema,
  codeSuggestionQuerySchema,
  selfEnrollSchema,
  programIdParamSchema,
  enrollmentParamsSchema,
  selfUnenrollParamsSchema,
} from "../validators/program.schema.js";
import { paginationQuerySchema } from "../validators/pagination.schema.js";

const router = Router();

const programManagers = authorize(
  "super_admin",
  "admin",
  "program_administrator"
);

const farmerOnly = authorize("farmer");

router.get("/my/available", authenticate, farmerOnly, myAvailablePrograms);
router.get(
  "/my/fields",
  authenticate,
  farmerOnly,
  validate(paginationQuerySchema, "query"),
  myEnrollableFields
);
router.post(
  "/:id/enroll-self",
  authenticate,
  farmerOnly,
  validate(programIdParamSchema, "params"),
  validate(selfEnrollSchema),
  selfEnroll
);
router.delete(
  "/:id/fields/:fieldId/unenroll",
  authenticate,
  farmerOnly,
  validate(selfUnenrollParamsSchema, "params"),
  selfUnenrollField
);

router.get(
  "/submissions",
  authenticate,
  programManagers,
  validate(listSubmissionsQuerySchema, "query"),
  listSubmissions
);

// Before ":id", or the id route would swallow it.
router.get(
  "/code-suggestion",
  authenticate,
  programManagers,
  validate(codeSuggestionQuerySchema, "query"),
  suggestCode
);

router.post("/", authenticate, programManagers, validate(createProgramSchema), createProgram);
router.get(
  "/",
  authenticate,
  programManagers,
  validate(listProgramsQuerySchema, "query"),
  listPrograms
);
router.get(
  "/:id",
  authenticate,
  programManagers,
  validate(programIdParamSchema, "params"),
  getProgram
);
router.patch(
  "/:id",
  authenticate,
  programManagers,
  validate(programIdParamSchema, "params"),
  validate(updateProgramSchema),
  updateProgram
);
// The toggle that offers a program to farmers already on the platform.
router.patch(
  "/:id/visibility",
  authenticate,
  programManagers,
  validate(programIdParamSchema, "params"),
  validate(setProgramVisibilitySchema),
  setProgramVisibility
);
router.get(
  "/:id/deletion-summary",
  authenticate,
  programManagers,
  validate(programIdParamSchema, "params"),
  programDeletionSummary
);
router.delete(
  "/:id",
  authenticate,
  programManagers,
  validate(programIdParamSchema, "params"),
  deleteProgram
);

router.get(
  "/:id/enrollments",
  authenticate,
  programManagers,
  validate(programIdParamSchema, "params"),
  listEnrollments
);
router.get(
  "/:id/enrollments/paged",
  authenticate,
  programManagers,
  validate(programIdParamSchema, "params"),
  validate(listEnrollmentsQuerySchema, "query"),
  listEnrollmentsPaged
);
router.post(
  "/:id/enrollments",
  authenticate,
  programManagers,
  validate(programIdParamSchema, "params"),
  validate(enrollFarmerSchema),
  enrollFarmer
);
router.patch(
  "/:id/enrollments/:enrollmentId",
  authenticate,
  programManagers,
  validate(enrollmentParamsSchema, "params"),
  validate(updateEnrollmentFieldsSchema),
  updateEnrollmentFields
);
router.put(
  "/:id/enrollments/:enrollmentId/assessor",
  authenticate,
  programManagers,
  validate(enrollmentParamsSchema, "params"),
  validate(setEnrollmentAssessorSchema),
  setEnrollmentAssessor
);
router.get(
  "/:id/enrollments/:enrollmentId/assessments",
  authenticate,
  programManagers,
  validate(enrollmentParamsSchema, "params"),
  getEnrollmentAssessments
);
router.get(
  "/:id/assessment-progress",
  authenticate,
  programManagers,
  validate(programIdParamSchema, "params"),
  getProgramProgress
);
router.delete(
  "/:id/enrollments/:enrollmentId",
  authenticate,
  programManagers,
  validate(enrollmentParamsSchema, "params"),
  unenroll
);

export default router;
