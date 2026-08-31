import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate, validateWith } from "../middlewares/validate.js";
import { handleUpload } from "../middlewares/handleUpload.js";
import { documentUpload } from "../config/multer.js";
import {
  moduleParamsSchema,
  moduleRecordParamsSchema,
  fieldParamsSchema,
  farmParamsSchema,
  farmModuleParamsSchema,
  documentParamsSchema,
  createDocumentSchema,
  uploadDocumentSchema,
  listDocumentsQuerySchema,
  bodySchemaFor,
} from "../validators/fieldModule.schema.js";
import {
  getModules,
  getFarmFields,
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
 * Field monitoring modules, mounted under /field-monitoring. A record belongs
 * to a field and nothing else.
 *
 * Who may call these: the farmer who owns the field, and staff. The route lets
 * both in and the service then decides, because a farmer must be held to their
 * own fields while staff see everything. Assessors are deliberately left off:
 * they would need limiting to the farmers assigned to them.
 */
const canRecord = authorize(
  "farmer",
  "super_admin",
  "admin",
  "program_administrator"
);

// The farm as a whole: its fields, and the nine modules across all of them.
router.get(
  "/farms/:farmId/fields",
  authenticate,
  canRecord,
  validate(farmParamsSchema, "params"),
  getFarmFields
);
router.get(
  "/farms/:farmId/modules",
  authenticate,
  canRecord,
  validate(farmParamsSchema, "params"),
  getFarmModules
);
router.get(
  "/farms/:farmId/modules/:module",
  authenticate,
  canRecord,
  validate(farmModuleParamsSchema, "params"),
  listFarmModuleRecords
);

// The nine-module list a field opens with, each with its counts.
router.get(
  "/fields/:fieldId/modules",
  authenticate,
  canRecord,
  validate(fieldParamsSchema, "params"),
  getModules
);

// Records inside one module. The body schema is picked from :module, since
// every module carries its own columns.
router
  .route("/fields/:fieldId/modules/:module")
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
  .route("/fields/:fieldId/modules/:module/:id")
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
  .route("/fields/:fieldId/documents")
  .get(
    authenticate,
    canRecord,
    validate(fieldParamsSchema, "params"),
    validate(listDocumentsQuerySchema, "query"),
    listModuleDocuments
  )
  .post(
    authenticate,
    canRecord,
    validate(fieldParamsSchema, "params"),
    validate(createDocumentSchema),
    createModuleDocument
  );

// The drag and drop box. PDF, image or Word, up to 10 MB, enforced by the
// uploader before the request body is even read.
router.post(
  "/fields/:fieldId/documents/upload",
  authenticate,
  canRecord,
  validate(fieldParamsSchema, "params"),
  handleUpload(documentUpload.single("file")),
  validate(uploadDocumentSchema),
  uploadModuleDocument
);

router.delete(
  "/fields/:fieldId/documents/:documentId",
  authenticate,
  canRecord,
  validate(documentParamsSchema, "params"),
  deleteModuleDocument
);

export default router;
