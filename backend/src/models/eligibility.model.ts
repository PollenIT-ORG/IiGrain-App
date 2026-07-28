import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import type { SurveyCategory } from "./survey.model.js";

// Survey submissions and the contract sent for each one.

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "not_qualified"
  | "qualified"
  | "contract_sent"
  | "contract_signed"
  | "enrolled";

export interface StoredAnswer {
  questionId: string;
  // 0-3 on the assessment scale.
  answer: number;
  score: number;
}

export type SubmissionChannel = "website" | "standalone";

export interface PublicSubmission {
  id: string;
  website_user_id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  farm_name: string | null;
  referral_source: string | null;
  email: string;
  phone: string | null;
  state: string | null;
  total_acres: string | null;
  answers: StoredAnswer[];
  score: number;
  auto_category: SurveyCategory;
  final_category: SurveyCategory;
  status: SubmissionStatus;
  channel: SubmissionChannel;
  status_token: string | null;
  enrollment_id: string | null;
  reviewed_at: Date | null;
  created_at: Date;
}

type Row = Prisma.eligibility_submissionsGetPayload<{
  include: { website_user: true };
}>;

function toPublic(r: Row): PublicSubmission {
  return {
    id: r.id,
    website_user_id: r.website_user_id,
    full_name: r.website_user.full_name,
    first_name: r.first_name,
    last_name: r.last_name,
    farm_name: r.farm_name,
    referral_source: r.referral_source,
    email: r.website_user.email,
    phone: r.website_user.phone,
    state: r.state,
    total_acres: r.total_acres != null ? r.total_acres.toString() : null,
    answers: (r.answers as unknown as StoredAnswer[]) ?? [],
    score: r.score,
    auto_category: r.auto_category as SurveyCategory,
    final_category: r.final_category as SurveyCategory,
    status: r.status as SubmissionStatus,
    channel: r.channel as SubmissionChannel,
    status_token: r.status_token,
    enrollment_id: r.enrollment_id,
    reviewed_at: r.reviewed_at,
    created_at: r.created_at,
  };
}

export interface CreateSubmissionParams {
  websiteUserId: string;
  state: string;
  totalAcres: number;
  answers: StoredAnswer[];
  score: number;
  category: SurveyCategory;
  status: SubmissionStatus;
  channel?: SubmissionChannel;
  statusToken?: string | null;
}

export async function createSubmission(
  p: CreateSubmissionParams
): Promise<PublicSubmission> {
  const row = await prisma.eligibility_submissions.create({
    data: {
      website_user_id: p.websiteUserId,
      state: p.state,
      total_acres: p.totalAcres,
      answers: p.answers as unknown as Prisma.InputJsonValue,
      score: p.score,
      auto_category: p.category,
      final_category: p.category,
      status: p.status,
      channel: p.channel ?? "website",
      status_token: p.statusToken ?? null,
    },
    include: { website_user: true },
  });
  return toPublic(row);
}

// ---------------------------------------------------------------------------
// Draft (save & resume) support for the standalone survey
// ---------------------------------------------------------------------------

export interface DraftFields {
  firstName: string | null;
  lastName: string | null;
  farmName: string | null;
  referralSource: string | null;
  state: string | null;
  totalAcres: number | null;
  answers: StoredAnswer[];
}

/** Creates the draft if none exists for this account, else updates it. */
export async function upsertDraft(
  existingId: string | null,
  websiteUserId: string,
  statusToken: string,
  f: DraftFields
): Promise<PublicSubmission> {
  const shared = {
    first_name: f.firstName,
    last_name: f.lastName,
    farm_name: f.farmName,
    referral_source: f.referralSource,
    state: f.state,
    total_acres: f.totalAcres,
    answers: f.answers as unknown as Prisma.InputJsonValue,
    updated_at: new Date(),
  };
  if (existingId) {
    await prisma.eligibility_submissions.updateMany({
      where: { id: existingId, deleted_at: null },
      data: shared,
    });
    return (await findSubmissionById(existingId)) as PublicSubmission;
  }
  const row = await prisma.eligibility_submissions.create({
    data: {
      website_user_id: websiteUserId,
      ...shared,
      score: 0,
      auto_category: "not_qualified",
      final_category: "not_qualified",
      status: "draft",
      channel: "standalone",
      status_token: statusToken,
    },
    include: { website_user: true },
  });
  return toPublic(row);
}

/** Scores the draft into a final submission. */
export async function finalizeSubmission(
  id: string,
  p: {
    answers: StoredAnswer[];
    score: number;
    category: SurveyCategory;
    status: SubmissionStatus;
  } & DraftFields
): Promise<PublicSubmission | null> {
  const { count } = await prisma.eligibility_submissions.updateMany({
    where: { id, deleted_at: null },
    data: {
      first_name: p.firstName,
      last_name: p.lastName,
      farm_name: p.farmName,
      referral_source: p.referralSource,
      state: p.state,
      total_acres: p.totalAcres,
      answers: p.answers as unknown as Prisma.InputJsonValue,
      score: p.score,
      auto_category: p.category,
      final_category: p.category,
      status: p.status,
      updated_at: new Date(),
    },
  });
  if (!count) return null;
  return findSubmissionById(id);
}

export async function findSubmissionByStatusToken(
  token: string
): Promise<PublicSubmission | null> {
  const row = await prisma.eligibility_submissions.findFirst({
    where: { status_token: token, deleted_at: null },
    include: { website_user: true },
  });
  return row ? toPublic(row) : null;
}

export async function findSubmissionByUser(
  websiteUserId: string
): Promise<PublicSubmission | null> {
  const row = await prisma.eligibility_submissions.findFirst({
    where: { website_user_id: websiteUserId, deleted_at: null },
    include: { website_user: true },
  });
  return row ? toPublic(row) : null;
}

export async function findSubmissionById(
  id: string
): Promise<PublicSubmission | null> {
  const row = await prisma.eligibility_submissions.findFirst({
    where: { id, deleted_at: null },
    include: { website_user: true },
  });
  return row ? toPublic(row) : null;
}

export interface ListSubmissionsFilters {
  status?: SubmissionStatus;
  category?: SurveyCategory;
  channel?: SubmissionChannel;
  search?: string;
  limit: number;
  offset: number;
}

export async function listSubmissions(
  f: ListSubmissionsFilters
): Promise<{ rows: PublicSubmission[]; total: number }> {
  const where: Prisma.eligibility_submissionsWhereInput = {
    deleted_at: null,
    ...(f.status ? { status: f.status } : {}),
    ...(f.category ? { final_category: f.category } : {}),
    ...(f.channel ? { channel: f.channel } : {}),
    ...(f.search
      ? {
          website_user: {
            OR: [
              { full_name: { contains: f.search, mode: "insensitive" } },
              { email: { contains: f.search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.eligibility_submissions.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: f.limit,
      skip: f.offset,
      include: { website_user: true },
    }),
    prisma.eligibility_submissions.count({ where }),
  ]);
  return { rows: rows.map(toPublic), total };
}

export async function updateSubmission(
  id: string,
  data: Partial<{
    final_category: SurveyCategory;
    status: SubmissionStatus;
    reviewed_by: string | null;
    reviewed_at: Date;
    enrollment_id: string;
  }>
): Promise<PublicSubmission | null> {
  const { count } = await prisma.eligibility_submissions.updateMany({
    where: { id, deleted_at: null },
    data: { ...data, updated_at: new Date() },
  });
  if (!count) return null;
  return findSubmissionById(id);
}

export async function setSubmissionStatusToken(
  id: string,
  token: string
): Promise<void> {
  await prisma.eligibility_submissions.updateMany({
    where: { id, deleted_at: null },
    data: { status_token: token, updated_at: new Date() },
  });
}

export async function softDeleteSubmission(id: string): Promise<boolean> {
  const { count } = await prisma.eligibility_submissions.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
  return count > 0;
}

export async function countByStatus(): Promise<Record<string, number>> {
  const rows = await prisma.eligibility_submissions.groupBy({
    by: ["status"],
    where: { deleted_at: null },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = r._count._all;
  return out;
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export interface PublicContract {
  id: string;
  submission_id: string;
  token: string;
  token_expires_at: Date;
  signed_name: string | null;
  signature_url: string | null;
  signed_at: Date | null;
  signer_ip: string | null;
  accepted_at: Date | null;
  created_at: Date;
}

const C_SELECT = {
  id: true,
  submission_id: true,
  token: true,
  token_expires_at: true,
  signed_name: true,
  signature_url: true,
  signed_at: true,
  signer_ip: true,
  accepted_at: true,
  created_at: true,
};

export async function createContract(p: {
  submissionId: string;
  token: string;
  expiresAt: Date;
}): Promise<PublicContract> {
  return prisma.contracts.create({
    data: {
      submission_id: p.submissionId,
      token: p.token,
      token_expires_at: p.expiresAt,
    },
    select: C_SELECT,
  });
}

export async function findContractByToken(
  token: string
): Promise<PublicContract | null> {
  return prisma.contracts.findFirst({ where: { token }, select: C_SELECT });
}

/** The most recent contract for a submission. */
export async function findLatestContract(
  submissionId: string
): Promise<PublicContract | null> {
  return prisma.contracts.findFirst({
    where: { submission_id: submissionId },
    orderBy: { created_at: "desc" },
    select: C_SELECT,
  });
}

export async function signContract(
  id: string,
  p: {
    signedName: string;
    signatureUrl: string | null;
    ip: string | null;
    userAgent: string | null;
  }
): Promise<PublicContract | null> {
  const { count } = await prisma.contracts.updateMany({
    // Only an unsigned contract can be signed, so a replayed link is a no-op.
    where: { id, signed_at: null },
    data: {
      signed_name: p.signedName,
      signature_url: p.signatureUrl,
      signed_at: new Date(),
      signer_ip: p.ip,
      signer_user_agent: p.userAgent,
      updated_at: new Date(),
    },
  });
  if (!count) return null;
  return prisma.contracts.findFirst({ where: { id }, select: C_SELECT });
}

export async function acceptContract(
  id: string,
  adminId: string
): Promise<boolean> {
  const { count } = await prisma.contracts.updateMany({
    where: { id, accepted_at: null },
    data: { accepted_by: adminId, accepted_at: new Date(), updated_at: new Date() },
  });
  return count > 0;
}

export async function enrollmentIdExists(value: string): Promise<boolean> {
  const found = await prisma.eligibility_submissions.findFirst({
    where: { enrollment_id: value },
    select: { id: true },
  });
  return found !== null;
}
