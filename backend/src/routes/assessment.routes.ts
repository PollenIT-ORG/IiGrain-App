import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { handleUpload } from "../middlewares/handleUpload.js";
import { importLimiter } from "../middlewares/rateLimiters.js";
import { excelUpload, evidenceUpload } from "../config/multer.js";
import {
  createCategorySchema,
  updateCategorySchema,
  reorderSchema,
  createQuestionSchema,
  updateQuestionSchema,
  listQuestionsQuerySchema,
  idParamSchema,
  saveAnswerSchema,
  historyQuerySchema,
  programFieldParamsSchema,
  programFieldCategoryParamsSchema,
  programFieldCategoryQuestionParamsSchema,
  programFieldQuestionParamsSchema,
} from "../validators/assessment.schema.js";
import { paginationQuerySchema } from "../validators/pagination.schema.js";
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategoriesCtrl,
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestionsCtrl,
  importExcel,
} from "../controllers/assessment.controller.js";
import {
  myFieldsAssessmentList,
  myAssessmentHistory,
  myFieldRegenIndex,
  myFieldAssessmentSummary,
  myFieldCategoryQuestions,
  myFieldCategoryQuestionList,
  myFieldQuestionDetail,
  saveMyFieldAnswer,
  myFieldReview,
  myFieldAssessmentHistory,
  submitMyFieldAssessment,
  discardMyFieldAssessment,
  uploadEvidence,
} from "../controllers/assessmentMobile.controller.js";

const router = Router();

const adminAuth = [authenticate, authorize("super_admin", "admin")];

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

router.get("/categories", ...adminAuth, listCategories);
router.post("/categories", ...adminAuth, validate(createCategorySchema), createCategory);
router.patch("/categories/reorder", ...adminAuth, validate(reorderSchema), reorderCategoriesCtrl);
router.get("/categories/:id", ...adminAuth, validate(idParamSchema, "params"), getCategory);
router.patch("/categories/:id", ...adminAuth, validate(idParamSchema, "params"), validate(updateCategorySchema), updateCategory);
router.delete("/categories/:id", ...adminAuth, validate(idParamSchema, "params"), deleteCategory);

router.get("/questions", ...adminAuth, validate(listQuestionsQuerySchema, "query"), listQuestions);
router.post("/questions", ...adminAuth, validate(createQuestionSchema), createQuestion);
router.post(
  "/questions/import",
  ...adminAuth,
  importLimiter,
  handleUpload(excelUpload.single("file")),
  importExcel
);
router.patch("/questions/reorder", ...adminAuth, validate(reorderSchema), reorderQuestionsCtrl);
router.get("/questions/:id", ...adminAuth, validate(idParamSchema, "params"), getQuestion);
router.patch("/questions/:id", ...adminAuth, validate(idParamSchema, "params"), validate(updateQuestionSchema), updateQuestion);
router.delete("/questions/:id", ...adminAuth, validate(idParamSchema, "params"), deleteQuestion);

export default router;
