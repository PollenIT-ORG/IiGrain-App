import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as eligibility from "../services/eligibility.service.js";
import * as survey from "../services/survey.service.js";
import * as standalone from "../services/standalone.service.js";
import * as contact from "../services/contact.service.js";
import type {
  ListSubmissionsQuery,
  SurveyQuestionBody,
  UpdateSurveyQuestionBody,
  SurveyCategoryBody,
  UpdateSurveyCategoryBody,
  ReorderQuestionsBody,
  UpdateScoringRuleBody,
  ListEnquiriesQuery,
  ShareSurveyBody,
} from "../validators/web.schema.js";

// Admin portal: eligibility submissions, the survey questions behind them, and
// the website contact enquiries.

function actorId(req: { user?: { sub: string } }): string {
  return req.user!.sub;
}

// --------------------------- Submissions ---------------------------

export const listSubmissions = asyncHandler(async (req, res) => {
  const q = req.query as unknown as ListSubmissionsQuery;
  const { submissions, meta } = await eligibility.getSubmissions({
    page: q.page,
    limit: q.limit,
    status: q.status,
    category: q.category,
    channel: q.channel,
    search: q.search,
  });
  return ApiResponse.send(
    res,
    200,
    "Submissions fetched.",
    { submissions },
    meta
  );
});

export const submissionStats = asyncHandler(async (_req, res) => {
  const stats = await eligibility.getSubmissionStats();
  return ApiResponse.send(res, 200, "Submission stats.", { stats });
});

export const getSubmission = asyncHandler(async (req, res) => {
  const data = await eligibility.getSubmissionDetail(req.params.id);
  return ApiResponse.send(res, 200, "Submission fetched.", data);
});

export const setCategory = asyncHandler(async (req, res) => {
  const { category } = req.body as { category: Parameters<typeof eligibility.setCategory>[1] };
  const submission = await eligibility.setCategory(
    req.params.id,
    category,
    actorId(req)
  );
  return ApiResponse.send(res, 200, "Band updated.", { submission });
});

export const sendContract = asyncHandler(async (req, res) => {
  const result = await eligibility.sendContract(req.params.id, actorId(req));
  return ApiResponse.send(res, 200, "Contract sent.", result);
});

export const acceptAndEnroll = asyncHandler(async (req, res) => {
  const submission = await eligibility.acceptAndEnroll(
    req.params.id,
    actorId(req)
  );
  return ApiResponse.send(
    res,
    200,
    `Enrolled. Enrollment ID ${submission.enrollment_id} has been emailed.`,
    { submission }
  );
});

export const deleteSubmission = asyncHandler(async (req, res) => {
  await eligibility.deleteSubmission(req.params.id);
  return ApiResponse.send(res, 200, "Submission deleted.");
});

export const shareSurvey = asyncHandler(async (req, res) => {
  const { emails } = req.body as ShareSurveyBody;
  const sent = await standalone.shareSurveyByEmail(emails);
  return ApiResponse.send(
    res,
    200,
    sent > 0
      ? `Survey link sent to ${sent} ${sent === 1 ? "address" : "addresses"}.`
      : "Could not send the survey link. Please check the email settings.",
    { sent, link: standalone.surveyInviteLink() }
  );
});

// --------------------------- Survey questions ---------------------------

export const listQuestions = asyncHandler(async (_req, res) => {
  const [questions, maxScore] = await Promise.all([
    survey.getAllQuestions(),
    survey.maxPossibleScore(),
  ]);
  return ApiResponse.send(res, 200, "Questions fetched.", {
    questions,
    maxScore,
  });
});

export const createQuestion = asyncHandler(async (req, res) => {
  const body = req.body as SurveyQuestionBody;
  const question = await survey.addQuestion({
    categoryId: body.categoryId,
    questionText: body.questionText,
    helpText: body.helpText ?? null,
    weight: body.weight,
    sortOrder: body.sortOrder,
    isActive: body.isActive,
  });
  return ApiResponse.send(res, 201, "Question created.", { question });
});

export const updateQuestion = asyncHandler(async (req, res) => {
  const body = req.body as UpdateSurveyQuestionBody;
  const question = await survey.editQuestion(req.params.id, {
    categoryId: body.categoryId,
    questionText: body.questionText,
    helpText: body.helpText ?? undefined,
    weight: body.weight,
    sortOrder: body.sortOrder,
    isActive: body.isActive,
  });
  return ApiResponse.send(res, 200, "Question updated.", { question });
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  await survey.removeQuestion(req.params.id);
  return ApiResponse.send(res, 200, "Question deleted.");
});

export const reorderQuestions = asyncHandler(async (req, res) => {
  const { items } = req.body as ReorderQuestionsBody;
  const updated = await survey.reorder(items);
  return ApiResponse.send(res, 200, "Questions reordered.", { updated });
});

// --------------------------- Survey categories ---------------------------

export const listCategories = asyncHandler(async (_req, res) => {
  const categories = await survey.getAllCategories();
  return ApiResponse.send(res, 200, "Categories fetched.", { categories });
});

export const createCategory = asyncHandler(async (req, res) => {
  const body = req.body as SurveyCategoryBody;
  const category = await survey.addCategory({
    name: body.name,
    description: body.description ?? null,
    icon: body.icon ?? null,
    sortOrder: body.sortOrder,
    isActive: body.isActive,
  });
  return ApiResponse.send(res, 201, "Category created.", { category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const body = req.body as UpdateSurveyCategoryBody;
  const category = await survey.editCategory(req.params.id, {
    name: body.name,
    description: body.description ?? undefined,
    icon: body.icon ?? undefined,
    sortOrder: body.sortOrder,
    isActive: body.isActive,
  });
  return ApiResponse.send(res, 200, "Category updated.", { category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await survey.removeCategory(req.params.id);
  return ApiResponse.send(res, 200, "Category deleted.");
});

export const reorderCategories = asyncHandler(async (req, res) => {
  const { items } = req.body as ReorderQuestionsBody;
  const updated = await survey.reorderCats(items);
  return ApiResponse.send(res, 200, "Categories reordered.", { updated });
});

// --------------------------- Scoring rules ---------------------------

export const listScoringRules = asyncHandler(async (_req, res) => {
  const [rules, maxScore] = await Promise.all([
    survey.getScoringRules(),
    survey.maxPossibleScore(),
  ]);
  return ApiResponse.send(res, 200, "Scoring rules.", { rules, maxScore });
});

export const updateScoringRule = asyncHandler(async (req, res) => {
  const body = req.body as UpdateScoringRuleBody;
  const rule = await survey.editScoringRule(req.params.id, body);
  return ApiResponse.send(res, 200, "Scoring rule updated.", { rule });
});

// --------------------------- Contact enquiries ---------------------------

export const listEnquiries = asyncHandler(async (req, res) => {
  const q = req.query as unknown as ListEnquiriesQuery;
  const { enquiries, unreadCount, meta } = await contact.getEnquiries({
    page: q.page,
    limit: q.limit,
    unreadOnly: q.unreadOnly,
    search: q.search,
  });
  return ApiResponse.send(
    res,
    200,
    "Enquiries fetched.",
    { enquiries, unreadCount },
    meta
  );
});

export const setEnquiryRead = asyncHandler(async (req, res) => {
  const { isRead } = req.body as { isRead: boolean };
  await contact.setRead(req.params.id, isRead);
  return ApiResponse.send(res, 200, isRead ? "Marked read." : "Marked unread.");
});

export const deleteEnquiry = asyncHandler(async (req, res) => {
  await contact.removeEnquiry(req.params.id);
  return ApiResponse.send(res, 200, "Enquiry deleted.");
});
