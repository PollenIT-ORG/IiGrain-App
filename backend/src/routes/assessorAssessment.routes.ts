import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  saveAnswerSchema,
  saveCategoryAnswersSchema,
  programFieldParamsSchema,
  programFieldCategoryParamsSchema,
  programFieldRecordParamsSchema,
  programFieldCategoryQuestionParamsSchema,
  programFieldQuestionParamsSchema,
} from "../validators/assessment.schema.js";
import {
  myAssessorFields,
  assessorSummary,
  assessorCategoryQuestionList,
  assessorQuestionDetail,
  assessorCategoryQuestions,
  saveAssessorAnswer,
  saveAssessorCategoryAnswers,
  addAssessorRecord,
  saveAssessorRecord,
  removeAssessorRecord,
  assessorReview,
  submitAssessorAssessment,
  farmerAssessment,
  comparison,
} from "../controllers/assessorAssessment.controller.js";

const router = Router();

const assessorOnly = [authenticate, authorize("assessor")];

router.get("/fields", ...assessorOnly, myAssessorFields);

router.get(
  "/programs/:programId/fields/:fieldId/summary",
  ...assessorOnly,
  validate(programFieldParamsSchema, "params"),
  assessorSummary
);
router.get(
  "/programs/:programId/fields/:fieldId/categories/:categoryId/questions/list",
  ...assessorOnly,
  validate(programFieldCategoryParamsSchema, "params"),
  assessorCategoryQuestionList
);
router.get(
  "/programs/:programId/fields/:fieldId/categories/:categoryId/questions/:questionId",
  ...assessorOnly,
  validate(programFieldCategoryQuestionParamsSchema, "params"),
  assessorQuestionDetail
);
router.get(
  "/programs/:programId/fields/:fieldId/categories/:categoryId/questions",
  ...assessorOnly,
  validate(programFieldCategoryParamsSchema, "params"),
  assessorCategoryQuestions
);
// A whole form of one category, saved together.
router.put(
  "/programs/:programId/fields/:fieldId/categories/:categoryId/answers",
  ...assessorOnly,
  validate(programFieldCategoryParamsSchema, "params"),
  validate(saveCategoryAnswersSchema),
  saveAssessorCategoryAnswers
);
// The records of an input based form: add one, change one, remove one.
router.post(
  "/programs/:programId/fields/:fieldId/categories/:categoryId/records",
  ...assessorOnly,
  validate(programFieldCategoryParamsSchema, "params"),
  validate(saveCategoryAnswersSchema),
  addAssessorRecord
);
router.put(
  "/programs/:programId/fields/:fieldId/categories/:categoryId/records/:recordId",
  ...assessorOnly,
  validate(programFieldRecordParamsSchema, "params"),
  validate(saveCategoryAnswersSchema),
  saveAssessorRecord
);
router.delete(
  "/programs/:programId/fields/:fieldId/categories/:categoryId/records/:recordId",
  ...assessorOnly,
  validate(programFieldRecordParamsSchema, "params"),
  removeAssessorRecord
);
router.put(
  "/programs/:programId/fields/:fieldId/questions/:questionId/answer",
  ...assessorOnly,
  validate(programFieldQuestionParamsSchema, "params"),
  validate(saveAnswerSchema),
  saveAssessorAnswer
);
router.get(
  "/programs/:programId/fields/:fieldId/review",
  ...assessorOnly,
  validate(programFieldParamsSchema, "params"),
  assessorReview
);
router.post(
  "/programs/:programId/fields/:fieldId/submit",
  ...assessorOnly,
  validate(programFieldParamsSchema, "params"),
  submitAssessorAssessment
);

router.get(
  "/programs/:programId/fields/:fieldId/farmer-assessment",
  ...assessorOnly,
  validate(programFieldParamsSchema, "params"),
  farmerAssessment
);
router.get(
  "/programs/:programId/fields/:fieldId/comparison",
  ...assessorOnly,
  validate(programFieldParamsSchema, "params"),
  comparison
);

export default router;
