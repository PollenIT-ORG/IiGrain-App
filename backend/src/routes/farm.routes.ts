import { Router } from "express";
import {
  createFarm,
  listFarms,
  getFarm,
  updateFarm,
  deleteFarm,
  myFarms,
  myFarm,
  createMyFarm,
  updateMyFarm,
} from "../controllers/farm.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  createFarmSchema,
  createMyFarmSchema,
  updateFarmSchema,
  updateMyFarmSchema,
  listFarmsQuerySchema,
} from "../validators/farm.schema.js";
import { mobileFieldRouter } from "./field.routes.js";

const router = Router();

router.get("/me/farms", authenticate, myFarms);
router.post(
  "/me/farms",
  authenticate,
  validate(createMyFarmSchema),
  createMyFarm
);
router.get("/me/farms/:id", authenticate, myFarm);
router.patch(
  "/me/farms/:id",
  authenticate,
  validate(updateMyFarmSchema),
  updateMyFarm
);

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
router.get("/:id", authenticate, orgManagers, getFarm);
router.patch(
  "/:id",
  authenticate,
  orgManagers,
  validate(updateFarmSchema),
  updateFarm
);
router.delete("/:id", authenticate, orgManagers, deleteFarm);

export default router;
