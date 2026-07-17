import { Router } from "express";
import { z } from "zod";
import {
  myDashboardFarms,
  farmDashboard,
  adminDashboard,
} from "../controllers/dashboard.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";

const router = Router();

const farmerOnly = [authenticate, authorize("farmer")];
const adminOnly = [authenticate, authorize("super_admin", "admin")];

const farmIdParamSchema = z.object({
  farmId: z.string().uuid("Invalid farm id."),
});

router.get("/admin", ...adminOnly, adminDashboard);

router.get("/my/farms", ...farmerOnly, myDashboardFarms);
router.get(
  "/my/farms/:farmId",
  ...farmerOnly,
  validate(farmIdParamSchema, "params"),
  farmDashboard
);

export default router;
