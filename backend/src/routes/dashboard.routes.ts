import { Router } from "express";
import { z } from "zod";
import {
  myDashboardFarms,
  farmDashboard,
  farmSummary,
  myDashboardPrograms,
  programSummary,
  adminDashboard,
  programDashboard,
} from "../controllers/dashboard.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { paginationQuerySchema } from "../validators/pagination.schema.js";

const router = Router();

const farmerOnly = [authenticate, authorize("farmer")];
const adminOnly = [authenticate, authorize("super_admin", "admin")];

const farmIdParamSchema = z.object({
  farmId: z.string().uuid("Invalid farm id."),
});

const programIdParamSchema = z.object({
  programId: z.string().uuid("Invalid program id."),
});

const farmSummaryQuerySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2000, "Invalid year.")
    .max(2100, "Invalid year.")
    .optional(),
  trendYears: z.coerce
    .number()
    .int()
    .min(1, "trendYears must be between 1 and 20.")
    .max(20, "trendYears must be between 1 and 20.")
    .optional(),
});

router.get("/admin", ...adminOnly, adminDashboard);
// The programs summary, which a program administrator sees for their own.
router.get(
  "/programs",
  authenticate,
  authorize("super_admin", "admin", "program_administrator"),
  programDashboard
);

router.get(
  "/my/farms",
  ...farmerOnly,
  validate(paginationQuerySchema, "query"),
  myDashboardFarms
);
router.get(
  "/my/farms/:farmId",
  ...farmerOnly,
  validate(farmIdParamSchema, "params"),
  farmDashboard
);
// Dedicated summary: year picker + Regen Health Index trend + category scores.
router.get(
  "/my/farms/:farmId/summary",
  ...farmerOnly,
  validate(farmIdParamSchema, "params"),
  validate(farmSummaryQuerySchema, "query"),
  farmSummary
);

// Programs the farmer is enrolled in, each with its fields and how many are assessed.
router.get(
  "/my/programs",
  ...farmerOnly,
  validate(paginationQuerySchema, "query"),
  myDashboardPrograms
);
// The same summary as a farm's, worked out for one program.
router.get(
  "/my/programs/:programId/summary",
  ...farmerOnly,
  validate(programIdParamSchema, "params"),
  validate(farmSummaryQuerySchema, "query"),
  programSummary
);

export default router;
