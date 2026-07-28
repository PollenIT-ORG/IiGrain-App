import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { idParamSchema } from "../validators/common.schema.js";
import {
  listSubmissionsQuerySchema,
  setCategorySchema,
  shareSurveySchema,
  surveyQuestionSchema,
  updateSurveyQuestionSchema,
  surveyCategorySchema,
  updateSurveyCategorySchema,
  reorderQuestionsSchema,
  updateScoringRuleSchema,
  listEnquiriesQuerySchema,
  setReadSchema,
} from "../validators/web.schema.js";
import {
  listSubmissions,
  submissionStats,
  getSubmission,
  setCategory,
  sendContract,
  acceptAndEnroll,
  deleteSubmission,
  shareSurvey,
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  listScoringRules,
  updateScoringRule,
  listEnquiries,
  setEnquiryRead,
  deleteEnquiry,
} from "../controllers/eligibilityAdmin.controller.js";

const router = Router();
const withId = validate(idParamSchema, "params");

// Same guard as the rest of the admin portal.
router.use(authenticate, authorize("super_admin", "admin", "program_administrator"));

// Survey submissions
router.get(
  "/submissions",
  validate(listSubmissionsQuerySchema, "query"),
  listSubmissions
);
router.get("/submissions/stats", submissionStats);
router.post("/share-survey", validate(shareSurveySchema), shareSurvey);
router.get("/submissions/:id", withId, getSubmission);
router.patch(
  "/submissions/:id/category",
  withId,
  validate(setCategorySchema),
  setCategory
);
router.post("/submissions/:id/send-contract", withId, sendContract);
router.post("/submissions/:id/accept", withId, acceptAndEnroll);
router.delete("/submissions/:id", withId, deleteSubmission);

// Survey categories. Specific paths before "/:id" so they are not read as ids.
router.get("/categories", listCategories);
router.post("/categories", validate(surveyCategorySchema), createCategory);
router.patch(
  "/categories/reorder",
  validate(reorderQuestionsSchema),
  reorderCategories
);
router.patch(
  "/categories/:id",
  withId,
  validate(updateSurveyCategorySchema),
  updateCategory
);
router.delete("/categories/:id", withId, deleteCategory);

// Survey questions. Specific paths before "/:id" so they are not read as ids.
router.get("/questions", listQuestions);
router.post("/questions", validate(surveyQuestionSchema), createQuestion);
router.patch(
  "/questions/reorder",
  validate(reorderQuestionsSchema),
  reorderQuestions
);
router.patch(
  "/questions/:id",
  withId,
  validate(updateSurveyQuestionSchema),
  updateQuestion
);
router.delete("/questions/:id", withId, deleteQuestion);

// Score bands
router.get("/scoring-rules", listScoringRules);
router.patch(
  "/scoring-rules/:id",
  withId,
  validate(updateScoringRuleSchema),
  updateScoringRule
);

// Contact enquiries
router.get("/enquiries", validate(listEnquiriesQuerySchema, "query"), listEnquiries);
router.patch("/enquiries/:id/read", withId, validate(setReadSchema), setEnquiryRead);
router.delete("/enquiries/:id", withId, deleteEnquiry);

export default router;
