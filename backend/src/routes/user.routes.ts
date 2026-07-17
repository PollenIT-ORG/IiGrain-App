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

const router = Router();

router.use(
  authenticate,
  authorize("super_admin", "admin", "program_administrator")
);

router.post("/", validate(createUserSchema), createUser);
router.get("/", validate(listUsersQuerySchema, "query"), listUsers);
router.get("/assessors", listAssessors);
router.get("/:id", getUser);
router.patch("/:id", validate(updateUserSchema), updateUser);
router.delete("/:id", deleteUser);
router.post("/:id/restore", restoreUser);
router.patch("/:id/status", validate(setStatusSchema), setUserStatus);
router.put("/:id/assessor", validate(assignAssessorToUserSchema), assignAssessor);
router.delete("/:id/assessor", unassignAssessor);

export default router;
