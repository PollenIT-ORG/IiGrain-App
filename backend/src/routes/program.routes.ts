import { Router } from "express";
import {
  createProgram,
  listPrograms,
  getProgram,
  updateProgram,
  deleteProgram,
  listEnrollments,
  listEnrollmentsPaged,
  enrollFarmer,
  updateEnrollmentFields,
  setEnrollmentAssessor,
  getEnrollmentAssessments,
  unenroll,
  listSubmissions,
  myAvailablePrograms,
  myEnrollableFields,
  selfEnroll,
} from "../controllers/program.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  createProgramSchema,
  updateProgramSchema,
  listProgramsQuerySchema,
  enrollFarmerSchema,
  updateEnrollmentFieldsSchema,
  setEnrollmentAssessorSchema,
  listSubmissionsQuerySchema,
  listEnrollmentsQuerySchema,
  selfEnrollSchema,
  programIdParamSchema,
  enrollmentParamsSchema,
} from "../validators/program.schema.js";

const router = Router();

const programManagers = authorize(
  "super_admin",
  "admin",
  "program_administrator"
);

const farmerOnly = authorize("farmer");

router.get("/my/available", authenticate, farmerOnly, myAvailablePrograms);
router.get("/my/fields", authenticate, farmerOnly, myEnrollableFields);
router.post(
  "/:id/enroll-self",
  authenticate,
  farmerOnly,
  validate(programIdParamSchema, "params"),
  validate(selfEnrollSchema),
  selfEnroll
);

router.get(
  "/submissions",
  authenticate,
  programManagers,
  validate(listSubmissionsQuerySchema, "query"),
  listSubmissions
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
router.delete(
  "/:id/enrollments/:enrollmentId",
  authenticate,
  programManagers,
  validate(enrollmentParamsSchema, "params"),
  unenroll
);

export default router;
