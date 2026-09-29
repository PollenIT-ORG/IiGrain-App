import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import ApiError from "../utils/ApiError.js";
import { enrollmentIdsForEmail } from "../models/enrollmentId.model.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { sendMail } from "./mailer.service.js";
import {
  broadcastToAdmins,
  notifySubmission,
} from "./realtime.service.js";
import { notifyOrgManagers } from "./notification.service.js";
import {
  surveyOtpEmail,
  surveyInviteEmail,
  surveyReceivedEmail,
  surveyQualifiedEmail,
  surveyNotQualifiedEmail,
  contractToSignEmail,
  enrollmentWelcomeEmail,
  farmSetupEmail,
  returningEnrollmentEmail,
} from "./emailTemplates.js";
import { generateOtp, otpExpiry } from "../utils/otp.js";
import { createOtp, findActiveOtp, consumeOtp } from "../models/otp.model.js";
import {
  createWebsiteUser,
  findWebsiteUserByEmailPublic,
  updateWebsiteUserDetails,
} from "../models/websiteUser.model.js";
import {
  scoreSurvey,
  getTemplateForOwner,
  getSurveyStructure,
  SCALE_LABELS,
} from "./programAdminSurveyTemplate.service.js";
import {
  getForOwner as getContractForOwner,
  resolveForProgram as resolveContractForProgram,
} from "./programAdminContractTemplate.service.js";
import {
  createSurvey,
  listSurveys,
  findSurveyById,
  findSurveyByToken,
  findSurveyByProgram,
  findSurveyByTemplate,
  updateSurvey,
  setSurveyLock,
  softDeleteSurvey,
  upsertDraft,
  finalizeSubmission,
  findSubmissionById,
  findSubmissionByStatusToken,
  findSubmissionBySurveyAndUser,
  latestProfileForEmail,
  type KnownProfile,
  listSubmissions,
  updateSubmission,
  softDeleteSubmission,
  countByStatus,
  enrollmentIdExists,
  createContract,
  findContractByToken,
  findLatestContract,
  signContract,
  acceptContract,
  setSignedPdfUrl,
  type PublicSurvey,
  type PublicSubmission,
  type PublicContract,
  type SubmissionStatus,
  type StoredAnswer,
} from "../models/programAdminSurvey.model.js";
import type { SurveyCategory } from "../models/programAdminSurveyTemplate.model.js";
import { findProgramById } from "../models/program.model.js";
import { findByEmail } from "../models/user.model.js";
import { findOrgById } from "../models/organization.model.js";
import { getDefaultOrgId } from "./tenancy.service.js";
import { deleteContractsForSubmission } from "./cascadeDelete.service.js";
import {
  buildSignedContractPdf,
  type ContractDocInput,
} from "./contractPdf.service.js";
import { uploadContractPdf } from "./upload.service.js";
import { getClock, formatDate, orgToday } from "../utils/datetime.js";

export const QUALIFIED_MESSAGE =
  "Congratulations, you qualify to enroll in the program. A representative will reach out for further enrollment steps.";
export const NOT_QUALIFIED_MESSAGE =
  "Sorry, based on your responses, you are not qualified to enroll in this program.";

const CONTRACT_TOKEN_DAYS = 30;

function mailQuietly(
  to: string,
  content: { subject: string; text: string; html: string }
): void {
  void sendMail({ to, ...content }).catch((err) => {
    logger.warn(`Could not send email to ${to}`, err);
  });
}

function fullName(first: string, last: string): string {
  return `${first.trim()} ${last.trim()}`.trim();
}

function makeToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

// --- link builders (the new module lives at /program-admin-survey) ----------
export function surveyPublicLink(token: string): string {
  return `${env.surveyAppUrl}/program-admin-survey/${token}`;
}
function statusLink(statusToken: string): string {
  return `${env.surveyAppUrl}/program-admin-survey/status/${statusToken}`;
}
function contractLink(contractToken: string, statusToken: string | null): string {
  const base = `${env.surveyAppUrl}/program-admin-survey/contract/${contractToken}`;
  return statusToken ? `${base}?s=${statusToken}` : base;
}

// ===========================================================================
// Program (survey) management - owned by a program administrator
// ===========================================================================

export interface SurveyWithLink extends PublicSurvey {
  link: string;
}

function withLink(s: PublicSurvey): SurveyWithLink {
  return { ...s, link: surveyPublicLink(s.token) };
}

/**
 * Attaches a survey to a program from the Programs module and returns its
 * shareable link. One survey per program, and one program per survey: linking a
 * survey that is already attached elsewhere moves it.
 */
export async function attachSurveyToProgram(
  ownerId: string,
  scopeOwnerId: string | null,
  input: {
    programId: string;
    templateId: string;
    contractTemplateId?: string | null;
    replace?: boolean;
  }
): Promise<SurveyWithLink> {
  // Access check uses the caller's scope (null = platform admin, who may use
  // any template); the link row is owned by ownerId (a real user id).
  await getTemplateForOwner(input.templateId, scopeOwnerId);
  if (input.contractTemplateId)
    await getContractForOwner(input.contractTemplateId, scopeOwnerId);

  const program = await findProgramById(input.programId);
  if (!program) throw ApiError.notFound("Program not found.");

  // A program administrator owns whatever they link, so it shows up in their
  // own lists. A platform admin, who sees everything anyway, leaves it with
  // whoever created the program.
  const linkOwner = scopeOwnerId ?? program.created_by ?? ownerId;

  const existingForProgram = await findSurveyByProgram(input.programId);
  const existingForTemplate = await findSurveyByTemplate(input.templateId);

  // The survey already sits on another program - move it over.
  if (existingForTemplate && existingForTemplate.program_id !== input.programId) {
    if (existingForProgram) {
      throw ApiError.conflict(
        "That program already has a survey. Remove it first, or pick a different survey."
      );
    }
    const moved = await updateSurvey(existingForTemplate.id, {
      programId: input.programId,
      contractTemplateId: input.contractTemplateId ?? null,
      ownerId: linkOwner,
    });
    broadcastToAdmins("program_admin_survey");
    return withLink(moved ?? existingForTemplate);
  }

  // The program already has a survey. Swapping it is only ever done on
  // purpose, from the program itself, so a new survey never takes it quietly.
  if (existingForProgram && !input.replace) {
    throw ApiError.conflict(
      "That program already has a survey. Change it from the Programs page."
    );
  }
  if (existingForProgram) {
    const updated = await updateSurvey(existingForProgram.id, {
      templateId: input.templateId,
      contractTemplateId: input.contractTemplateId ?? null,
      ownerId: linkOwner,
    });
    broadcastToAdmins("program_admin_survey");
    return withLink(updated ?? existingForProgram);
  }

  const survey = await createSurvey({
    ownerId: linkOwner,
    programId: input.programId,
    name: null, // the program owns the name
    description: null,
    templateId: input.templateId,
    contractTemplateId: input.contractTemplateId ?? null,
    token: makeToken(),
  });
  broadcastToAdmins("program_admin_survey");
  return withLink(survey);
}

/** The survey attached to a program (for the Programs list/share button). */
export async function getSurveyForProgram(
  programId: string
): Promise<SurveyWithLink | null> {
  const survey = await findSurveyByProgram(programId);
  return survey ? withLink(survey) : null;
}

export async function getProgramSurveys(
  ownerId: string | null
): Promise<SurveyWithLink[]> {
  const rows = await listSurveys(ownerId);
  return rows.map(withLink);
}

/** Loads a program-survey the caller owns (null owner = platform admin). */
async function ownedSurvey(
  id: string,
  ownerId: string | null
): Promise<PublicSurvey> {
  const survey = await findSurveyById(id);
  if (!survey) throw ApiError.notFound("Program not found.");
  if (ownerId && survey.owner_id !== ownerId) {
    throw ApiError.forbidden("You do not have access to this program.");
  }
  return survey;
}

export async function getProgramSurvey(
  id: string,
  ownerId: string | null
): Promise<SurveyWithLink> {
  return withLink(await ownedSurvey(id, ownerId));
}

export async function editProgramSurvey(
  id: string,
  ownerId: string | null,
  input: {
    name?: string;
    description?: string | null;
    templateId?: string;
    contractTemplateId?: string | null;
    isActive?: boolean;
  }
): Promise<SurveyWithLink> {
  await ownedSurvey(id, ownerId);
  if (input.templateId) await getTemplateForOwner(input.templateId, ownerId);
  if (input.contractTemplateId)
    await getContractForOwner(input.contractTemplateId, ownerId);
  const updated = await updateSurvey(id, {
    name: input.name?.trim(),
    description:
      input.description !== undefined ? input.description?.trim() || null : undefined,
    templateId: input.templateId,
    contractTemplateId: input.contractTemplateId,
    isActive: input.isActive,
  });
  if (!updated) throw ApiError.notFound("Program not found.");
  broadcastToAdmins("program_admin_survey");
  return withLink(updated);
}

/** Locking a survey freezes its questions and opens the program's assessment to farmers. */
export async function setProgramSurveyLocked(
  id: string,
  ownerId: string | null,
  actorId: string,
  locked: boolean
): Promise<SurveyWithLink> {
  const survey = await ownedSurvey(id, ownerId);
  if (locked === (survey.locked_at !== null)) return withLink(survey);
  const updated = await setSurveyLock(id, locked ? actorId : null);
  if (!updated) throw ApiError.notFound("Program not found.");
  broadcastToAdmins("program_admin_survey");
  return withLink(updated);
}

export async function removeProgramSurvey(
  id: string,
  ownerId: string | null
): Promise<void> {
  await ownedSurvey(id, ownerId);
  const ok = await softDeleteSurvey(id);
  if (!ok) throw ApiError.notFound("Program not found.");
  broadcastToAdmins("program_admin_survey");
}

/** Emails this program's survey link to one or more producers. */
export async function shareProgramByEmail(
  id: string,
  ownerId: string | null,
  emails: string[]
): Promise<number> {
  const survey = await ownedSurvey(id, ownerId);
  const content = surveyInviteEmail({
    link: surveyPublicLink(survey.token),
    programName: survey.name,
    surveyName: survey.template_name,
  });
  let sent = 0;
  for (const to of emails) {
    const ok = await sendMail({ to: to.trim(), ...content }).catch((err) => {
      logger.warn(`Could not send program survey invite to ${to}`, err);
      return false;
    });
    if (ok) sent += 1;
  }
  return sent;
}

// ===========================================================================
// Public survey flow (by the program's token) - no account, no password
// ===========================================================================

async function unusablePasswordHash(): Promise<string> {
  return bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
}

async function accountFor(
  email: string,
  first: string,
  last: string,
  phone: string | null
): Promise<{ id: string; email: string; full_name: string }> {
  const existing = await findWebsiteUserByEmailPublic(email);
  if (existing) {
    // The account is reused across programs, so refresh the details this survey
    // supplied - otherwise a phone entered now would never be stored.
    await updateWebsiteUserDetails(existing.id, {
      fullName: fullName(first, last),
      phone: phone?.trim() || null,
    });
    return existing;
  }
  return createWebsiteUser({
    fullName: fullName(first, last),
    email,
    passwordHash: await unusablePasswordHash(),
    phone: phone?.trim() || null,
  });
}

/** The program survey a token points to, with its questions - for the survey page. */
export async function getPublicSurveyStructure(token: string): Promise<{
  programName: string;
  /** The survey itself, named under the program it belongs to. */
  surveyName: string;
  description: string | null;
  categories: Awaited<ReturnType<typeof getSurveyStructure>>;
  scaleLabels: string[];
}> {
  const survey = await findSurveyByToken(token);
  if (!survey) throw ApiError.notFound("This survey link is not valid.");
  const categories = await getSurveyStructure(survey.template_id);
  return {
    programName: survey.name,
    surveyName: survey.template_name,
    description: survey.description,
    categories,
    scaleLabels: SCALE_LABELS,
  };
}

export async function sendSurveyOtp(rawEmail: string): Promise<{ code?: string }> {
  const email = rawEmail.trim().toLowerCase();
  const code = generateOtp();
  await createOtp(email, code, otpExpiry());
  await sendMail({ to: email, ...surveyOtpEmail(code) }).catch((err) => {
    logger.warn(`Could not send survey OTP to ${email}`, err);
    return false;
  });
  return env.smtp.enabled ? {} : { code };
}

export async function verifySurveyOtp(
  rawEmail: string,
  code: string
): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const otp = await findActiveOtp(email);
  if (!otp || otp.code !== code.trim()) {
    throw ApiError.badRequest("That code is invalid or has expired.");
  }
  await consumeOtp(otp.id);
}

export interface EmailCheckResult {
  state: "new" | "draft" | "submitted" | "returning";
  statusToken: string | null;
  /** Set on "returning": details already given, not asked for again. */
  profile: KnownProfile | null;
  draft: {
    firstName: string | null;
    lastName: string | null;
    farmName: string | null;
    referralSource: string | null;
    state: string | null;
    totalAcres: string | null;
    answers: Record<string, number>;
  } | null;
}

export async function checkEmail(
  token: string,
  rawEmail: string
): Promise<EmailCheckResult> {
  const survey = await findSurveyByToken(token);
  if (!survey) throw ApiError.notFound("This survey link is not valid.");
  const email = rawEmail.trim().toLowerCase();
  const account = await findWebsiteUserByEmailPublic(email);
  if (!account) return { state: "new", statusToken: null, profile: null, draft: null };

  const submission = await findSubmissionBySurveyAndUser(survey.id, account.id);
  if (!submission) return returningOrNew(email);

  if (submission.status === "draft") {
    const answers: Record<string, number> = {};
    for (const a of submission.answers) answers[a.questionId] = a.answer;
    return {
      state: "draft",
      statusToken: submission.status_token,
      profile: null,
      draft: {
        firstName: submission.first_name,
        lastName: submission.last_name,
        farmName: submission.farm_name,
        referralSource: submission.referral_source,
        state: submission.state,
        totalAcres: submission.total_acres,
        answers,
      },
    };
  }
  return {
    state: "submitted",
    statusToken: submission.status_token,
    profile: null,
    draft: null,
  };
}

/**
 * Somebody who already holds an Enrollment ID has given these details once.
 * The next survey reuses them rather than asking again.
 */
/** The stored details of someone who already holds an Enrollment ID. */
async function lockedProfileFor(email: string): Promise<KnownProfile | null> {
  const held = await enrollmentIdsForEmail(email);
  if (!held.length) return null;
  return latestProfileForEmail(email);
}

async function returningOrNew(email: string): Promise<EmailCheckResult> {
  const profile = await lockedProfileFor(email);
  if (!profile) {
    return { state: "new", statusToken: null, profile: null, draft: null };
  }
  return { state: "returning", statusToken: null, profile, draft: null };
}

export interface DraftInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  farmName?: string | null;
  referralSource?: string | null;
  state?: string | null;
  totalAcres?: number | null;
  answers?: Record<string, number>;
}

function toStoredAnswers(answers: Record<string, number>): StoredAnswer[] {
  return Object.entries(answers).map(([questionId, answer]) => ({
    questionId,
    answer,
    score: 0,
  }));
}

export async function saveDraft(
  token: string,
  input: DraftInput
): Promise<{ statusToken: string }> {
  const survey = await findSurveyByToken(token);
  if (!survey) throw ApiError.notFound("This survey link is not valid.");
  const email = input.email.trim().toLowerCase();

  // A returning farmer's details are read back here rather than trusted from
  // the request, so the locked fields cannot be edited by a crafted payload.
  const known = await lockedProfileFor(email);
  const details: KnownProfile = known ?? {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone?.trim() || null,
    farmName: input.farmName?.trim() || null,
    referralSource: input.referralSource?.trim() || null,
    state: input.state?.trim() || null,
    totalAcres: input.totalAcres === null || input.totalAcres === undefined
      ? null
      : String(input.totalAcres),
  };

  const account = await accountFor(
    email,
    details.firstName ?? "",
    details.lastName ?? "",
    details.phone
  );

  const existing = await findSubmissionBySurveyAndUser(survey.id, account.id);
  if (existing && existing.status !== "draft") {
    throw ApiError.conflict(
      "This email has already completed the survey for this program."
    );
  }

  const statusToken = existing?.status_token ?? makeToken();
  await upsertDraft(existing?.id ?? null, survey.id, account.id, statusToken, {
    firstName: details.firstName ?? "",
    lastName: details.lastName ?? "",
    phone: details.phone,
    farmName: details.farmName,
    referralSource: details.referralSource,
    state: details.state,
    totalAcres: details.totalAcres === null ? null : Number(details.totalAcres),
    answers: toStoredAnswers(input.answers ?? {}),
  });
  broadcastToAdmins("program_admin_survey");
  return { statusToken };
}

export interface SubmitInput extends DraftInput {
  answers: Record<string, number>;
}

export interface SubmitResult {
  statusToken: string;
  qualified: boolean;
  message: string;
  category: SurveyCategory;
}

export async function submitSurvey(
  token: string,
  input: SubmitInput
): Promise<SubmitResult> {
  const survey = await findSurveyByToken(token);
  if (!survey) throw ApiError.notFound("This survey link is not valid.");
  const email = input.email.trim().toLowerCase();
  const account = await accountFor(
    email,
    input.firstName,
    input.lastName,
    input.phone ?? null
  );

  const existing = await findSubmissionBySurveyAndUser(survey.id, account.id);
  if (existing && existing.status !== "draft") {
    throw ApiError.conflict(
      "This email has already completed the survey for this program."
    );
  }

  const { answers, score, category } = await scoreSurvey(
    survey.template_id,
    input.answers
  );
  const qualified = category !== "not_qualified";
  const statusToken = existing?.status_token ?? makeToken();

  const detailFields = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    // What was given here, blank included: it is this submission's own.
    phone: input.phone?.trim() || null,
    farmName: input.farmName?.trim() || null,
    referralSource: input.referralSource?.trim() || null,
    state: input.state?.trim() || null,
    totalAcres: input.totalAcres ?? null,
  };

  let submissionId = existing?.id ?? null;
  if (!submissionId) {
    const draft = await upsertDraft(null, survey.id, account.id, statusToken, {
      ...detailFields,
      answers,
    });
    submissionId = draft.id;
  }

  await finalizeSubmission(submissionId, {
    ...detailFields,
    answers,
    score,
    category,
    status: qualified ? "qualified" : "not_qualified",
  });

  // Thank-you receipt (also shown on the thank-you screen). No result disclosed.
  void sendMail({
    to: email,
    ...surveyReceivedEmail({
      fullName: fullName(input.firstName, input.lastName),
      programName: survey.name,
      surveyName: survey.template_name,
    }),
  }).catch((err) => {
    logger.warn(`Could not send survey thank-you email to ${email}`, err);
    return false;
  });

  broadcastToAdmins("program_admin_survey", { submissionId });
  void notifyOrgManagers({
    type: "survey_submitted",
    title: "New survey submission",
    body: `${fullName(input.firstName, input.lastName)} completed the survey for ${survey.name} (${qualified ? "qualified" : "not qualified"}).`,
    data: { submissionId },
  });

  return {
    statusToken,
    qualified,
    message: qualified ? QUALIFIED_MESSAGE : NOT_QUALIFIED_MESSAGE,
    category,
  };
}

export interface StandaloneStatus {
  fullName: string;
  email: string;
  programName: string;
  state: string | null;
  totalAcres: string | null;
  status: SubmissionStatus;
  category: SurveyCategory;
  score: number;
  message: string;
  contractToken: string | null;
  contractSignedAt: Date | null;
  appLink: string;
}

export async function getStatus(token: string): Promise<StandaloneStatus> {
  const submission = await findSubmissionByStatusToken(token);
  if (!submission) throw ApiError.notFound("This status link is not valid.");
  const contract = await findLatestContract(submission.id);
  const contractToken = contract && !contract.signed_at ? contract.token : null;
  return {
    fullName: submission.full_name,
    email: submission.email,
    programName: submission.survey_name,
    state: submission.state,
    totalAcres: submission.total_acres,
    status: submission.status,
    category: submission.final_category,
    score: submission.score,
    message:
      submission.status === "not_qualified"
        ? NOT_QUALIFIED_MESSAGE
        : QUALIFIED_MESSAGE,
    contractToken,
    contractSignedAt: contract?.signed_at ?? null,
    appLink: env.mobileAppUrl,
  };
}

// ===========================================================================
// Contract signing (public, token-based)
// ===========================================================================

export interface ContractForSigning {
  contract: PublicContract;
  submission: PublicSubmission;
  // What to display, from the program's contract (or the global one). When
  // pdfUrl is set the producer reads and signs that PDF.
  body: {
    // Identifies the document itself, for its title and its reference.
    id: string | null;
    name: string;
    intro: string | null;
    clauses: Array<{ heading: string; body: string }>;
    pdfUrl: string | null;
  };
}

export async function getContractByToken(
  token: string
): Promise<ContractForSigning> {
  const contract = await findContractByToken(token);
  if (!contract) throw ApiError.notFound("This contract link is not valid.");
  if (contract.token_expires_at < new Date()) {
    throw ApiError.badRequest(
      "This contract link has expired. Please contact the program administrator for a new one."
    );
  }
  const submission = await findSubmissionById(contract.submission_id);
  if (!submission) throw ApiError.notFound("This contract link is not valid.");
  const survey = await findSurveyById(submission.survey_id);
  const body = await resolveContractForProgram(
    survey?.contract_template_id ?? null
  );
  return { contract, submission, body };
}

/** The program a submission belongs to, for the documents it produces. */
export async function getSurveyForSubmission(surveyId: string) {
  return findSurveyById(surveyId);
}

/**
 * Everything a written contract needs to be laid out as a document: whose
 * letterhead it carries, its title, and its reference.
 */
export async function contractDocFor(
  programId: string | null,
  body: {
    id: string | null;
    name: string;
    intro: string | null;
    clauses: Array<{ heading: string; body: string }>;
  },
  issuedAt: Date
): Promise<ContractDocInput> {
  const program = programId ? await findProgramById(programId) : null;
  const org = program?.org_id
    ? await findOrgById(program.org_id)
    : await defaultOrg();
  return {
    // Dates on the document read the same as everywhere else in the platform.
    clock: await getClock(),
    contractName: body.name,
    org: org
      ? {
          name: org.name,
          code: org.code,
          address: org.address,
          contactEmail: org.contact_email,
          contactPhone: org.contact_phone,
          logoUrl: org.logo_url,
        }
      : null,
    reference: `${(org?.code || "IIG").toUpperCase()}-CON-${(
      body.id ?? "00000000"
    )
      .slice(0, 8)
      .toUpperCase()}`,
    issuedAt,
    intro: body.intro,
    clauses: body.clauses,
  };
}

/** The organization whose letterhead a document carries when no program says. */
async function defaultOrg() {
  const id = await getDefaultOrgId();
  return id ? findOrgById(id) : null;
}

/**
 * A contract template laid out as the document a producer would read, so it
 * can be looked at as a PDF before it is ever sent to anyone.
 */
export async function contractTemplateDoc(tpl: {
  id: string;
  name: string;
  intro: string | null;
  clauses: Array<{ heading: string; body: string }>;
  created_at: Date;
}): Promise<ContractDocInput> {
  return contractDocFor(
    null,
    {
      id: tpl.id,
      name: tpl.name,
      intro: tpl.intro,
      clauses: tpl.clauses,
    },
    tpl.created_at
  );
}

/**
 * The two names every message in this flow carries: the program a producer
 * applied to, and the survey they answered.
 */
async function namesFor(surveyId: string): Promise<{
  programName: string | null;
  surveyName: string | null;
}> {
  const survey = await findSurveyById(surveyId);
  return {
    programName: survey?.name ?? null,
    surveyName: survey?.template_name ?? null,
  };
}

/** Renders the signed copy and stores it against the contract. */
async function buildAndStoreSignedPdf(
  contractId: string,
  submission: PublicSubmission,
  signed: PublicContract
): Promise<void> {
  const survey = await findSurveyById(submission.survey_id);
  const body = await resolveContractForProgram(
    survey?.contract_template_id ?? null
  );
  const bytes = await buildSignedContractPdf({
    producerName: submission.full_name,
    producerEmail: submission.email,
    programName: submission.survey_name,
    state: submission.state,
    totalAcres: submission.total_acres,
    signedName: signed.signed_name ?? submission.full_name,
    signedAt: signed.signed_at ?? new Date(),
    signerIp: signed.signer_ip,
    contractPdfUrl: body.pdfUrl,
    doc: await contractDocFor(
      survey?.program_id ?? null,
      body,
      signed.signed_at ?? new Date()
    ),
    intro: body.intro,
    clauses: body.clauses,
    signatureUrl: signed.signature_url,
  });
  const url = await uploadContractPdf(
    Buffer.from(bytes),
    `signed-contract-${submission.id.slice(0, 8)}`
  );
  await setSignedPdfUrl(contractId, url);
  broadcastToAdmins("program_admin_survey", { submissionId: submission.id });
}

export async function signContractByToken(
  token: string,
  input: {
    signedName: string;
    signatureUrl?: string | null;
    ip: string | null;
    userAgent: string | null;
  }
): Promise<PublicContract> {
  const { contract, submission } = await getContractByToken(token);
  if (contract.signed_at) {
    throw ApiError.conflict("This contract has already been signed.");
  }
  if (submission.status !== "contract_sent") {
    throw ApiError.conflict(
      "This contract is not awaiting a signature. Please contact the program administrator."
    );
  }
  const signed = await signContract(contract.id, {
    signedName: input.signedName.trim(),
    signatureUrl: input.signatureUrl ?? null,
    ip: input.ip,
    userAgent: input.userAgent,
  });
  if (!signed) throw ApiError.conflict("This contract has already been signed.");

  // Build the signed copy: the contract they read plus a signature page with
  // their details. Fire-and-forget so signing never fails on a PDF hiccup.
  void buildAndStoreSignedPdf(contract.id, submission, signed).catch((err) => {
    logger.warn("Could not build the signed contract PDF", err);
  });

  await updateSubmission(submission.id, { status: "contract_signed" });
  broadcastToAdmins("program_admin_survey", { submissionId: submission.id });
  notifySubmission(submission.id, "contract_signed", {
    submissionId: submission.id,
  });
  void notifyOrgManagers({
    type: "contract_signed",
    title: "Contract signed",
    body: `${submission.full_name} signed their contract and is ready to enroll.`,
    data: { submissionId: submission.id },
  });
  return signed;
}

// ===========================================================================
// Admin - all scoped to the program administrator who owns the program
// ===========================================================================

export interface ListInput {
  page: number;
  limit: number;
  status?: string;
  category?: SurveyCategory;
  programId?: string;
  referral?: string;
  createdFrom?: string;
  createdTo?: string;
  search?: string;
}

const STATUS_FILTER_GROUPS: Record<string, SubmissionStatus[]> = {
  registered: ["draft"],
  under_review: ["submitted", "qualified"],
  contract_sent: ["contract_sent", "contract_signed"],
  enrolled: ["enrolled"],
  not_qualified: ["not_qualified"],
  withdrawn: ["withdrawn"],
};

// The day a "to" date names counts whole. Both ends are read here for the table
// and for the cards, so the two can never disagree about the window.
function dateRange(
  createdFrom?: string,
  createdTo?: string
): { createdFrom?: Date; createdTo?: Date } {
  const toEnd = createdTo ? new Date(createdTo) : undefined;
  if (toEnd) toEnd.setHours(23, 59, 59, 999);
  return {
    createdFrom: createdFrom ? new Date(createdFrom) : undefined,
    createdTo: toEnd,
  };
}

export async function getSubmissions(
  ownerId: string | null,
  input: ListInput
): Promise<{ rows: PublicSubmission[]; total: number; page: number; limit: number }> {
  const statuses = input.status
    ? (STATUS_FILTER_GROUPS[input.status] ?? [input.status as SubmissionStatus])
    : undefined;
  const { rows, total } = await listSubmissions({
    ownerId,
    programId: input.programId,
    statuses,
    category: input.category,
    referral: input.referral,
    ...dateRange(input.createdFrom, input.createdTo),
    search: input.search,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  });
  return { rows, total, page: input.page, limit: input.limit };
}

/** Loads a submission the caller may view (owns its program, or is admin). */
async function ownedSubmission(
  id: string,
  ownerId: string | null
): Promise<PublicSubmission> {
  const submission = await findSubmissionById(id);
  if (!submission) throw ApiError.notFound("Submission not found.");
  if (ownerId) {
    const survey = await findSurveyById(submission.survey_id);
    if (!survey || survey.owner_id !== ownerId) {
      throw ApiError.forbidden("You do not have access to this submission.");
    }
  }
  return submission;
}

export async function getSubmission(
  id: string,
  ownerId: string | null
): Promise<{ submission: PublicSubmission; contract: PublicContract | null }> {
  const submission = await ownedSubmission(id, ownerId);
  const contract = await findLatestContract(id);
  return { submission, contract };
}

export interface StatsInput {
  programId?: string;
  category?: SurveyCategory;
  referral?: string;
  createdFrom?: string;
  createdTo?: string;
  search?: string;
}

/** The cards over the table, counted across the same rows the table shows. */
export function getSubmissionStats(
  ownerId: string | null,
  input: StatsInput = {}
): Promise<Record<string, number>> {
  return countByStatus({
    ownerId,
    programId: input.programId,
    category: input.category,
    referral: input.referral,
    search: input.search,
    ...dateRange(input.createdFrom, input.createdTo),
  });
}

function statusLinkFor(submission: PublicSubmission): string | undefined {
  return submission.status_token
    ? statusLink(submission.status_token)
    : undefined;
}

export async function setCategory(
  id: string,
  ownerId: string | null,
  category: SurveyCategory,
  adminId: string,
  reason: string | null = null
): Promise<PublicSubmission> {
  const submission = await ownedSubmission(id, ownerId);
  if (submission.status === "enrolled") {
    throw ApiError.conflict(
      "This producer is already enrolled, so the band can no longer be changed."
    );
  }
  let status = submission.status;
  if (category === "not_qualified") status = "not_qualified";
  else if (submission.status === "not_qualified") status = "qualified";

  const updated = await updateSubmission(id, {
    final_category: category,
    status,
    override_reason: reason?.trim() || null,
    reviewed_by: adminId,
    reviewed_at: new Date(),
  });
  if (!updated) throw ApiError.notFound("Submission not found.");

  const link = statusLinkFor(updated);
  const emailReason = reason?.trim() || undefined;
  const names = await namesFor(updated.survey_id);
  mailQuietly(
    updated.email,
    category === "not_qualified"
      ? surveyNotQualifiedEmail({
          fullName: updated.full_name,
          link,
          reason: emailReason,
          ...names,
        })
      : surveyQualifiedEmail({
          fullName: updated.full_name,
          category,
          link,
          reason: emailReason,
          ...names,
        })
  );

  broadcastToAdmins("program_admin_survey", { submissionId: id });
  notifySubmission(id, "band_changed", { submissionId: id, category });
  return updated;
}

export async function sendContract(
  id: string,
  ownerId: string | null,
  adminId: string
): Promise<{ submission: PublicSubmission; contract: PublicContract }> {
  const submission = await ownedSubmission(id, ownerId);
  if (submission.status === "not_qualified") {
    throw ApiError.conflict(
      "This producer did not qualify, so a contract cannot be sent."
    );
  }
  if (submission.status === "enrolled") {
    throw ApiError.conflict("This producer is already enrolled.");
  }
  if (submission.status === "contract_signed") {
    throw ApiError.conflict(
      "The contract has already been signed and is waiting for your acceptance."
    );
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CONTRACT_TOKEN_DAYS);
  const contract = await createContract({
    submissionId: id,
    token: makeToken(),
    expiresAt,
  });
  const updated = await updateSubmission(id, {
    status: "contract_sent",
    reviewed_by: adminId,
    reviewed_at: new Date(),
  });

  const contractNames = await namesFor(submission.survey_id);
  const clock = await getClock();
  mailQuietly(
    submission.email,
    contractToSignEmail({
      fullName: submission.full_name,
      link: contractLink(contract.token, submission.status_token),
      expiresAt,
      expiresLabel: formatDate(expiresAt, clock),
      ...contractNames,
    })
  );

  broadcastToAdmins("program_admin_survey", { submissionId: id });
  notifySubmission(id, "contract_sent", { submissionId: id });
  return { submission: updated ?? submission, contract };
}

/**
 * The year the setup checklist refers to. A program's own start date wins, so a
 * 2026 program enrolled in late 2025 still reads 2026. Without one, the year on
 * the office clock is used rather than the server's.
 */
async function programYear(programId: string | null): Promise<number> {
  if (programId) {
    const program = await findProgramById(programId);
    const year = Number((program?.start_date ?? "").slice(0, 4));
    if (Number.isFinite(year) && year > 0) return year;
  }
  return Number((await orgToday()).slice(0, 4));
}

async function generateEnrollmentId(): Promise<string> {
  const year = new Date().getFullYear();
  for (let i = 0; i < 10; i++) {
    const n = crypto.randomInt(100000, 1000000);
    const candidate = `IIG-${year}-${n}`;
    if (!(await enrollmentIdExists(candidate))) return candidate;
  }
  throw ApiError.internal("Could not generate an Enrollment ID. Please retry.");
}

export async function acceptAndEnroll(
  id: string,
  ownerId: string | null,
  adminId: string
): Promise<PublicSubmission> {
  const submission = await ownedSubmission(id, ownerId);
  if (submission.status === "enrolled") {
    throw ApiError.conflict("This producer is already enrolled.");
  }
  if (submission.status !== "contract_signed") {
    throw ApiError.conflict(
      "The contract has not been signed yet, so an Enrollment ID cannot be issued."
    );
  }
  const contract = await findLatestContract(id);
  if (!contract || !contract.signed_at) {
    throw ApiError.conflict("No signed contract was found for this producer.");
  }
  await acceptContract(contract.id, adminId);

  const enrollmentId = await generateEnrollmentId();
  const updated = await updateSubmission(id, {
    status: "enrolled",
    enrollment_id: enrollmentId,
    reviewed_by: adminId,
    reviewed_at: new Date(),
  });
  if (!updated) throw ApiError.notFound("Submission not found.");

  const survey = await findSurveyById(submission.survey_id);
  // Only the program here: the survey is behind them.
  const programName = survey?.name ?? null;

  // Someone joining a second program already has an account and has long since
  // set up their farms and fields. Telling them to register again, and walking
  // them back through the setup checklist, would only confuse them. So the
  // first-timer gets the full welcome, and everyone else gets the short note.
  const account = await findByEmail(submission.email);
  if (account) {
    mailQuietly(
      submission.email,
      returningEnrollmentEmail({
        fullName: submission.full_name,
        enrollmentId,
        programName,
        classification: submission.final_category,
        appLink: env.mobileAppUrl,
      })
    );
  } else {
    mailQuietly(
      submission.email,
      enrollmentWelcomeEmail({
        fullName: submission.full_name,
        enrollmentId,
        appLink: env.mobileAppUrl,
        programName,
      })
    );
    // And straight after it, what to do next.
    mailQuietly(
      submission.email,
      farmSetupEmail({
        fullName: submission.full_name,
        programName,
        classification: submission.final_category,
        year: await programYear(survey?.program_id ?? null),
        appLink: env.mobileAppUrl,
      })
    );
  }

  broadcastToAdmins("program_admin_survey", { submissionId: id });
  notifySubmission(id, "enrolled", { submissionId: id, enrollmentId });
  return updated;
}

export async function deleteSubmission(
  id: string,
  ownerId: string | null
): Promise<void> {
  await ownedSubmission(id, ownerId);
  const ok = await softDeleteSubmission(id);
  if (!ok) throw ApiError.notFound("Submission not found.");
  // The contract only ever existed for this submission, and the signing link
  // in it must stop working the moment the submission is gone.
  await deleteContractsForSubmission(id);
  broadcastToAdmins("program_admin_survey", { submissionId: id });
}

export async function withdrawSubmission(
  id: string,
  ownerId: string | null
): Promise<PublicSubmission> {
  const submission = await ownedSubmission(id, ownerId);
  if (submission.status === "withdrawn") return submission;
  const updated = await updateSubmission(id, { status: "withdrawn" });
  if (!updated) throw ApiError.notFound("Submission not found.");
  broadcastToAdmins("program_admin_survey", { submissionId: id });
  return updated;
}
