import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  fieldIdParamSchema,
  fieldCategoryParamsSchema,
  fieldCategoryQuestionParamsSchema,
  fieldQuestionParamsSchema,
  saveAnswerSchema,
} from "../validators/assessment.schema.js";
import {
  myAssessorFields,
  assessorSummary,
  assessorCategoryQuestionList,
  assessorQuestionDetail,
  assessorCategoryQuestions,
  saveAssessorAnswer,
  assessorReview,
  submitAssessorAssessment,
  farmerAssessment,
  comparison,
} from "../controllers/assessorAssessment.controller.js";

const router = Router();

const assessorOnly = [authenticate, authorize("assessor")];

router.get("/fields", ...assessorOnly, myAssessorFields);

router.get(
  "/fields/:fieldId/summary",
  ...assessorOnly,
  validate(fieldIdParamSchema, "params"),
  assessorSummary
);
router.get(
  "/fields/:fieldId/categories/:categoryId/questions/list",
  ...assessorOnly,
  validate(fieldCategoryParamsSchema, "params"),
  assessorCategoryQuestionList
);
router.get(
  "/fields/:fieldId/categories/:categoryId/questions/:questionId",
  ...assessorOnly,
  validate(fieldCategoryQuestionParamsSchema, "params"),
  assessorQuestionDetail
);
router.get(
  "/fields/:fieldId/categories/:categoryId/questions",
  ...assessorOnly,
  validate(fieldCategoryParamsSchema, "params"),
  assessorCategoryQuestions
);
router.put(
  "/fields/:fieldId/questions/:questionId/answer",
  ...assessorOnly,
  validate(fieldQuestionParamsSchema, "params"),
  validate(saveAnswerSchema),
  saveAssessorAnswer
);
router.get(
  "/fields/:fieldId/review",
  ...assessorOnly,
  validate(fieldIdParamSchema, "params"),
  assessorReview
);
router.post(
  "/fields/:fieldId/submit",
  ...assessorOnly,
  validate(fieldIdParamSchema, "params"),
  submitAssessorAssessment
);

router.get(
  "/fields/:fieldId/farmer-assessment",
  ...assessorOnly,
  validate(fieldIdParamSchema, "params"),
  farmerAssessment
);
router.get(
  "/fields/:fieldId/comparison",
  ...assessorOnly,
  validate(fieldIdParamSchema, "params"),
  comparison
);

export default router;
