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
  uploadOrgLogo,
  removeOrgLogo,
  uploadOrgFavicon,
  removeOrgFavicon,
} from "../controllers/organization.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { handleUpload } from "../middlewares/handleUpload.js";
import { avatarUpload } from "../config/multer.js";
import {
  createOrgSchema,
  updateOrgSchema,
  listOrgsQuerySchema,
  assignUserSchema,
} from "../validators/org.schema.js";
import { idParamSchema, uuidField } from "../validators/common.schema.js";
import { z } from "zod";

const router = Router();
const withId = validate(idParamSchema, "params");
const withIdAndUserId = validate(
  z.object({ id: uuidField("organization id"), userId: uuidField("user id") }),
  "params"
);

router.use(authenticate, authorize("super_admin", "admin"));

router.post("/", validate(createOrgSchema), createOrganization);
router.get("/", validate(listOrgsQuerySchema, "query"), listOrganizations);
router.get("/current", getCurrentOrganization);
router.get("/:id", withId, getOrganization);
router.patch("/:id", withId, validate(updateOrgSchema), updateOrganization);
router.delete("/:id", withId, deleteOrganization);

router.post("/:id/users", withId, validate(assignUserSchema), assignUser);
router.delete("/:id/users/:userId", withIdAndUserId, unassignUser);

// Branding: logo and favicon (multipart "file"). Admin-only via the router guard.
router.post(
  "/:id/logo",
  withId,
  handleUpload(avatarUpload.single("file")),
  uploadOrgLogo
);
router.delete("/:id/logo", withId, removeOrgLogo);
router.post(
  "/:id/favicon",
  withId,
  handleUpload(avatarUpload.single("file")),
  uploadOrgFavicon
);
router.delete("/:id/favicon", withId, removeOrgFavicon);

export default router;
