import { Router } from "express";
import {
  createFarm,
  listFarms,
  getFarm,
  updateFarm,
  deleteFarm,
  farmDeletionSummary,
  resetFarm,
  myFarms,
  myFarm,
  createMyFarm,
  updateMyFarm,
  deleteMyFarm,
  resetMyFarm,
} from "../controllers/farm.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  createFarmSchema,
  createMyFarmSchema,
  updateFarmSchema,
  updateMyFarmSchema,
  listFarmsQuerySchema,
  myFarmsQuerySchema,
} from "../validators/farm.schema.js";
import { mobileFieldRouter } from "./field.routes.js";
import { idParamSchema } from "../validators/common.schema.js";

const router = Router();
const withId = validate(idParamSchema, "params");

router.get(
  "/me/farms",
  authenticate,
  validate(myFarmsQuerySchema, "query"),
  myFarms
);
router.post(
  "/me/farms",
  authenticate,
  validate(createMyFarmSchema),
  createMyFarm
);
router.get("/me/farms/:id", authenticate, withId, myFarm);
router.patch(
  "/me/farms/:id",
  authenticate,
  withId,
  validate(updateMyFarmSchema),
  updateMyFarm
);
router.delete("/me/farms/:id", authenticate, withId, deleteMyFarm);
router.post("/me/farms/:id/reset", authenticate, withId, resetMyFarm);

// farmId is validated inside mobileFieldRouter, where mergeParams exposes it
// together with the field id.
router.use("/:farmId/fields", mobileFieldRouter);

const orgManagers = authorize("super_admin", "admin", "program_administrator");

router.post("/", authenticate, orgManagers, validate(createFarmSchema), createFarm);
router.get(
  "/",
  authenticate,
  orgManagers,
  validate(listFarmsQuerySchema, "query"),
  listFarms
);
router.get("/:id", authenticate, orgManagers, withId, getFarm);
router.patch(
  "/:id",
  authenticate,
  orgManagers,
  withId,
  validate(updateFarmSchema),
  updateFarm
);
router.get(
  "/:id/deletion-summary",
  authenticate,
  orgManagers,
  withId,
  farmDeletionSummary
);
router.delete("/:id", authenticate, orgManagers, withId, deleteFarm);
router.post("/:id/reset", authenticate, orgManagers, withId, resetFarm);

export default router;
