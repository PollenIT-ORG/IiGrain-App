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
  resetField,
  resetMyField,
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
import { idParamSchema, uuidField } from "../validators/common.schema.js";
import { z } from "zod";

const router = Router();
const withId = validate(idParamSchema, "params");
const withProgramQuery = validate(
  z.object({ programId: uuidField("program id").optional() }),
  "query"
);

// The mobile router uses mergeParams, so its schemas must list every param it
// inherits - a params schema strips whatever it does not declare.
const withFarmParam = validate(
  z.object({ farmId: uuidField("farm id") }),
  "params"
);
const withFarmAndId = validate(
  z.object({ farmId: uuidField("farm id"), id: uuidField("field id") }),
  "params"
);

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
router.get("/:id", authenticate, orgManagers, withId, getField);
router.patch(
  "/:id",
  authenticate,
  orgManagers,
  withId,
  validate(updateFieldSchema),
  updateField
);
router.delete("/:id", authenticate, orgManagers, withId, deleteField);
router.post("/:id/reset", authenticate, orgManagers, withId, resetField);

router.get(
  "/:id/details",
  authenticate,
  withId,
  validate(fieldDetailsQuerySchema, "query"),
  getFieldDetails
);

router.get("/:id/soil", authenticate, withId, getSoil);
router.put(
  "/:id/soil",
  authenticate,
  withId,
  validate(upsertSoilSchema),
  saveSoil
);

router.get("/:id/documents", authenticate, withId, listDocuments);
router.post(
  "/:id/documents",
  authenticate,
  withId,
  handleUpload(documentUpload.single("file")),
  uploadDocument
);
router.delete(
  "/:id/documents/:docId",
  authenticate,
  validate(fieldDocParamsSchema, "params"),
  deleteDocument
);

router.get(
  "/:id/assessment-comparison",
  authenticate,
  withId,
  withProgramQuery,
  getAssessmentComparison
);

export default router;

export const mobileFieldRouter = Router({ mergeParams: true });

mobileFieldRouter.get("/", authenticate, withFarmParam, myFarmFields);
mobileFieldRouter.get("/:id", authenticate, withFarmAndId, myFarmField);
mobileFieldRouter.post(
  "/",
  authenticate,
  withFarmParam,
  validate(createFieldSchema),
  createMyField
);
mobileFieldRouter.patch(
  "/:id",
  authenticate,
  withFarmAndId,
  validate(updateFieldSchema),
  updateMyField
);
mobileFieldRouter.delete("/:id", authenticate, withFarmAndId, deleteMyField);
mobileFieldRouter.post("/:id/reset", authenticate, withFarmAndId, resetMyField);
