import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { handleUpload } from "../middlewares/handleUpload.js";
import { importLimiter } from "../middlewares/rateLimiters.js";
import { excelUpload, evidenceUpload } from "../config/multer.js";
import {
  createTemplateSchema,
  listTemplatesQuerySchema,
  updateTemplateSchema,
  createCategorySchema,
  updateCategorySchema,
  reorderSchema,
  saveCategoryFieldsSchema,
  templateCategoryParamsSchema,
  createQuestionSchema,
  updateQuestionSchema,
  listQuestionsQuerySchema,
  idParamSchema,
  reviewScoresSchema,
  saveAnswerSchema,
  saveCategoryAnswersSchema,
  historyQuerySchema,
  programFieldParamsSchema,
  programFieldCategoryParamsSchema,
  programFieldRecordParamsSchema,
  programFieldCategoryQuestionParamsSchema,
  programFieldQuestionParamsSchema,
} from "../validators/assessment.schema.js";
import { paginationQuerySchema } from "../validators/pagination.schema.js";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  makeTemplateGlobal,
  lockTemplate,
  unlockTemplate,
} from "../controllers/assessmentTemplate.controller.js";
import {
  listTemplateCategories,
  createTemplateCategory,
  reorderTemplateCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  listTemplateQuestions,
  createTemplateQuestion,
  reorderTemplateQuestions,
  getQuestion,
  updateQuestion,
  deleteQuestion,
  importTemplateFromFile,
  importTemplateQuestions,
  saveTemplateCategoryFields,
  downloadImportSample,
  downloadTemplateQuestions,
} from "../controllers/assessment.controller.js";
import {
  getReview,
  saveReviewScores,
  approveReview,
} from "../controllers/assessmentReview.controller.js";
import {
  myFieldsAssessmentList,
  myAssessmentHistory,
  myFieldRegenIndex,
  myFieldAssessmentSummary,
  myFieldCategoryQuestions,
  myFieldCategoryQuestionList,
  myFieldQuestionDetail,
  saveMyFieldAnswer,
  saveMyFieldCategoryAnswers,
  addMyFieldRecord,
  saveMyFieldRecord,
  removeMyFieldRecord,
  myFieldReview,
  myFieldAssessmentHistory,
  submitMyFieldAssessment,
  discardMyFieldAssessment,
  uploadEvidence,
} from "../controllers/assessmentMobile.controller.js";

const router = Router();

// Program administrators work on templates too; what each role may change is decided per template in the service.
const templateManagers = [authenticate, authorize("super_admin", "admin", "program_administrator")];
const withId = validate(idParamSchema, "params");

router.post(
  "/evidence",
  authenticate,
  handleUpload(evidenceUpload.array("files", 5)),
  uploadEvidence
);
router.get(
  "/my/fields",
  authenticate,
  validate(paginationQuerySchema, "query"),
  myFieldsAssessmentList
);
router.get(
  "/my/history",
  authenticate,
  validate(historyQuerySchema, "query"),
  myAssessmentHistory
);
router.get(
  "/my/programs/:programId/fields/:fieldId/summary",
  authenticate,
  validate(programFieldParamsSchema, "params"),
  myFieldAssessmentSummary
);
router.get(
  "/my/programs/:programId/fields/:fieldId/regen-index",
  authenticate,
  validate(programFieldParamsSchema, "params"),
  myFieldRegenIndex
);
router.get(
  "/my/programs/:programId/fields/:fieldId/categories/:categoryId/questions/list",
  authenticate,
  validate(programFieldCategoryParamsSchema, "params"),
  myFieldCategoryQuestionList
);
router.get(
  "/my/programs/:programId/fields/:fieldId/categories/:categoryId/questions/:questionId",
  authenticate,
  validate(programFieldCategoryQuestionParamsSchema, "params"),
  myFieldQuestionDetail
);
router.get(
  "/my/programs/:programId/fields/:fieldId/categories/:categoryId/questions",
  authenticate,
  validate(programFieldCategoryParamsSchema, "params"),
  myFieldCategoryQuestions
);
// A whole form of one category, saved together.
router.put(
  "/my/programs/:programId/fields/:fieldId/categories/:categoryId/answers",
  authenticate,
  validate(programFieldCategoryParamsSchema, "params"),
  validate(saveCategoryAnswersSchema),
  saveMyFieldCategoryAnswers
);
// The records of an input based form: add one, change one, remove one.
router.post(
  "/my/programs/:programId/fields/:fieldId/categories/:categoryId/records",
  authenticate,
  validate(programFieldCategoryParamsSchema, "params"),
  validate(saveCategoryAnswersSchema),
  addMyFieldRecord
);
router.put(
  "/my/programs/:programId/fields/:fieldId/categories/:categoryId/records/:recordId",
  authenticate,
  validate(programFieldRecordParamsSchema, "params"),
  validate(saveCategoryAnswersSchema),
  saveMyFieldRecord
);
router.delete(
  "/my/programs/:programId/fields/:fieldId/categories/:categoryId/records/:recordId",
  authenticate,
  validate(programFieldRecordParamsSchema, "params"),
  removeMyFieldRecord
);
router.put(
  "/my/programs/:programId/fields/:fieldId/questions/:questionId/answer",
  authenticate,
  validate(programFieldQuestionParamsSchema, "params"),
  validate(saveAnswerSchema),
  saveMyFieldAnswer
);
router.get(
  "/my/programs/:programId/fields/:fieldId/review",
  authenticate,
  validate(programFieldParamsSchema, "params"),
  myFieldReview
);
router.get(
  "/my/programs/:programId/fields/:fieldId/history",
  authenticate,
  validate(programFieldParamsSchema, "params"),
  myFieldAssessmentHistory
);
router.post(
  "/my/programs/:programId/fields/:fieldId/submit",
  authenticate,
  validate(programFieldParamsSchema, "params"),
  submitMyFieldAssessment
);
router.delete(
  "/my/programs/:programId/fields/:fieldId/discard",
  authenticate,
  validate(programFieldParamsSchema, "params"),
  discardMyFieldAssessment
);

// Admin review of a submitted assessment, before its score counts anywhere.
router.get("/reviews/:id", ...templateManagers, withId, getReview);
router.patch("/reviews/:id", ...templateManagers, withId, validate(reviewScoresSchema), saveReviewScores);
router.post("/reviews/:id/approve", ...templateManagers, withId, validate(reviewScoresSchema), approveReview);

router.get("/import-sample", ...templateManagers, downloadImportSample);

router.get("/templates", ...templateManagers, validate(listTemplatesQuerySchema, "query"), listTemplates);
router.post("/templates", ...templateManagers, validate(createTemplateSchema), createTemplate);
router.get("/templates/:id", ...templateManagers, withId, getTemplate);
router.patch("/templates/:id", ...templateManagers, withId, validate(updateTemplateSchema), updateTemplate);
router.delete("/templates/:id", ...templateManagers, withId, deleteTemplate);
router.post("/templates/:id/global", ...templateManagers, withId, makeTemplateGlobal);
router.post("/templates/:id/lock", ...templateManagers, withId, lockTemplate);
router.delete("/templates/:id/lock", ...templateManagers, withId, unlockTemplate);

router.get("/templates/:id/categories", ...templateManagers, withId, listTemplateCategories);
router.post("/templates/:id/categories", ...templateManagers, withId, validate(createCategorySchema), createTemplateCategory);
router.patch("/templates/:id/categories/reorder", ...templateManagers, withId, validate(reorderSchema), reorderTemplateCategories);

// The fields of one category, written as a single form.
router.put(
  "/templates/:id/categories/:categoryId/fields",
  ...templateManagers,
  validate(templateCategoryParamsSchema, "params"),
  validate(saveCategoryFieldsSchema),
  saveTemplateCategoryFields
);

router.get("/templates/:id/questions", ...templateManagers, withId, validate(listQuestionsQuerySchema, "query"), listTemplateQuestions);
router.post("/templates/:id/questions", ...templateManagers, withId, validate(createQuestionSchema), createTemplateQuestion);
router.patch("/templates/:id/questions/reorder", ...templateManagers, withId, validate(reorderSchema), reorderTemplateQuestions);
router.get(
  "/templates/:id/questions/export",
  ...templateManagers,
  withId,
  downloadTemplateQuestions
);
router.post(
  "/templates/import",
  ...templateManagers,
  importLimiter,
  handleUpload(excelUpload.single("file")),
  importTemplateFromFile
);
router.post(
  "/templates/:id/questions/import",
  ...templateManagers,
  withId,
  importLimiter,
  handleUpload(excelUpload.single("file")),
  importTemplateQuestions
);

router.get("/categories/:id", ...templateManagers, withId, getCategory);
router.patch("/categories/:id", ...templateManagers, withId, validate(updateCategorySchema), updateCategory);
router.delete("/categories/:id", ...templateManagers, withId, deleteCategory);

router.get("/questions/:id", ...templateManagers, withId, getQuestion);
router.patch("/questions/:id", ...templateManagers, withId, validate(updateQuestionSchema), updateQuestion);
router.delete("/questions/:id", ...templateManagers, withId, deleteQuestion);

export default router;
