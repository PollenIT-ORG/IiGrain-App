import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  getEmailSettings,
  updateEmailSettings,
  sendTestEmail,
} from "../controllers/emailSettings.controller.js";
import {
  updateEmailSettingsSchema,
  testEmailSchema,
} from "../validators/emailSettings.schema.js";

const router = Router();

// Mail credentials belong to the platform team alone: whoever holds them can
// send as the platform, so a program administrator never sees this.
router.use(authenticate, authorize("super_admin", "admin"));

router.get("/", getEmailSettings);
router.put("/", validate(updateEmailSettingsSchema), updateEmailSettings);
router.post("/test", validate(testEmailSchema), sendTestEmail);

export default router;
