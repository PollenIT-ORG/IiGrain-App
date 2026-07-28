import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import { scoreSurvey } from "./survey.service.js";
import { broadcastToAdmins } from "./realtime.service.js";
import { notifyOrgManagers } from "./notification.service.js";
import { sendMail } from "./mailer.service.js";
import { surveyInviteEmail } from "./emailTemplates.js";
import logger from "../utils/logger.js";
import {
  findSubmissionByUser,
  findSubmissionByStatusToken,
  findLatestContract,
  setSubmissionStatusToken,
  upsertDraft,
  finalizeSubmission,
  type PublicSubmission,
  type PublicContract,
  type StoredAnswer,
} from "../models/eligibility.model.js";
import {
  createWebsiteUser,
  findWebsiteUserByEmailPublic,
} from "../models/websiteUser.model.js";
import {
  QUALIFIED_MESSAGE,
  NOT_QUALIFIED_MESSAGE,
} from "./eligibility.service.js";

// The standalone survey has no account and no password. The producer is tracked
// by email; every step is saved as a draft so they can close the tab and resume.
export function statusLink(token: string): string {
  return `${env.surveyAppUrl}/survey/status/${token}`;
}

export function surveyInviteLink(): string {
  return `${env.surveyAppUrl}/survey`;
}

/** Admin shares the survey link by email with one or more prospective producers. */
export async function shareSurveyByEmail(emails: string[]): Promise<number> {
  const link = surveyInviteLink();
  const content = surveyInviteEmail({ link });
  let sent = 0;
  for (const to of emails) {
    const ok = await sendMail({ to: to.trim(), ...content }).catch((err) => {
      logger.warn(`Could not send survey invite to ${to}`, err);
      return false;
    });
    if (ok) sent += 1;
  }
  return sent;
}

async function unusablePasswordHash(): Promise<string> {
  return bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
}

function fullName(first: string, last: string): string {
  return `${first.trim()} ${last.trim()}`.trim();
}

// Ensures a passwordless account exists for this email and returns it.
async function accountFor(
  email: string,
  first: string,
  last: string,
  phone: string | null
): Promise<{ id: string; email: string; full_name: string }> {
  const existing = await findWebsiteUserByEmailPublic(email);
  if (existing) return existing;
  return createWebsiteUser({
    fullName: fullName(first, last),
    email,
    passwordHash: await unusablePasswordHash(),
    phone: phone?.trim() || null,
  });
}

// ---------------------------------------------------------------------------
// Email check: is this email new, mid-way (draft), or already submitted?
// ---------------------------------------------------------------------------

export interface EmailCheckResult {
  state: "new" | "draft" | "submitted";
  statusToken: string | null;
  // For a draft, the saved details + answers so the survey can resume.
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

export async function checkEmail(rawEmail: string): Promise<EmailCheckResult> {
  const email = rawEmail.trim().toLowerCase();
  const account = await findWebsiteUserByEmailPublic(email);
  if (!account) return { state: "new", statusToken: null, draft: null };

  const submission = await findSubmissionByUser(account.id);
  if (!submission) return { state: "new", statusToken: null, draft: null };

  if (submission.status === "draft") {
    const answers: Record<string, number> = {};
    for (const a of submission.answers) answers[a.questionId] = a.answer;
    return {
      state: "draft",
      statusToken: submission.status_token,
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

  // Any non-draft status means the survey is already in.
  return { state: "submitted", statusToken: submission.status_token, draft: null };
}

// ---------------------------------------------------------------------------
// Save draft (create or update partial progress)
// ---------------------------------------------------------------------------

export interface DraftInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  farmName?: string | null;
  referralSource?: string | null;
  state?: string | null;
  totalAcres?: number | null;
  // { questionId: 0-3 }, partial.
  answers?: Record<string, number>;
}

function toStoredAnswers(answers: Record<string, number>): StoredAnswer[] {
  return Object.entries(answers).map(([questionId, answer]) => ({
    questionId,
    answer,
    score: 0, // real scores are computed on final submit
  }));
}

export async function saveDraft(
  input: DraftInput
): Promise<{ statusToken: string }> {
  const email = input.email.trim().toLowerCase();
  const account = await accountFor(
    email,
    input.firstName,
    input.lastName,
    input.phone ?? null
  );

  const existing = await findSubmissionByUser(account.id);
  if (existing && existing.status !== "draft") {
    throw ApiError.conflict(
      "This email has already completed the survey. You can check your status instead."
    );
  }

  const statusToken =
    existing?.status_token ?? crypto.randomBytes(24).toString("hex");

  await upsertDraft(existing?.id ?? null, account.id, statusToken, {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    farmName: input.farmName?.trim() || null,
    referralSource: input.referralSource?.trim() || null,
    state: input.state?.trim() || null,
    totalAcres: input.totalAcres ?? null,
    answers: toStoredAnswers(input.answers ?? {}),
  });

  broadcastToAdmins("eligibility");
  return { statusToken };
}

// ---------------------------------------------------------------------------
// Final submit (score the whole assessment)
// ---------------------------------------------------------------------------

export interface SubmitInput extends DraftInput {
  answers: Record<string, number>;
}

export interface SubmitResult {
  statusToken: string;
  qualified: boolean;
  message: string;
  category: PublicSubmission["final_category"];
}

export async function submitStandalone(
  input: SubmitInput
): Promise<SubmitResult> {
  const email = input.email.trim().toLowerCase();
  const account = await accountFor(
    email,
    input.firstName,
    input.lastName,
    input.phone ?? null
  );

  const existing = await findSubmissionByUser(account.id);
  if (existing && existing.status !== "draft") {
    throw ApiError.conflict(
      "This email has already completed the survey. You can check your status instead."
    );
  }

  const { answers, score, category } = await scoreSurvey(input.answers);
  const qualified = category !== "not_qualified";
  const statusToken =
    existing?.status_token ?? crypto.randomBytes(24).toString("hex");

  const detailFields = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    farmName: input.farmName?.trim() || null,
    referralSource: input.referralSource?.trim() || null,
    state: input.state?.trim() || null,
    totalAcres: input.totalAcres ?? null,
  };

  // Ensure a row exists (reuse the draft, or create one), then score it.
  let submissionId = existing?.id ?? null;
  if (!submissionId) {
    const draft = await upsertDraft(null, account.id, statusToken, {
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

  // The client says: no step emails. The producer sees the result on screen and
  // tracks by email; only the contract and enrollment emails are sent later.
  broadcastToAdmins("eligibility", { submissionId });
  void notifyOrgManagers({
    type: "survey_submitted",
    title: "New survey submission",
    body: `${fullName(input.firstName, input.lastName)} completed the eligibility survey via the survey link (${qualified ? "qualified" : "not qualified"}).`,
    data: { submissionId },
  });

  return {
    statusToken,
    qualified,
    message: qualified ? QUALIFIED_MESSAGE : NOT_QUALIFIED_MESSAGE,
    category,
  };
}

// ---------------------------------------------------------------------------
// Status page (by magic-link token)
// ---------------------------------------------------------------------------

export interface StandaloneStatus {
  fullName: string;
  email: string;
  state: string | null;
  totalAcres: string | null;
  status: PublicSubmission["status"];
  category: PublicSubmission["final_category"];
  score: number;
  message: string;
  contractToken: string | null;
  contractSignedAt: Date | null;
  appLink: string;
}

export async function getStandaloneStatus(
  token: string
): Promise<StandaloneStatus> {
  const submission = await findSubmissionByStatusToken(token);
  if (!submission) throw ApiError.notFound("This status link is not valid.");

  const contract = await findLatestContract(submission.id);
  const contractToken = contract && !contract.signed_at ? contract.token : null;

  return {
    fullName: submission.full_name,
    email: submission.email,
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

/** Look up a status token by email (to track without the emailed link). */
export async function statusTokenForEmail(rawEmail: string): Promise<string> {
  const email = rawEmail.trim().toLowerCase();
  const account = await findWebsiteUserByEmailPublic(email);
  const notFound = ApiError.notFound(
    "We could not find a survey for that email. Please check it and try again."
  );
  if (!account) throw notFound;

  const submission = await findSubmissionByUser(account.id);
  if (!submission) throw notFound;
  if (submission.status === "draft") throw notFound;

  if (submission.status_token) return submission.status_token;
  const token = crypto.randomBytes(24).toString("hex");
  await setSubmissionStatusToken(submission.id, token);
  return token;
}

export type { PublicContract };
