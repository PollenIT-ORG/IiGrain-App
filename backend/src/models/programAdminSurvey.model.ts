import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import type { SurveyCategory } from "./programAdminSurveyTemplate.model.js";

// Program Admin Survey - the programs (a program + its attached survey/link),
// their submissions, and the contract sent for each. Mirrors eligibility.model.ts
// but every program is owned by a program administrator (data scoping) and every
// submission belongs to one program's survey.

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "not_qualified"
  | "qualified"
  | "contract_sent"
  | "contract_signed"
  | "enrolled"
  | "withdrawn";

export interface StoredAnswer {
  questionId: string;
  answer: number;
  score: number;
}

// ---------------------------------------------------------------------------
// Surveys (a program with its attached survey + shareable link)
// ---------------------------------------------------------------------------

export interface PublicSurvey {
  id: string;
  owner_id: string;
  // The program this survey is attached to (from the Programs module).
  program_id: string | null;
  name: string;
  description: string | null;
  template_id: string;
  template_name: string;
  contract_template_id: string | null;
  contract_template_name: string | null;
  token: string;
  is_active: boolean;
  // Set once the survey is locked; farmers can start the assessment from then on.
  locked_at: Date | null;
  created_at: Date;
  submission_count?: number;
}

type SurveyRow = Prisma.program_admin_surveysGetPayload<{
  include: {
    template: { select: { name: true } };
    contract_template: { select: { name: true } };
    program: { select: { name: true } };
  };
}>;

function toPublicSurvey(r: SurveyRow, submissionCount?: number): PublicSurvey {
  return {
    id: r.id,
    owner_id: r.owner_id,
    program_id: r.program_id,
    // A linked program owns the name; legacy rows keep their own.
    name: r.program?.name ?? r.name ?? r.template.name,
    description: r.description,
    template_id: r.template_id,
    template_name: r.template.name,
    contract_template_id: r.contract_template_id,
    contract_template_name: r.contract_template?.name ?? null,
    token: r.token,
    is_active: r.is_active,
    locked_at: r.locked_at,
    created_at: r.created_at,
    submission_count: submissionCount,
  };
}

const SURVEY_INCLUDE = {
  template: { select: { name: true } },
  contract_template: { select: { name: true } },
  program: { select: { name: true } },
} as const;

export async function createSurvey(p: {
  ownerId: string;
  programId: string | null;
  name: string | null;
  description: string | null;
  templateId: string;
  contractTemplateId: string | null;
  token: string;
}): Promise<PublicSurvey> {
  const row = await prisma.program_admin_surveys.create({
    data: {
      owner_id: p.ownerId,
      program_id: p.programId,
      name: p.name,
      description: p.description,
      template_id: p.templateId,
      contract_template_id: p.contractTemplateId,
      token: p.token,
    },
    include: SURVEY_INCLUDE,
  });
  return toPublicSurvey(row);
}

/** The survey link attached to a program, if it has one. */
export async function findSurveyByProgram(
  programId: string
): Promise<PublicSurvey | null> {
  const row = await prisma.program_admin_surveys.findFirst({
    where: { program_id: programId, deleted_at: null },
    include: SURVEY_INCLUDE,
  });
  return row ? toPublicSurvey(row) : null;
}

/** The survey link that uses this template, if any (one program per survey). */
export async function findSurveyByTemplate(
  templateId: string
): Promise<PublicSurvey | null> {
  const row = await prisma.program_admin_surveys.findFirst({
    where: { template_id: templateId, deleted_at: null },
    include: SURVEY_INCLUDE,
  });
  return row ? toPublicSurvey(row) : null;
}

/** Surveys owned by a program admin (or all, when ownerId is null = admin). */
export async function listSurveys(
  ownerId: string | null
): Promise<PublicSurvey[]> {
  const rows = await prisma.program_admin_surveys.findMany({
    where: { deleted_at: null, ...(ownerId ? { owner_id: ownerId } : {}) },
    orderBy: { created_at: "desc" },
    include: {
      ...SURVEY_INCLUDE,
      _count: { select: { submissions: { where: { deleted_at: null } } } },
    },
  });
  return rows.map((r) => toPublicSurvey(r, r._count.submissions));
}

export async function findSurveyById(id: string): Promise<PublicSurvey | null> {
  const row = await prisma.program_admin_surveys.findFirst({
    where: { id, deleted_at: null },
    include: SURVEY_INCLUDE,
  });
  return row ? toPublicSurvey(row) : null;
}

export async function findSurveyByToken(
  token: string
): Promise<PublicSurvey | null> {
  const row = await prisma.program_admin_surveys.findFirst({
    where: { token, deleted_at: null, is_active: true },
    include: SURVEY_INCLUDE,
  });
  return row ? toPublicSurvey(row) : null;
}

export async function updateSurvey(
  id: string,
  p: {
    programId?: string | null;
    name?: string;
    description?: string | null;
    templateId?: string;
    contractTemplateId?: string | null;
    isActive?: boolean;
    ownerId?: string;
  }
): Promise<PublicSurvey | null> {
  const data: Record<string, unknown> = { updated_at: new Date() };
  if (p.programId !== undefined) data.program_id = p.programId;
  if (p.ownerId !== undefined) data.owner_id = p.ownerId;
  if (p.name !== undefined) data.name = p.name;
  if (p.description !== undefined) data.description = p.description;
  if (p.templateId !== undefined) data.template_id = p.templateId;
  if (p.contractTemplateId !== undefined)
    data.contract_template_id = p.contractTemplateId;
  if (p.isActive !== undefined) data.is_active = p.isActive;
  const { count } = await prisma.program_admin_surveys.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  if (!count) return null;
  return findSurveyById(id);
}

/** Locks the survey, which freezes its questions and opens the assessment, or unlocks it again. */
export async function setSurveyLock(
  id: string,
  lockedBy: string | null
): Promise<PublicSurvey | null> {
  const { count } = await prisma.program_admin_surveys.updateMany({
    where: { id, deleted_at: null },
    data: {
      locked_at: lockedBy ? new Date() : null,
      locked_by: lockedBy,
      updated_at: new Date(),
    },
  });
  if (!count) return null;
  return findSurveyById(id);
}

/** True while a locked survey uses this survey template, so its questions must stay as they are. */
export async function lockedSurveyUsesTemplate(templateId: string): Promise<boolean> {
  const row = await prisma.program_admin_surveys.findFirst({
    where: { template_id: templateId, deleted_at: null, locked_at: { not: null } },
    select: { id: true },
  });
  return row !== null;
}

export async function softDeleteSurvey(id: string): Promise<boolean> {
  const { count } = await prisma.program_admin_surveys.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
  return count > 0;
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export interface PublicSubmission {
  id: string;
  survey_id: string;
  survey_name: string;
  template_id: string;
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
  status_token: string | null;
  override_reason: string | null;
  enrollment_id: string | null;
  reviewed_at: Date | null;
  created_at: Date;
}

type SubRow = Prisma.program_admin_survey_submissionsGetPayload<{
  include: {
    website_user: true;
    survey: {
      select: {
        name: true;
        owner_id: true;
        template_id: true;
        program: { select: { name: true } };
        template: { select: { name: true } };
      };
    };
  };
}>;

function toPublic(r: SubRow): PublicSubmission {
  return {
    id: r.id,
    survey_id: r.survey_id,
    // The linked program names the survey; legacy rows fall back to their own.
    survey_name:
      r.survey.program?.name ?? r.survey.name ?? r.survey.template.name,
    template_id: r.survey.template_id,
    website_user_id: r.website_user_id,
    full_name: r.website_user.full_name,
    first_name: r.first_name,
    last_name: r.last_name,
    farm_name: r.farm_name,
    referral_source: r.referral_source,
    email: r.website_user.email,
    phone: r.phone,
    state: r.state,
    total_acres: r.total_acres != null ? r.total_acres.toString() : null,
    answers: (r.answers as unknown as StoredAnswer[]) ?? [],
    score: r.score,
    auto_category: r.auto_category as SurveyCategory,
    final_category: r.final_category as SurveyCategory,
    status: r.status as SubmissionStatus,
    status_token: r.status_token,
    override_reason: r.override_reason,
    enrollment_id: r.enrollment_id,
    reviewed_at: r.reviewed_at,
    created_at: r.created_at,
  };
}

const SUB_INCLUDE = {
  website_user: true,
  survey: {
    select: {
      name: true,
      owner_id: true,
      template_id: true,
      program: { select: { name: true } },
      template: { select: { name: true } },
    },
  },
} as const;

export interface DraftFields {
  firstName: string | null;
  lastName: string | null;
  /** The phone given for this submission, which may be left blank. */
  phone: string | null;
  farmName: string | null;
  referralSource: string | null;
  state: string | null;
  totalAcres: number | null;
  answers: StoredAnswer[];
}

/** Creates the draft for (survey, user) if none exists, else updates it. */
export async function upsertDraft(
  existingId: string | null,
  surveyId: string,
  websiteUserId: string,
  statusToken: string,
  f: DraftFields
): Promise<PublicSubmission> {
  const shared = {
    first_name: f.firstName,
    last_name: f.lastName,
    phone: f.phone,
    farm_name: f.farmName,
    referral_source: f.referralSource,
    state: f.state,
    total_acres: f.totalAcres,
    answers: f.answers as unknown as Prisma.InputJsonValue,
    updated_at: new Date(),
  };
  if (existingId) {
    await prisma.program_admin_survey_submissions.updateMany({
      where: { id: existingId, deleted_at: null },
      data: shared,
    });
    return (await findSubmissionById(existingId)) as PublicSubmission;
  }
  const row = await prisma.program_admin_survey_submissions.create({
    data: {
      survey_id: surveyId,
      website_user_id: websiteUserId,
      ...shared,
      score: 0,
      auto_category: "not_qualified",
      final_category: "not_qualified",
      status: "draft",
      status_token: statusToken,
    },
    include: SUB_INCLUDE,
  });
  return toPublic(row);
}

export async function finalizeSubmission(
  id: string,
  p: {
    answers: StoredAnswer[];
    score: number;
    category: SurveyCategory;
    status: SubmissionStatus;
  } & DraftFields
): Promise<PublicSubmission | null> {
  const { count } = await prisma.program_admin_survey_submissions.updateMany({
    where: { id, deleted_at: null },
    data: {
      first_name: p.firstName,
      last_name: p.lastName,
      phone: p.phone,
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

export async function findSubmissionById(
  id: string
): Promise<PublicSubmission | null> {
  const row = await prisma.program_admin_survey_submissions.findFirst({
    where: { id, deleted_at: null },
    include: SUB_INCLUDE,
  });
  return row ? toPublic(row) : null;
}

export async function findSubmissionByStatusToken(
  token: string
): Promise<PublicSubmission | null> {
  const row = await prisma.program_admin_survey_submissions.findFirst({
    where: { status_token: token, deleted_at: null },
    include: SUB_INCLUDE,
  });
  return row ? toPublic(row) : null;
}

/** The one submission a user has for a given program's survey, if any. */
export async function findSubmissionBySurveyAndUser(
  surveyId: string,
  websiteUserId: string
): Promise<PublicSubmission | null> {
  const row = await prisma.program_admin_survey_submissions.findFirst({
    where: { survey_id: surveyId, website_user_id: websiteUserId, deleted_at: null },
    include: SUB_INCLUDE,
  });
  return row ? toPublic(row) : null;
}

export interface ListSubmissionsFilters {
  ownerId: string | null;
  /**
   * The program the submission came in for, not the survey link it came
   * through. A program's survey can be changed or removed, and each change
   * leaves a new link behind; filtering on the program keeps everything that
   * program ever received together.
   */
  programId?: string;
  statuses?: SubmissionStatus[];
  category?: SurveyCategory;
  referral?: string;
  createdFrom?: Date;
  createdTo?: Date;
  search?: string;
  limit: number;
  offset: number;
}

/**
 * The table and the cards above it stand over the same rows, so the clause is
 * built once and both ask for it. Status is the one filter they do not share:
 * it narrows the list, but narrowing the counts by one status would empty the
 * other five cards.
 */
export type SubmissionFilters = Omit<ListSubmissionsFilters, "limit" | "offset">;

function submissionWhere(
  f: SubmissionFilters
): Prisma.program_admin_survey_submissionsWhereInput {
  const createdAt =
    f.createdFrom || f.createdTo
      ? {
          created_at: {
            ...(f.createdFrom ? { gte: f.createdFrom } : {}),
            ...(f.createdTo ? { lte: f.createdTo } : {}),
          },
        }
      : {};
  // Both of these narrow through the survey link, so they are built together -
  // as two separate spreads the second would replace the first. The link is
  // matched whether or not it has since been removed, so a program that
  // changed its survey keeps its earlier submissions.
  const survey = {
    // Scope to the program admin's own programs (null owner = platform admin).
    ...(f.ownerId ? { owner_id: f.ownerId } : {}),
    ...(f.programId ? { program_id: f.programId } : {}),
  };
  return {
    deleted_at: null,
    ...(Object.keys(survey).length ? { survey } : {}),
    ...(f.statuses && f.statuses.length ? { status: { in: f.statuses } } : {}),
    ...(f.category ? { final_category: f.category } : {}),
    ...(f.referral ? { referral_source: f.referral } : {}),
    ...createdAt,
    ...(f.search
      ? {
          OR: [
            { farm_name: { contains: f.search, mode: "insensitive" } },
            {
              website_user: {
                OR: [
                  { full_name: { contains: f.search, mode: "insensitive" } },
                  { email: { contains: f.search, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : {}),
  };
}

export async function listSubmissions(
  f: ListSubmissionsFilters
): Promise<{ rows: PublicSubmission[]; total: number }> {
  const where = submissionWhere(f);

  const [rows, total] = await Promise.all([
    prisma.program_admin_survey_submissions.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: f.limit,
      skip: f.offset,
      include: SUB_INCLUDE,
    }),
    prisma.program_admin_survey_submissions.count({ where }),
  ]);
  return { rows: rows.map(toPublic), total };
}

export async function updateSubmission(
  id: string,
  data: Partial<{
    final_category: SurveyCategory;
    status: SubmissionStatus;
    override_reason: string | null;
    reviewed_by: string | null;
    reviewed_at: Date;
    enrollment_id: string;
  }>
): Promise<PublicSubmission | null> {
  const { count } = await prisma.program_admin_survey_submissions.updateMany({
    where: { id, deleted_at: null },
    data: { ...data, updated_at: new Date() },
  });
  if (!count) return null;
  return findSubmissionById(id);
}

export async function softDeleteSubmission(id: string): Promise<boolean> {
  const { count } = await prisma.program_admin_survey_submissions.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
  return count > 0;
}

/** The rows the list would return, counted by status for the cards above it. */
export async function countByStatus(
  f: Omit<SubmissionFilters, "statuses">
): Promise<Record<string, number>> {
  const rows = await prisma.program_admin_survey_submissions.groupBy({
    by: ["status"],
    where: submissionWhere(f),
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = r._count._all;
  return out;
}

/** The details a returning farmer already gave, newest submission first. */
export interface KnownProfile {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  farmName: string | null;
  referralSource: string | null;
  state: string | null;
  totalAcres: string | null;
}

export async function latestProfileForEmail(
  email: string
): Promise<KnownProfile | null> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      first_name: string | null;
      last_name: string | null;
      phone: string | null;
      farm_name: string | null;
      referral_source: string | null;
      state: string | null;
      total_acres: unknown;
    }>
  >(
    `
    SELECT s.first_name, s.last_name, COALESCE(s.phone, wu.phone) AS phone,
           s.farm_name, s.referral_source, s.state, s.total_acres
      FROM program_admin_survey_submissions s
      JOIN website_users wu ON wu.id = s.website_user_id
     WHERE s.deleted_at IS NULL AND lower(wu.email) = $1
     ORDER BY s.created_at DESC
     LIMIT 1
    `,
    email.trim().toLowerCase()
  );

  const row = rows[0];
  if (!row) return null;
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    farmName: row.farm_name,
    referralSource: row.referral_source,
    state: row.state,
    totalAcres: row.total_acres === null ? null : String(row.total_acres),
  };
}

export async function enrollmentIdExists(value: string): Promise<boolean> {
  const found = await prisma.program_admin_survey_submissions.findFirst({
    where: { enrollment_id: value },
    select: { id: true },
  });
  return found !== null;
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
  // The signed copy: the contract plus a signature page.
  signed_pdf_url: string | null;
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
  signed_pdf_url: true,
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
  return prisma.program_admin_survey_contracts.create({
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
  return prisma.program_admin_survey_contracts.findFirst({
    where: { token },
    select: C_SELECT,
  });
}

export async function findLatestContract(
  submissionId: string
): Promise<PublicContract | null> {
  return prisma.program_admin_survey_contracts.findFirst({
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
  const { count } = await prisma.program_admin_survey_contracts.updateMany({
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
  return prisma.program_admin_survey_contracts.findFirst({
    where: { id },
    select: C_SELECT,
  });
}

/** Stores the generated signed copy against a contract. */
export async function setSignedPdfUrl(id: string, url: string): Promise<void> {
  await prisma.program_admin_survey_contracts.updateMany({
    where: { id },
    data: { signed_pdf_url: url, updated_at: new Date() },
  });
}

export async function acceptContract(
  id: string,
  adminId: string
): Promise<boolean> {
  const { count } = await prisma.program_admin_survey_contracts.updateMany({
    where: { id, accepted_at: null },
    data: {
      accepted_by: adminId,
      accepted_at: new Date(),
      updated_at: new Date(),
    },
  });
  return count > 0;
}
