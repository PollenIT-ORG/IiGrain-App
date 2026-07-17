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
  fieldIdParamSchema,
  fieldCategoryParamsSchema,
  fieldCategoryQuestionParamsSchema,
  fieldQuestionParamsSchema,
  saveAnswerSchema,
  historyQuerySchema,
} from "../validators/assessment.schema.js";
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
router.get("/my/fields", authenticate, myFieldsAssessmentList);
router.get(
  "/my/history",
  authenticate,
  validate(historyQuerySchema, "query"),
  myAssessmentHistory
);
router.get(
  "/my/fields/:fieldId/summary",
  authenticate,
  validate(fieldIdParamSchema, "params"),
  myFieldAssessmentSummary
);
router.get(
  "/my/fields/:fieldId/regen-index",
  authenticate,
  validate(fieldIdParamSchema, "params"),
  myFieldRegenIndex
);
router.get(
  "/my/fields/:fieldId/categories/:categoryId/questions/list",
  authenticate,
  validate(fieldCategoryParamsSchema, "params"),
  myFieldCategoryQuestionList
);
router.get(
  "/my/fields/:fieldId/categories/:categoryId/questions/:questionId",
  authenticate,
  validate(fieldCategoryQuestionParamsSchema, "params"),
  myFieldQuestionDetail
);
router.get(
  "/my/fields/:fieldId/categories/:categoryId/questions",
  authenticate,
  validate(fieldCategoryParamsSchema, "params"),
  myFieldCategoryQuestions
);
router.put(
  "/my/fields/:fieldId/questions/:questionId/answer",
  authenticate,
  validate(fieldQuestionParamsSchema, "params"),
  validate(saveAnswerSchema),
  saveMyFieldAnswer
);
router.get(
  "/my/fields/:fieldId/review",
  authenticate,
  validate(fieldIdParamSchema, "params"),
  myFieldReview
);
router.get(
  "/my/fields/:fieldId/history",
  authenticate,
  validate(fieldIdParamSchema, "params"),
  myFieldAssessmentHistory
);
router.post(
  "/my/fields/:fieldId/submit",
  authenticate,
  validate(fieldIdParamSchema, "params"),
  submitMyFieldAssessment
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
