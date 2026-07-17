import { Router } from "express";
import {
  createOrganization,
  listOrganizations,
  getOrganization,
  getCurrentOrganization,
  updateOrganization,
  deleteOrganization,
  assignUser,
  unassignUser,
} from "../controllers/organization.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  createOrgSchema,
  updateOrgSchema,
  listOrgsQuerySchema,
  assignUserSchema,
} from "../validators/org.schema.js";

const router = Router();

router.use(authenticate, authorize("super_admin", "admin"));

router.post("/", validate(createOrgSchema), createOrganization);
router.get("/", validate(listOrgsQuerySchema, "query"), listOrganizations);
router.get("/current", getCurrentOrganization);
router.get("/:id", getOrganization);
router.patch("/:id", validate(updateOrgSchema), updateOrganization);
router.delete("/:id", deleteOrganization);

router.post("/:id/users", validate(assignUserSchema), assignUser);
router.delete("/:id/users/:userId", unassignUser);

export default router;
