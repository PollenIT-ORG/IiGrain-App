import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { uploadContractPdf } from "../services/upload.service.js";
import {
  fetchStoredPdf,
  buildContractPdf,
} from "../services/contractPdf.service.js";
import * as tpl from "../services/programAdminSurveyTemplate.service.js";
import * as svc from "../services/programAdminSurvey.service.js";
import * as contractTpl from "../services/programAdminContractTemplate.service.js";
import type {
  TemplateCreateBody,
  TemplateUpdateBody,
  CategoryBody,
  CategoryUpdateBody,
  QuestionBody,
  QuestionUpdateBody,
  ScoringRuleBody,
  ProgramCreateBody,
  ProgramUpdateBody,
  ContractTemplateCreateBody,
  ContractTemplateUpdateBody,
  SetCategoryBody,
  ListSubmissionsQuery,
  SubmissionStatsQuery,
} from "../validators/programAdminSurvey.schema.js";

// Admin portal for the Program Admin Survey module. A program administrator is
// scoped to their own data (ownerId = their id); platform admins see everything
// (ownerId = null).
type Req = { user?: { sub: string; role: string }; params: Record<string, string> };

function scope(req: Req): { ownerId: string | null; actorId: string } {
  const sub = req.user!.sub;
  const role = req.user!.role;
  return { ownerId: role === "program_administrator" ? sub : null, actorId: sub };
}

// ------------------------------- Templates ---------------------------------

export const listTemplates = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const templates = await tpl.getTemplates(ownerId);
  return ApiResponse.send(res, 200, "Templates fetched.", { templates });
});

export const getTemplate = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const template = await tpl.getTemplateForOwner(req.params.id, ownerId);
  const [categories, questions, scoringRules] = await Promise.all([
    tpl.getAllCategories(template.id),
    tpl.getAllQuestions(template.id),
    tpl.getScoringRules(template.id),
  ]);
  return ApiResponse.send(res, 200, "Template fetched.", {
    template,
    categories,
    questions,
    scoringRules,
  });
});

export const createTemplate = asyncHandler(async (req, res) => {
  const { ownerId, actorId } = scope(req);
  const body = req.body as TemplateCreateBody;
  const template = await tpl.addTemplate(ownerId, actorId, {
    name: body.name,
    description: body.description ?? null,
    basedOn: body.basedOn,
  });
  return ApiResponse.send(res, 201, "Template created.", { template });
});

export const updateTemplate = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const body = req.body as TemplateUpdateBody;
  const template = await tpl.editTemplate(req.params.id, ownerId, body);
  return ApiResponse.send(res, 200, "Template updated.", { template });
});

/** What deleting this survey takes with it, so the panel can spell it out. */
export const templateDeletionSummary = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const items = await tpl.getSurveyDeletionSummary(req.params.id, ownerId);
  return ApiResponse.send(res, 200, "Deletion summary.", { items });
});

export const deleteTemplate = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  await tpl.removeTemplate(req.params.id, ownerId);
  return ApiResponse.send(res, 200, "Template deleted.");
});

// ------------------------------- Categories --------------------------------

export const createCategory = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const body = req.body as CategoryBody;
  const category = await tpl.addCategory(req.params.templateId, ownerId, body);
  return ApiResponse.send(res, 201, "Category created.", { category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const body = req.body as CategoryUpdateBody;
  const category = await tpl.editCategory(req.params.id, ownerId, body);
  return ApiResponse.send(res, 200, "Category updated.", { category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  await tpl.removeCategory(req.params.id, ownerId);
  return ApiResponse.send(res, 200, "Category deleted.");
});

// -------------------------------- Questions --------------------------------

export const createQuestion = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const body = req.body as QuestionBody;
  const question = await tpl.addQuestion(req.params.templateId, ownerId, {
    categoryId: body.categoryId,
    questionText: body.questionText,
    helpText: body.helpText ?? null,
    weight: body.weight,
    sortOrder: body.sortOrder,
    isActive: body.isActive,
    options: body.options,
  });
  return ApiResponse.send(res, 201, "Question created.", { question });
});

export const updateQuestion = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const body = req.body as QuestionUpdateBody;
  const question = await tpl.editQuestion(req.params.id, ownerId, {
    categoryId: body.categoryId,
    questionText: body.questionText,
    helpText: body.helpText ?? undefined,
    weight: body.weight,
    sortOrder: body.sortOrder,
    isActive: body.isActive,
    options: body.options,
  });
  return ApiResponse.send(res, 200, "Question updated.", { question });
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  await tpl.removeQuestion(req.params.id, ownerId);
  return ApiResponse.send(res, 200, "Question deleted.");
});

// ------------------------------ Scoring rules ------------------------------

export const updateScoringRule = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const body = req.body as ScoringRuleBody;
  const rule = await tpl.editScoringRule(
    req.params.ruleId,
    req.params.templateId,
    ownerId,
    body
  );
  return ApiResponse.send(res, 200, "Score band updated.", { rule });
});

// --------------------------- Programs (surveys) ----------------------------

export const listPrograms = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const programs = await svc.getProgramSurveys(ownerId);
  return ApiResponse.send(res, 200, "Programs fetched.", { programs });
});

export const getProgram = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const program = await svc.getProgramSurvey(req.params.id, ownerId);
  return ApiResponse.send(res, 200, "Program fetched.", { program });
});

export const createProgram = asyncHandler(async (req, res) => {
  const { ownerId, actorId } = scope(req);
  const body = req.body as ProgramCreateBody;
  const program = await svc.attachSurveyToProgram(actorId, ownerId, {
    programId: body.programId,
    templateId: body.templateId,
    contractTemplateId: body.contractTemplateId || null,
    replace: body.replace ?? false,
  });
  return ApiResponse.send(res, 201, "Survey attached to the program.", {
    program,
  });
});

export const updateProgram = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const body = req.body as ProgramUpdateBody;
  const program = await svc.editProgramSurvey(req.params.id, ownerId, {
    ...body,
    contractTemplateId:
      body.contractTemplateId === undefined
        ? undefined
        : body.contractTemplateId || null,
  });
  return ApiResponse.send(res, 200, "Program updated.", { program });
});

export const lockProgramSurvey = asyncHandler(async (req, res) => {
  const { ownerId, actorId } = scope(req);
  const program = await svc.setProgramSurveyLocked(req.params.id, ownerId, actorId, true);
  return ApiResponse.send(res, 200, "Survey locked.", { program });
});

export const unlockProgramSurvey = asyncHandler(async (req, res) => {
  const { ownerId, actorId } = scope(req);
  const program = await svc.setProgramSurveyLocked(req.params.id, ownerId, actorId, false);
  return ApiResponse.send(res, 200, "Survey unlocked.", { program });
});

// -------------------------- Contract templates -----------------------------

export const listContractTemplates = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const contracts = await contractTpl.getTemplates(ownerId);
  return ApiResponse.send(res, 200, "Contracts fetched.", { contracts });
});

export const getContractTemplate = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const contract = await contractTpl.getForOwner(req.params.id, ownerId);
  return ApiResponse.send(res, 200, "Contract fetched.", { contract });
});

/**
 * A program administrator uploads the contract PDF the platform team sent them.
 * They never write the wording themselves - this is the only way they add one.
 */
export const uploadContractTemplate = asyncHandler(async (req, res) => {
  const { ownerId, actorId } = scope(req);
  const file = (req as { file?: Express.Multer.File }).file;
  if (!file) throw ApiError.badRequest("Choose a PDF to upload.");
  const name =
    ((req.body as { name?: string }).name ?? "").trim() ||
    file.originalname.replace(/\.pdf$/i, "");
  const pdfUrl = await uploadContractPdf(file.buffer, name);
  const contract = await contractTpl.addUploadedTemplate(ownerId, actorId, {
    name,
    pdfUrl,
    pdfName: file.originalname,
  });
  return ApiResponse.send(res, 201, "Contract uploaded.", { contract });
});

export const createContractTemplate = asyncHandler(async (req, res) => {
  const { ownerId, actorId } = scope(req);
  const body = req.body as ContractTemplateCreateBody;
  const contract = await contractTpl.addTemplate(ownerId, actorId, {
    name: body.name,
    basedOn: body.basedOn,
  });
  return ApiResponse.send(res, 201, "Contract created.", { contract });
});

export const updateContractTemplate = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const body = req.body as ContractTemplateUpdateBody;
  const contract = await contractTpl.editTemplate(req.params.id, ownerId, {
    name: body.name,
    intro: body.intro ?? undefined,
    clauses: body.clauses,
    isActive: body.isActive,
  });
  return ApiResponse.send(res, 200, "Contract updated.", { contract });
});

/** Streams a stored PDF back with the headers a browser needs to display it. */
function sendPdf(
  res: Parameters<Parameters<typeof asyncHandler>[0]>[1],
  pdf: Buffer,
  filename: string
): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", pdf.length);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${filename.replace(/"/g, "")}"`
  );
  res.end(pdf);
}

/** The uploaded contract PDF, served from our own domain. */
/**
 * A contract to read, as the producer will read it.
 *
 * An uploaded contract is served as it is. A written one is laid out here into
 * the same document it becomes when it is sent, so a program administrator -
 * who never edits the wording - can still see exactly what their producers
 * will be signing.
 */
export const getContractTemplatePdf = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const contract = await contractTpl.getForOwner(req.params.id, ownerId);
  const pdf = contract.pdf_url
    ? await fetchStoredPdf(contract.pdf_url)
    : Buffer.from(
        await buildContractPdf(await svc.contractTemplateDoc(contract))
      );
  sendPdf(res, pdf, contract.pdf_name || `${contract.name}.pdf`);
});

/** The signed copy for a submission (the contract plus the signature page). */
export const getSignedContractPdf = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const { submission, contract } = await svc.getSubmission(req.params.id, ownerId);
  if (!contract?.signed_pdf_url) {
    throw ApiError.notFound("This submission has no signed contract yet.");
  }
  const pdf = await fetchStoredPdf(contract.signed_pdf_url);
  sendPdf(res, pdf, `signed-contract-${submission.full_name}.pdf`);
});

export const makeContractTemplateGlobal = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const contract = await contractTpl.makeGlobal(req.params.id, ownerId);
  return ApiResponse.send(res, 200, "This is now the global contract.", {
    contract,
  });
});

export const makeTemplateGlobal = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const template = await tpl.makeGlobal(req.params.id, ownerId);
  return ApiResponse.send(res, 200, "This is now the global survey.", {
    template,
  });
});

export const deleteContractTemplate = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  await contractTpl.removeTemplate(req.params.id, ownerId);
  return ApiResponse.send(res, 200, "Contract deleted.");
});

export const deleteProgram = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  await svc.removeProgramSurvey(req.params.id, ownerId);
  return ApiResponse.send(res, 200, "Program deleted.");
});

export const shareProgram = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const { emails } = req.body as { emails: string[] };
  const sent = await svc.shareProgramByEmail(req.params.id, ownerId, emails);
  return ApiResponse.send(
    res,
    200,
    sent > 0
      ? `Survey link sent to ${sent} ${sent === 1 ? "address" : "addresses"}.`
      : "Could not send the survey link. Please check the email settings.",
    { sent }
  );
});

// ------------------------------- Submissions -------------------------------

export const listSubmissions = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const q = req.query as unknown as ListSubmissionsQuery;
  const { rows, total, page, limit } = await svc.getSubmissions(ownerId, {
    page: q.page,
    limit: q.limit,
    status: q.status,
    category: q.category,
    programId: q.programId,
    referral: q.referral,
    createdFrom: q.createdFrom,
    createdTo: q.createdTo,
    search: q.search,
  });
  return ApiResponse.send(
    res,
    200,
    "Submissions fetched.",
    { submissions: rows },
    { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  );
});

export const submissionStats = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const q = req.query as unknown as SubmissionStatsQuery;
  const stats = await svc.getSubmissionStats(ownerId, {
    programId: q.programId,
    category: q.category,
    referral: q.referral,
    createdFrom: q.createdFrom,
    createdTo: q.createdTo,
    search: q.search,
  });
  return ApiResponse.send(res, 200, "Submission stats.", { stats });
});

export const getSubmission = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const data = await svc.getSubmission(req.params.id, ownerId);
  return ApiResponse.send(res, 200, "Submission fetched.", data);
});

export const setCategory = asyncHandler(async (req, res) => {
  const { ownerId, actorId } = scope(req);
  const body = req.body as SetCategoryBody;
  const submission = await svc.setCategory(
    req.params.id,
    ownerId,
    body.category,
    actorId,
    body.reason ?? null
  );
  return ApiResponse.send(res, 200, "Qualification updated.", { submission });
});

export const sendContract = asyncHandler(async (req, res) => {
  const { ownerId, actorId } = scope(req);
  const result = await svc.sendContract(req.params.id, ownerId, actorId);
  return ApiResponse.send(res, 200, "Contract sent.", result);
});

export const acceptAndEnroll = asyncHandler(async (req, res) => {
  const { ownerId, actorId } = scope(req);
  const submission = await svc.acceptAndEnroll(req.params.id, ownerId, actorId);
  return ApiResponse.send(
    res,
    200,
    `Enrolled. Enrollment ID ${submission.enrollment_id} has been emailed.`,
    { submission }
  );
});

export const withdrawSubmission = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  const submission = await svc.withdrawSubmission(req.params.id, ownerId);
  return ApiResponse.send(res, 200, "Submission withdrawn.", { submission });
});

export const deleteSubmission = asyncHandler(async (req, res) => {
  const { ownerId } = scope(req);
  await svc.deleteSubmission(req.params.id, ownerId);
  return ApiResponse.send(res, 200, "Submission deleted.");
});
