import crypto from "node:crypto";
import ApiError from "../utils/ApiError.js";
import { scoreSurvey } from "./survey.service.js";
import {
  broadcastToAdmins,
  notifyWebsiteUser,
  notifySubmission,
} from "./realtime.service.js";
import { notifyOrgManagers } from "./notification.service.js";
import {
  contractToSignEmail,
  enrollmentWelcomeEmail,
  surveyQualifiedEmail,
  surveyNotQualifiedEmail,
} from "./emailTemplates.js";
import { sendMail } from "./mailer.service.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import {
  createSubmission,
  findSubmissionByUser,
  findSubmissionById,
  listSubmissions,
  updateSubmission,
  softDeleteSubmission,
  countByStatus,
  createContract,
  findContractByToken,
  findLatestContract,
  signContract,
  acceptContract,
  enrollmentIdExists,
  type PublicSubmission,
  type PublicContract,
  type SubmissionStatus,
} from "../models/eligibility.model.js";
import type { SurveyCategory } from "../models/survey.model.js";
import { findWebsiteUserById } from "../models/websiteUser.model.js";

const CONTRACT_TOKEN_DAYS = 30;

// Wording taken from the client document.
export const QUALIFIED_MESSAGE =
  "Congratulations, you qualify to enroll in the program. A Greenfield representative will reach out for further enrollment steps.";
export const NOT_QUALIFIED_MESSAGE =
  "Sorry, based on your responses, you are not qualified to enroll in this program.";

function mailQuietly(to: string, content: { subject: string; text: string; html: string }): void {
  void sendMail({ to, ...content }).catch((err) => {
    logger.warn(`Could not send email to ${to}`, err);
  });
}

// The producer's status page link, so result emails can carry a "check status"
// button. Only the standalone survey has its own hosted status page.
function statusLinkFor(submission: PublicSubmission): string | undefined {
  if (submission.channel === "standalone" && submission.status_token) {
    return `${env.surveyAppUrl}/survey/status/${submission.status_token}`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Website: submit and track
// ---------------------------------------------------------------------------

export interface SubmitSurveyInput {
  state: string;
  totalAcres: number;
  answers: Record<string, number>;
}

export interface SubmitSurveyResult {
  submission: PublicSubmission;
  qualified: boolean;
  message: string;
}

export async function submitSurvey(
  websiteUserId: string,
  input: SubmitSurveyInput
): Promise<SubmitSurveyResult> {
  const account = await findWebsiteUserById(websiteUserId);
  if (!account) throw ApiError.notFound("Account not found.");

  // Duplicate rule: one live submission per account (same email).
  const existing = await findSubmissionByUser(websiteUserId);
  if (existing) {
    throw ApiError.conflict(
      "You have already submitted the eligibility survey. Please contact the program administrator if you need to change your answers."
    );
  }

  const { answers, score, category } = await scoreSurvey(input.answers);
  const qualified = category !== "not_qualified";

  const submission = await createSubmission({
    websiteUserId,
    state: input.state.trim(),
    totalAcres: input.totalAcres,
    answers,
    score,
    category,
    status: qualified ? "qualified" : "not_qualified",
  });

  // No result email here on purpose. The program sends only two emails: the
  // contract link and the enrollment welcome. The producer sees their result on
  // screen and can track it by email.
  broadcastToAdmins("eligibility", { submissionId: submission.id });
  notifyWebsiteUser(websiteUserId, "submission_scored", {
    submissionId: submission.id,
  });
  void notifyOrgManagers({
    type: "survey_submitted",
    title: "New survey submission",
    body: `${account.full_name} completed the eligibility survey (${qualified ? "qualified" : "not qualified"}).`,
    data: { submissionId: submission.id },
  });

  return {
    submission,
    qualified,
    message: qualified ? QUALIFIED_MESSAGE : NOT_QUALIFIED_MESSAGE,
  };
}

export interface WebsiteStatus {
  submission: PublicSubmission | null;
  contract: { token: string; signed: boolean; expiresAt: Date } | null;
  message: string | null;
}

/** Everything the website dashboard needs in one call. */
export async function getWebsiteStatus(
  websiteUserId: string
): Promise<WebsiteStatus> {
  const submission = await findSubmissionByUser(websiteUserId);
  if (!submission) return { submission: null, contract: null, message: null };

  let contract: WebsiteStatus["contract"] = null;
  if (
    submission.status === "contract_sent" ||
    submission.status === "contract_signed" ||
    submission.status === "enrolled"
  ) {
    const c = await findLatestContract(submission.id);
    if (c) {
      contract = {
        token: c.token,
        signed: c.signed_at !== null,
        expiresAt: c.token_expires_at,
      };
    }
  }

  const message =
    submission.status === "not_qualified"
      ? NOT_QUALIFIED_MESSAGE
      : QUALIFIED_MESSAGE;

  return { submission, contract, message };
}

// ---------------------------------------------------------------------------
// Website: contract signing
// ---------------------------------------------------------------------------

export interface ContractForSigning {
  contract: PublicContract;
  submission: PublicSubmission;
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
  return { contract, submission };
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

  await updateSubmission(submission.id, { status: "contract_signed" });
  broadcastToAdmins("eligibility", { submissionId: submission.id });
  notifyWebsiteUser(submission.website_user_id, "contract_signed", {
    submissionId: submission.id,
  });
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

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface ListInput {
  page: number;
  limit: number;
  status?: string;
  category?: SurveyCategory;
  channel?: "website" | "standalone";
  referral?: string;
  createdFrom?: string;
  createdTo?: string;
  search?: string;
}

// A status filter can be a granular status or a grouped one (Under Review folds
// submitted + qualified; Contract Sent folds contract_sent + contract_signed).
const STATUS_FILTER_GROUPS: Record<string, SubmissionStatus[]> = {
  registered: ["draft"],
  under_review: ["submitted", "qualified"],
  contract_sent: ["contract_sent", "contract_signed"],
  enrolled: ["enrolled"],
  not_qualified: ["not_qualified"],
  withdrawn: ["withdrawn"],
};

export async function getSubmissions(input: ListInput) {
  const statuses = input.status
    ? (STATUS_FILTER_GROUPS[input.status] ?? [input.status as SubmissionStatus])
    : undefined;
  const toEnd = input.createdTo ? new Date(input.createdTo) : undefined;
  if (toEnd) toEnd.setHours(23, 59, 59, 999);
  const { rows, total } = await listSubmissions({
    statuses,
    category: input.category,
    channel: input.channel,
    referral: input.referral,
    createdFrom: input.createdFrom ? new Date(input.createdFrom) : undefined,
    createdTo: toEnd,
    search: input.search,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  });
  return {
    submissions: rows,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function getSubmissionDetail(id: string) {
  const submission = await findSubmissionById(id);
  if (!submission) throw ApiError.notFound("Submission not found.");
  const contract = await findLatestContract(id);
  return { submission, contract };
}

export function getSubmissionStats(): Promise<Record<string, number>> {
  return countByStatus();
}

/** Admin overrides the band the algorithm suggested. */
export async function setCategory(
  id: string,
  category: SurveyCategory,
  adminId: string,
  reason: string | null = null
): Promise<PublicSubmission> {
  const submission = await findSubmissionById(id);
  if (!submission) throw ApiError.notFound("Submission not found.");
  if (submission.status === "enrolled") {
    throw ApiError.conflict(
      "This producer is already enrolled, so the band can no longer be changed."
    );
  }

  // Moving someone into or out of Not Qualified also moves the workflow.
  let status = submission.status;
  if (category === "not_qualified") {
    status = "not_qualified";
  } else if (submission.status === "not_qualified") {
    status = "qualified";
  }

  const updated = await updateSubmission(id, {
    final_category: category,
    status,
    override_reason: reason?.trim() || null,
    reviewed_by: adminId,
    reviewed_at: new Date(),
  });
  if (!updated) throw ApiError.notFound("Submission not found.");

  // Email the producer their result straight away (the admin does this from the
  // submission's Override panel), carrying the admin's reason when given.
  // Fire-and-forget so it never blocks the save.
  const link = statusLinkFor(updated);
  const emailReason = reason?.trim() || undefined;
  mailQuietly(
    updated.email,
    category === "not_qualified"
      ? surveyNotQualifiedEmail({
          fullName: updated.full_name,
          link,
          reason: emailReason,
        })
      : surveyQualifiedEmail({
          fullName: updated.full_name,
          category,
          link,
          reason: emailReason,
        })
  );

  broadcastToAdmins("eligibility", { submissionId: id });
  notifyWebsiteUser(submission.website_user_id, "band_changed", {
    submissionId: id,
    category,
  });
  notifySubmission(id, "band_changed", { submissionId: id, category });
  return updated;
}

function makeToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export async function sendContract(
  id: string,
  adminId: string
): Promise<{ submission: PublicSubmission; contract: PublicContract }> {
  const submission = await findSubmissionById(id);
  if (!submission) throw ApiError.notFound("Submission not found.");
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

  // The standalone flow lives on its own app, so its emails must point there.
  // The status token rides along so the signed-contract screen can link back to
  // the producer's status page.
  const isStandalone = submission.channel === "standalone";
  // The standalone survey lives in the admin app at /survey; the website has its
  // own /contract route.
  const contractLink =
    isStandalone && submission.status_token
      ? `${env.surveyAppUrl}/survey/contract/${contract.token}?s=${submission.status_token}`
      : `${env.websiteUrl}/contract/${contract.token}`;
  mailQuietly(
    submission.email,
    contractToSignEmail({
      fullName: submission.full_name,
      link: contractLink,
      expiresAt,
    })
  );

  broadcastToAdmins("eligibility", { submissionId: id });
  notifyWebsiteUser(submission.website_user_id, "contract_sent", {
    submissionId: id,
    token: contract.token,
  });
  notifySubmission(id, "contract_sent", { submissionId: id });
  return { submission: updated ?? submission, contract };
}

async function generateEnrollmentId(): Promise<string> {
  const year = new Date().getFullYear();
  // Retry on the tiny chance of a collision.
  for (let i = 0; i < 10; i++) {
    const n = crypto.randomInt(100000, 1000000);
    const candidate = `IIG-${year}-${n}`;
    if (!(await enrollmentIdExists(candidate))) return candidate;
  }
  throw ApiError.internal("Could not generate an Enrollment ID. Please retry.");
}

export async function acceptAndEnroll(
  id: string,
  adminId: string
): Promise<PublicSubmission> {
  const submission = await findSubmissionById(id);
  if (!submission) throw ApiError.notFound("Submission not found.");
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

  mailQuietly(
    submission.email,
    enrollmentWelcomeEmail({
      fullName: submission.full_name,
      enrollmentId,
      appLink: env.mobileAppUrl,
    })
  );

  broadcastToAdmins("eligibility", { submissionId: id });
  notifyWebsiteUser(submission.website_user_id, "enrolled", {
    submissionId: id,
    enrollmentId,
  });
  notifySubmission(id, "enrolled", { submissionId: id, enrollmentId });
  return updated;
}

/** Admin removes a survey submission from the list. Any status can be deleted. */
export async function deleteSubmission(id: string): Promise<void> {
  const submission = await findSubmissionById(id);
  if (!submission) throw ApiError.notFound("Submission not found.");
  const ok = await softDeleteSubmission(id);
  if (!ok) throw ApiError.notFound("Submission not found.");
  broadcastToAdmins("eligibility", { submissionId: id });
}

/** Marks a submission as withdrawn (producer voluntarily left the program). */
export async function withdrawSubmission(id: string) {
  const submission = await findSubmissionById(id);
  if (!submission) throw ApiError.notFound("Submission not found.");
  if (submission.status === "withdrawn") return submission;
  const updated = await updateSubmission(id, { status: "withdrawn" });
  if (!updated) throw ApiError.notFound("Submission not found.");
  broadcastToAdmins("eligibility", { submissionId: id });
  notifySubmission(id, "withdrawn", { submissionId: id });
  return updated;
}
