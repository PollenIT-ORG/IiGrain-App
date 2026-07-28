import { Router } from "express";
import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  getMyOrganization,
  deleteMyAccount,
  uploadMyAvatar,
  removeMyAvatar,
} from "../controllers/profile.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { handleUpload } from "../middlewares/handleUpload.js";
import { avatarUpload } from "../config/multer.js";
import {
  updateProfileSchema,
  changePasswordSchema,
} from "../validators/user.schema.js";

const router = Router();

router.use(authenticate);

router.get("/me", getMyProfile);
router.patch("/me", validate(updateProfileSchema), updateMyProfile);
router.delete("/me", deleteMyAccount);
router.post(
  "/me/avatar",
  handleUpload(avatarUpload.single("avatar")),
  uploadMyAvatar
);
router.delete("/me/avatar", removeMyAvatar);
router.get("/organization", getMyOrganization);
router.post(
  "/change-password",
  validate(changePasswordSchema),
  changeMyPassword
);

export default router;
