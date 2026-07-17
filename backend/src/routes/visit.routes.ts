import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  startVisitSchema,
  locationSchema,
  endVisitSchema,
  visitIdParamSchema,
} from "../validators/visit.schema.js";
import {
  startVisit,
  pushLocation,
  arriveVisit,
  endVisit,
  myAssessorVisit,
  myFarmerVisit,
  getVisit,
  listActiveVisits,
} from "../controllers/visit.controller.js";

const router = Router();

const assessorOnly = [authenticate, authorize("assessor")];
const farmerOnly = [authenticate, authorize("farmer")];
const adminOnly = [authenticate, authorize("super_admin", "admin")];

router.get("/active", ...adminOnly, listActiveVisits);
router.get("/mine/assessor", ...assessorOnly, myAssessorVisit);
router.get("/mine/farmer", ...farmerOnly, myFarmerVisit);

router.post("/", ...assessorOnly, validate(startVisitSchema), startVisit);
router.post(
  "/:id/location",
  ...assessorOnly,
  validate(visitIdParamSchema, "params"),
  validate(locationSchema),
  pushLocation
);
router.post(
  "/:id/arrive",
  ...assessorOnly,
  validate(visitIdParamSchema, "params"),
  arriveVisit
);
router.post(
  "/:id/end",
  ...assessorOnly,
  validate(visitIdParamSchema, "params"),
  validate(endVisitSchema),
  endVisit
);

router.get(
  "/:id",
  authenticate,
  validate(visitIdParamSchema, "params"),
  getVisit
);

export default router;
