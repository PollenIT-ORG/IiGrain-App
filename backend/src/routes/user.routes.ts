import { Router } from "express";
import {
  createUser,
  listUsers,
  listAssessors,
  getUser,
  updateUser,
  deleteUser,
  restoreUser,
  setUserStatus,
  assignAssessor,
  unassignAssessor,
} from "../controllers/user.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  createUserSchema,
  updateUserSchema,
  setStatusSchema,
  listUsersQuerySchema,
  assignAssessorToUserSchema,
} from "../validators/user.schema.js";
import { idParamSchema } from "../validators/common.schema.js";

const router = Router();
const withId = validate(idParamSchema, "params");

router.use(
  authenticate,
  authorize("super_admin", "admin", "program_administrator")
);

router.post("/", validate(createUserSchema), createUser);
router.get("/", validate(listUsersQuerySchema, "query"), listUsers);
router.get("/assessors", listAssessors);
router.get("/:id", withId, getUser);
router.patch("/:id", withId, validate(updateUserSchema), updateUser);
router.delete("/:id", withId, deleteUser);
router.post("/:id/restore", withId, restoreUser);
router.patch("/:id/status", withId, validate(setStatusSchema), setUserStatus);
router.put(
  "/:id/assessor",
  withId,
  validate(assignAssessorToUserSchema),
  assignAssessor
);
router.delete("/:id/assessor", withId, unassignAssessor);

export default router;
