import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";

type Db = Prisma.TransactionClient | typeof prisma;

export interface PublicAssessmentTemplate {
  id: string;
  owner_id: string | null;
  is_global: boolean;
  program_id: string | null;
  program_name: string | null;
  copied_from_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  category_count: number;
  question_count: number;
  active_question_count: number;
  linked_program_count: number;
  // What the template was set up to hold, and what it actually holds right now.
  question_kind: "mcq" | "input" | null;
  kind: "mcq" | "input" | "mixed" | null;
  // True once an assessment was submitted in a program using it, or an admin locked it by hand.
  locked: boolean;
  has_submissions: boolean;
  locked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const SUBMITTED_EXISTS = Prisma.sql`EXISTS (SELECT 1 FROM field_assessments fa
            JOIN programs pr ON pr.id = fa.program_id
           WHERE pr.assessment_template_id = t.id AND fa.status = 'submitted')`;

// A template counts as locked once an admin locks it, or any program using it has a submitted assessment.
const TEMPLATE_COLUMNS = Prisma.sql`
  t.id, t.owner_id, t.is_global, t.program_id, p.name AS program_name, t.copied_from_id,
  t.name, t.description, t.is_active, t.created_by, t.locked_at, t.created_at, t.updated_at,
  t.question_kind,
  COALESCE(t.question_kind, (
    SELECT CASE WHEN COUNT(*) = 0 THEN NULL
                WHEN COUNT(*) FILTER (WHERE q.question_type = 'text') = 0 THEN 'mcq'
                WHEN COUNT(*) FILTER (WHERE q.question_type <> 'text') = 0 THEN 'input'
                ELSE 'mixed' END
      FROM assessment_questions q
      JOIN assessment_categories c ON c.id = q.category_id AND c.deleted_at IS NULL
     WHERE c.template_id = t.id AND q.deleted_at IS NULL)) AS kind,
  (SELECT COUNT(*)::int FROM assessment_categories c
    WHERE c.template_id = t.id AND c.deleted_at IS NULL) AS category_count,
  (SELECT COUNT(*)::int FROM assessment_questions q
     JOIN assessment_categories c ON c.id = q.category_id
    WHERE c.template_id = t.id AND c.deleted_at IS NULL AND q.deleted_at IS NULL) AS question_count,
  (SELECT COUNT(*)::int FROM assessment_questions q
     JOIN assessment_categories c ON c.id = q.category_id
    WHERE c.template_id = t.id AND c.deleted_at IS NULL AND c.is_active = true
      AND q.deleted_at IS NULL AND q.is_active = true) AS active_question_count,
  (SELECT COUNT(*)::int FROM programs pr
    WHERE pr.assessment_template_id = t.id AND pr.deleted_at IS NULL) AS linked_program_count,
  ${SUBMITTED_EXISTS} AS has_submissions,
  (t.locked_at IS NOT NULL OR ${SUBMITTED_EXISTS}) AS locked`;

export async function findTemplateById(
  id: string,
  db: Db = prisma
): Promise<PublicAssessmentTemplate | null> {
  const rows = await db.$queryRaw<PublicAssessmentTemplate[]>(Prisma.sql`
    SELECT ${TEMPLATE_COLUMNS}
      FROM assessment_templates t
      LEFT JOIN programs p ON p.id = t.program_id
     WHERE t.id = ${id}::uuid AND t.deleted_at IS NULL
     LIMIT 1;`);
  return rows[0] ?? null;
}

// A template's kind as programs read it: the one it was given, else multiple
// choice unless it holds a field that is not a scored or multiple choice question.
const kindOf = (alias: string) => {
  const t = Prisma.raw(alias);
  return Prisma.sql`COALESCE(${t}.question_kind, CASE WHEN EXISTS (
    SELECT 1
      FROM assessment_questions q
      JOIN assessment_categories c ON c.id = q.category_id AND c.deleted_at IS NULL
     WHERE c.template_id = ${t}.id AND q.deleted_at IS NULL
       AND q.question_type NOT IN ('scored', 'mcq')) THEN 'input' ELSE 'mcq' END)`;
};

/** The Global template of one kind: multiple choice and input based each have their own. */
export async function findGlobalTemplate(
  kind: "mcq" | "input" = "mcq"
): Promise<PublicAssessmentTemplate | null> {
  const rows = await prisma.$queryRaw<PublicAssessmentTemplate[]>(Prisma.sql`
    SELECT ${TEMPLATE_COLUMNS}
      FROM assessment_templates t
      LEFT JOIN programs p ON p.id = t.program_id
     WHERE t.is_global = true AND t.deleted_at IS NULL
       AND ${kindOf("t")} = ${kind}
     ORDER BY t.updated_at DESC
     LIMIT 1;`);
  return rows[0] ?? null;
}

export interface TemplateListFilter {
  // Matches the template name or the name of the program it belongs to.
  search?: string;
  kind?: "mcq" | "input";
  limit?: number;
  offset?: number;
}

// Every assessment an actor may see: templates, and each live program's own assessment.
function templateListWhere(ownerId: string | null, filter: TemplateListFilter): Prisma.Sql {
  const scope = ownerId
    ? Prisma.sql`AND (t.is_global = true OR t.owner_id = ${ownerId}::uuid OR EXISTS (
        SELECT 1 FROM programs pr
         WHERE pr.assessment_template_id = t.id AND pr.created_by = ${ownerId}::uuid AND pr.deleted_at IS NULL))`
    : Prisma.empty;
  const search = filter.search?.trim()
    ? Prisma.sql`AND (t.name ILIKE ${`%${filter.search.trim()}%`} OR p.name ILIKE ${`%${filter.search.trim()}%`})`
    : Prisma.empty;
  const kind = filter.kind ? Prisma.sql`AND ${kindOf("t")} = ${filter.kind}` : Prisma.empty;
  return Prisma.sql`
     WHERE t.deleted_at IS NULL
       AND (t.program_id IS NULL OR p.deleted_at IS NULL)
       ${scope} ${search} ${kind}`;
}

const TEMPLATE_ORDER = Prisma.sql`
     ORDER BY t.is_global DESC,
              -- Between the two Global templates, multiple choice comes first.
              CASE WHEN t.is_global THEN ${kindOf("t")} END DESC NULLS LAST,
              t.created_at DESC`;

/** Platform roles pass null and see everything; anyone else sees Global, their own and their programs' assessments. */
export async function listTemplates(ownerId: string | null): Promise<PublicAssessmentTemplate[]> {
  return prisma.$queryRaw<PublicAssessmentTemplate[]>(Prisma.sql`
    SELECT ${TEMPLATE_COLUMNS}
      FROM assessment_templates t
      LEFT JOIN programs p ON p.id = t.program_id
    ${templateListWhere(ownerId, {})}
    ${TEMPLATE_ORDER};`);
}

/** One page of the same list, searched and narrowed to a kind, with how many there are in all. */
export async function listTemplatesPage(
  ownerId: string | null,
  filter: TemplateListFilter
): Promise<{ rows: PublicAssessmentTemplate[]; total: number }> {
  const where = templateListWhere(ownerId, filter);
  const [rows, count] = await Promise.all([
    prisma.$queryRaw<PublicAssessmentTemplate[]>(Prisma.sql`
      SELECT ${TEMPLATE_COLUMNS}
        FROM assessment_templates t
        LEFT JOIN programs p ON p.id = t.program_id
      ${where}
      ${TEMPLATE_ORDER}
       LIMIT ${filter.limit ?? 20} OFFSET ${filter.offset ?? 0};`),
    prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
        FROM assessment_templates t
        LEFT JOIN programs p ON p.id = t.program_id
      ${where};`),
  ]);
  return { rows, total: count[0]?.total ?? 0 };
}

export async function templateNameTaken(
  ownerId: string | null,
  name: string,
  excludeId?: string
): Promise<boolean> {
  // Program assessments are listed next to the templates, so they share the names.
  const found = await prisma.assessment_templates.findFirst({
    where: {
      owner_id: ownerId,
      deleted_at: null,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return found !== null;
}

export interface CreateTemplateRowInput {
  ownerId: string | null;
  programId: string | null;
  copiedFromId: string | null;
  name: string;
  description: string | null;
  // What the template holds, when it is chosen up front for a blank one.
  questionKind?: "mcq" | "input" | null;
  createdBy: string;
}

export async function createTemplateRow(db: Db, input: CreateTemplateRowInput): Promise<string> {
  const row = await db.assessment_templates.create({
    data: {
      owner_id: input.ownerId,
      program_id: input.programId,
      copied_from_id: input.copiedFromId,
      name: input.name,
      description: input.description,
      question_kind: input.questionKind ?? null,
      created_by: input.createdBy,
    },
    select: { id: true },
  });
  return row.id;
}

/** Copies the live categories and their live questions under new ids. */
export async function copyTemplateContents(db: Db, sourceId: string, targetId: string): Promise<void> {
  const categories = await db.assessment_categories.findMany({
    where: { template_id: sourceId, deleted_at: null },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: { id: true, name: true, description: true, sort_order: true, is_active: true },
  });
  if (!categories.length) return;

  const newCategoryId = new Map<string, string>();
  await db.assessment_categories.createMany({
    data: categories.map((c) => {
      const id = randomUUID();
      newCategoryId.set(c.id, id);
      return {
        id,
        template_id: targetId,
        name: c.name,
        description: c.description,
        sort_order: c.sort_order,
        is_active: c.is_active,
      };
    }),
  });

  const questions = await db.assessment_questions.findMany({
    where: { category_id: { in: categories.map((c) => c.id) }, deleted_at: null },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: {
      category_id: true,
      question_code: true,
      question_text: true,
      question_type: true,
      max_score: true,
      evidence_mode: true,
      comment_mode: true,
      guidance_note: true,
      score0_description: true,
      score1_description: true,
      score2_description: true,
      score3_description: true,
      sort_order: true,
      is_active: true,
      options: {
        where: { deleted_at: null },
        orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
        select: { option_text: true, score: true, sort_order: true, is_active: true },
      },
    },
  });

  const data: Prisma.assessment_questionsCreateManyInput[] = [];
  const optionData: Prisma.assessment_question_optionsCreateManyInput[] = [];
  for (const q of questions) {
    const categoryId = newCategoryId.get(q.category_id);
    if (!categoryId) continue;
    const id = randomUUID();
    data.push({
      id,
      category_id: categoryId,
      question_code: q.question_code,
      question_text: q.question_text,
      question_type: q.question_type,
      max_score: q.max_score,
      evidence_mode: q.evidence_mode,
      comment_mode: q.comment_mode,
      guidance_note: q.guidance_note,
      score0_description: q.score0_description,
      score1_description: q.score1_description,
      score2_description: q.score2_description,
      score3_description: q.score3_description,
      sort_order: q.sort_order,
      is_active: q.is_active,
    });
    for (const option of q.options) {
      optionData.push({
        question_id: id,
        option_text: option.option_text,
        score: option.score,
        sort_order: option.sort_order,
        is_active: option.is_active,
      });
    }
  }
  if (data.length) await db.assessment_questions.createMany({ data });
  if (optionData.length) await db.assessment_question_options.createMany({ data: optionData });
}

export async function updateTemplateRow(
  id: string,
  input: { name?: string; description?: string | null; isActive?: boolean }
): Promise<boolean> {
  const data: Prisma.assessment_templatesUncheckedUpdateManyInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.isActive !== undefined) data.is_active = input.isActive;
  if (Object.keys(data).length === 0) return true;
  data.updated_at = new Date();
  const { count } = await prisma.assessment_templates.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  return count > 0;
}

/** Marks templates deleted along with their categories and questions. */
export async function softDeleteTemplates(
  db: Db,
  templateIds: string[],
  now: Date = new Date()
): Promise<number> {
  if (!templateIds.length) return 0;
  // Locking the rows first means a template made Global a moment ago is left alone.
  const locked = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM assessment_templates
     WHERE id = ANY(${templateIds}::uuid[]) AND deleted_at IS NULL AND is_global = false
       FOR UPDATE;`);
  const ids = locked.map((t) => t.id);
  if (!ids.length) return 0;
  await db.assessment_questions.updateMany({
    where: { deleted_at: null, assessment_categories: { template_id: { in: ids } } },
    data: { deleted_at: now, updated_at: now },
  });
  await db.assessment_categories.updateMany({
    where: { template_id: { in: ids }, deleted_at: null },
    data: { deleted_at: now, updated_at: now },
  });
  const { count } = await db.assessment_templates.updateMany({
    where: { id: { in: ids }, deleted_at: null },
    data: { deleted_at: now, updated_at: now },
  });
  return count;
}

/** Makes one template the Global one and clears the flag from whichever held it; false when it no longer qualifies. */
export async function setGlobalTemplate(id: string): Promise<boolean> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const target = await tx.$queryRaw<{ id: string; kind: string }[]>(Prisma.sql`
      SELECT t.id, ${kindOf("t")} AS kind FROM assessment_templates t
       WHERE t.id = ${id}::uuid AND t.deleted_at IS NULL AND t.is_active = true
         AND t.owner_id IS NULL AND t.program_id IS NULL
         FOR UPDATE;`);
    if (!target.length) return false;
    // Only the Global template of the same kind steps down; the other kind keeps its own.
    await tx.$executeRaw(Prisma.sql`
      UPDATE assessment_templates t
         SET is_global = false, updated_at = ${now}
       WHERE t.is_global = true AND t.id <> ${id}::uuid
         AND ${kindOf("t")} = ${target[0].kind};`);
    // A Global template keeps its kind, so each kind holds one Global.
    await tx.assessment_templates.update({
      where: { id },
      data: { is_global: true, question_kind: target[0].kind, updated_at: now },
    });
    return true;
  });
}

/** Freezes or releases a template by hand; the submission lock is separate and cannot be undone. */
export async function setTemplateLock(
  id: string,
  lockedBy: string | null
): Promise<boolean> {
  const { count } = await prisma.assessment_templates.updateMany({
    where: { id, deleted_at: null },
    data: {
      locked_at: lockedBy ? new Date() : null,
      locked_by: lockedBy,
      updated_at: new Date(),
    },
  });
  return count > 0;
}

export async function ownsProgramUsingTemplate(templateId: string, userId: string): Promise<boolean> {
  const found = await prisma.programs.findFirst({
    where: { assessment_template_id: templateId, created_by: userId, deleted_at: null },
    select: { id: true },
  });
  return found !== null;
}

/** True once any answer is saved or any assessment submitted in the program. */
export async function programHasAnswers(programId: string, db: Db = prisma): Promise<boolean> {
  const [answer, assessment] = await Promise.all([
    db.assessment_responses.findFirst({
      where: { program_id: programId, deleted_at: null },
      select: { id: true },
    }),
    db.field_assessments.findFirst({
      where: { program_id: programId },
      select: { id: true },
    }),
  ]);
  return answer !== null || assessment !== null;
}
