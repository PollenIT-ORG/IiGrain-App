import { Router } from "express";
import {
  assignAssessor,
  listAssignments,
  unassignAssessor,
} from "../controllers/assessorAssignment.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  assignAssessorSchema,
  listAssignmentsQuerySchema,
  assignmentIdParamSchema,
} from "../validators/assessorAssignment.schema.js";

const router = Router();

const orgManagers = authorize("super_admin", "admin", "program_administrator");

router.post("/", authenticate, orgManagers, validate(assignAssessorSchema), assignAssessor);
router.get(
  "/",
  authenticate,
  orgManagers,
  validate(listAssignmentsQuerySchema, "query"),
  listAssignments
);
router.delete(
  "/:id",
  authenticate,
  orgManagers,
  validate(assignmentIdParamSchema, "params"),
  unassignAssessor
);

export default router;
