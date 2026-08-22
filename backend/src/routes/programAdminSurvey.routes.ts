import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { handleUpload } from "../middlewares/handleUpload.js";
import { contractPdfUpload } from "../config/multer.js";
import { idParamSchema } from "../validators/common.schema.js";
import {
  templateCreateSchema,
  templateUpdateSchema,
  categorySchema,
  categoryUpdateSchema,
  questionSchema,
  questionUpdateSchema,
  scoringRuleSchema,
  programCreateSchema,
  programUpdateSchema,
  contractTemplateCreateSchema,
  contractTemplateUpdateSchema,
  shareProgramSchema,
  setCategorySchema,
  listSubmissionsQuerySchema,
  submissionStatsQuerySchema,
  templateIdParamSchema,
  scoringRuleParamsSchema,
} from "../validators/programAdminSurvey.schema.js";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  templateDeletionSummary,
  createCategory,
  updateCategory,
  deleteCategory,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  updateScoringRule,
  listPrograms,
  getProgram,
  createProgram,
  updateProgram,
  deleteProgram,
  shareProgram,
  listContractTemplates,
  getContractTemplate,
  createContractTemplate,
  uploadContractTemplate,
  getContractTemplatePdf,
  getSignedContractPdf,
  updateContractTemplate,
  deleteContractTemplate,
  makeContractTemplateGlobal,
  makeTemplateGlobal,
  listSubmissions,
  submissionStats,
  getSubmission,
  setCategory,
  sendContract,
  acceptAndEnroll,
  withdrawSubmission,
  deleteSubmission,
} from "../controllers/programAdminSurvey.controller.js";

const router = Router();
const withId = validate(idParamSchema, "params");
const withTemplateId = validate(templateIdParamSchema, "params");

// Same guard as the rest of the admin portal. Program administrators are scoped
// to their own data inside the controllers.
router.use(authenticate, authorize("super_admin", "admin", "program_administrator"));

// Templates
router.get("/templates", listTemplates);
router.post("/templates", validate(templateCreateSchema), createTemplate);
router.get("/templates/:id", withId, getTemplate);
router.patch("/templates/:id", withId, validate(templateUpdateSchema), updateTemplate);
router.get("/templates/:id/deletion-summary", withId, templateDeletionSummary);
router.delete("/templates/:id", withId, deleteTemplate);
// Which survey new ones are copied from.
router.post("/templates/:id/global", withId, makeTemplateGlobal);

// Categories + questions live under a template.
router.post(
  "/templates/:templateId/categories",
  withTemplateId,
  validate(categorySchema),
  createCategory
);
router.post(
  "/templates/:templateId/questions",
  withTemplateId,
  validate(questionSchema),
  createQuestion
);
router.patch(
  "/templates/:templateId/scoring-rules/:ruleId",
  validate(scoringRuleParamsSchema, "params"),
  validate(scoringRuleSchema),
  updateScoringRule
);

router.patch("/categories/:id", withId, validate(categoryUpdateSchema), updateCategory);
router.delete("/categories/:id", withId, deleteCategory);
router.patch("/questions/:id", withId, validate(questionUpdateSchema), updateQuestion);
router.delete("/questions/:id", withId, deleteQuestion);

// Programs (a program + its attached survey/link)
router.get("/programs", listPrograms);
router.post("/programs", validate(programCreateSchema), createProgram);
router.get("/programs/:id", withId, getProgram);
router.patch("/programs/:id", withId, validate(programUpdateSchema), updateProgram);
router.delete("/programs/:id", withId, deleteProgram);
router.post("/programs/:id/share", withId, validate(shareProgramSchema), shareProgram);

// Contract templates (global read-only + the caller's own).
//
// A contract is legal wording, so only the platform team writes one. A program
// administrator reads it, uploads the PDF they were sent, and attaches it to
// their programs - which is why authoring is gated here as well as in the
// service: they should be turned away before any work is done.
const authorsContracts = authorize("super_admin", "admin");

router.get("/contracts", listContractTemplates);
router.post(
  "/contracts",
  authorsContracts,
  validate(contractTemplateCreateSchema),
  createContractTemplate
);
// A program administrator uploads the PDF they were sent.
router.post(
  "/contracts/upload",
  handleUpload(contractPdfUpload.single("file")),
  uploadContractTemplate
);
router.get("/contracts/:id", withId, getContractTemplate);
router.get("/contracts/:id/pdf", withId, getContractTemplatePdf);
router.patch(
  "/contracts/:id",
  authorsContracts,
  withId,
  validate(contractTemplateUpdateSchema),
  updateContractTemplate
);
// Their own uploaded PDF is theirs to remove; the service keeps written ones
// out of a program administrator's hands.
router.delete("/contracts/:id", withId, deleteContractTemplate);
// Which contract every program falls back to.
router.post(
  "/contracts/:id/global",
  authorsContracts,
  withId,
  makeContractTemplateGlobal
);

// Submissions (scoped to the caller's programs)
router.get(
  "/submissions",
  validate(listSubmissionsQuerySchema, "query"),
  listSubmissions
);
router.get(
  "/submissions/stats",
  validate(submissionStatsQuerySchema, "query"),
  submissionStats
);
router.get("/submissions/:id", withId, getSubmission);
router.get("/submissions/:id/signed-pdf", withId, getSignedContractPdf);
router.patch(
  "/submissions/:id/category",
  withId,
  validate(setCategorySchema),
  setCategory
);
router.post("/submissions/:id/send-contract", withId, sendContract);
router.post("/submissions/:id/accept", withId, acceptAndEnroll);
router.post("/submissions/:id/withdraw", withId, withdrawSubmission);
router.delete("/submissions/:id", withId, deleteSubmission);

export default router;
