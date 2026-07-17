import { Router } from "express";
import {
  createField,
  listFields,
  getField,
  updateField,
  deleteField,
  myFarmFields,
  myFarmField,
  createMyField,
  updateMyField,
  deleteMyField,
} from "../controllers/field.controller.js";
import {
  getFieldDetails,
  getSoil,
  saveSoil,
  listDocuments,
  uploadDocument,
  deleteDocument,
  getAssessmentComparison,
} from "../controllers/fieldDetails.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { handleUpload } from "../middlewares/handleUpload.js";
import { documentUpload } from "../config/multer.js";
import {
  createFieldSchema,
  updateFieldSchema,
  listFieldsQuerySchema,
} from "../validators/field.schema.js";
import {
  fieldDetailsQuerySchema,
  upsertSoilSchema,
  fieldDocParamsSchema,
} from "../validators/fieldDetails.schema.js";

const router = Router();

const orgManagers = authorize("super_admin", "admin", "program_administrator");

router.post(
  "/",
  authenticate,
  orgManagers,
  validate(createFieldSchema),
  createField
);
router.get(
  "/",
  authenticate,
  orgManagers,
  validate(listFieldsQuerySchema, "query"),
  listFields
);
router.get("/:id", authenticate, orgManagers, getField);
router.patch(
  "/:id",
  authenticate,
  orgManagers,
  validate(updateFieldSchema),
  updateField
);
router.delete("/:id", authenticate, orgManagers, deleteField);

router.get(
  "/:id/details",
  authenticate,
  validate(fieldDetailsQuerySchema, "query"),
  getFieldDetails
);

router.get("/:id/soil", authenticate, getSoil);
router.put("/:id/soil", authenticate, validate(upsertSoilSchema), saveSoil);

router.get("/:id/documents", authenticate, listDocuments);
router.post(
  "/:id/documents",
  authenticate,
  handleUpload(documentUpload.single("file")),
  uploadDocument
);
router.delete(
  "/:id/documents/:docId",
  authenticate,
  validate(fieldDocParamsSchema, "params"),
  deleteDocument
);

router.get("/:id/assessment-comparison", authenticate, getAssessmentComparison);

export default router;

export const mobileFieldRouter = Router({ mergeParams: true });

mobileFieldRouter.get("/", authenticate, myFarmFields);
mobileFieldRouter.get("/:id", authenticate, myFarmField);
mobileFieldRouter.post("/", authenticate, validate(createFieldSchema), createMyField);
mobileFieldRouter.patch(
  "/:id",
  authenticate,
  validate(updateFieldSchema),
  updateMyField
);
mobileFieldRouter.delete("/:id", authenticate, deleteMyField);
