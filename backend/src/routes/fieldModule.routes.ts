import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate, validateWith } from "../middlewares/validate.js";
import { handleUpload } from "../middlewares/handleUpload.js";
import { documentUpload } from "../config/multer.js";
import {
  moduleParamsSchema,
  moduleRecordParamsSchema,
  fieldProgramParamsSchema,
  farmParamsSchema,
  farmProgramParamsSchema,
  farmModuleParamsSchema,
  documentParamsSchema,
  createDocumentSchema,
  uploadDocumentSchema,
  listDocumentsQuerySchema,
  bodySchemaFor,
} from "../validators/fieldModule.schema.js";
import {
  getModules,
  getFarmPrograms,
  getFarmModules,
  listFarmModuleRecords,
  listModuleRecords,
  getModuleRecord,
  createModuleRecord,
  updateModuleRecord,
  deleteModuleRecord,
  listModuleDocuments,
  createModuleDocument,
  uploadModuleDocument,
  deleteModuleDocument,
} from "../controllers/fieldModule.controller.js";

const router = Router();

/**
 * Field monitoring modules.
 *
 * Mounted under /field-monitoring, and every path names its program and field
 * because a record only means something as a combination of the two.
 *
 * Who may call these: the farmer who owns the field, and your team. The route
 * lets both in and the service then decides, because a farmer must be held to
 * their own fields while staff see everything. Assessors are deliberately not
 * on this list yet: they would need to be limited to the farmers assigned to
 * them, and that rule does not exist here.
 */
const canRecord = authorize(
  "farmer",
  "super_admin",
  "admin",
  "program_administrator"
);

// Opening a farm: which programs its fields are enrolled in, and which fields
// belong to each. This is what lets a workbook be downloaded from the farm.
router.get(
  "/farms/:farmId/programs",
  authenticate,
  canRecord,
  validate(farmParamsSchema, "params"),
  getFarmPrograms
);

// The same nine modules, but for a whole farm at once. This is what the farm
// screen shows: one table per module covering every field of the farm.
router.get(
  "/farms/:farmId/programs/:programId/modules",
  authenticate,
  canRecord,
  validate(farmProgramParamsSchema, "params"),
  getFarmModules
);
router.get(
  "/farms/:farmId/programs/:programId/modules/:module",
  authenticate,
  canRecord,
  validate(farmModuleParamsSchema, "params"),
  listFarmModuleRecords
);

// The nine-module list a field opens with, each with its counts.
router.get(
  "/programs/:programId/fields/:fieldId/modules",
  authenticate,
  canRecord,
  validate(fieldProgramParamsSchema, "params"),
  getModules
);

// Records inside one module. The body schema is picked from :module, since
// every module carries its own columns.
router
  .route("/programs/:programId/fields/:fieldId/modules/:module")
  .get(
    authenticate,
    canRecord,
    validate(moduleParamsSchema, "params"),
    listModuleRecords
  )
  .post(
    authenticate,
    canRecord,
    validate(moduleParamsSchema, "params"),
    validateWith((req) => bodySchemaFor(req.params.module, false), "Unknown module."),
    createModuleRecord
  );

router
  .route("/programs/:programId/fields/:fieldId/modules/:module/:id")
  .get(
    authenticate,
    canRecord,
    validate(moduleRecordParamsSchema, "params"),
    getModuleRecord
  )
  .patch(
    authenticate,
    canRecord,
    validate(moduleRecordParamsSchema, "params"),
    // Partial, so a farmer can change one thing without resending the row.
    validateWith((req) => bodySchemaFor(req.params.module, true), "Unknown module."),
    updateModuleRecord
  )
  .delete(
    authenticate,
    canRecord,
    validate(moduleRecordParamsSchema, "params"),
    deleteModuleRecord
  );

// Attachments: lab reports, certificates, photos, and the loose files the
// admin panel uploads against a module rather than a row.
router
  .route("/programs/:programId/fields/:fieldId/documents")
  .get(
    authenticate,
    canRecord,
    validate(fieldProgramParamsSchema, "params"),
    validate(listDocumentsQuerySchema, "query"),
    listModuleDocuments
  )
  .post(
    authenticate,
    canRecord,
    validate(fieldProgramParamsSchema, "params"),
    validate(createDocumentSchema),
    createModuleDocument
  );

// The drag and drop box. PDF, image or Word, up to 10 MB, enforced by the
// uploader before the request body is even read.
router.post(
  "/programs/:programId/fields/:fieldId/documents/upload",
  authenticate,
  canRecord,
  validate(fieldProgramParamsSchema, "params"),
  handleUpload(documentUpload.single("file")),
  validate(uploadDocumentSchema),
  uploadModuleDocument
);

router.delete(
  "/programs/:programId/fields/:fieldId/documents/:documentId",
  authenticate,
  canRecord,
  validate(documentParamsSchema, "params"),
  deleteModuleDocument
);

export default router;
