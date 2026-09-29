import prisma from "../db/prisma.js";
import ApiError from "../utils/ApiError.js";
import { isAdminLevel } from "../config/rbac.js";
import type { QuestionKind } from "../validators/assessment.schema.js";
import { broadcastToAdmins } from "./realtime.service.js";
import {
  findTemplateById,
  findGlobalTemplate,
  listTemplates,
  listTemplatesPage,
  templateNameTaken,
  createTemplateRow,
  copyTemplateContents,
  updateTemplateRow,
  softDeleteTemplates,
  setGlobalTemplate,
  setTemplateLock,
  ownsProgramUsingTemplate,
  programHasAnswers,
  type PublicAssessmentTemplate,
} from "../models/assessmentTemplate.model.js";

export interface TemplateActor {
  id: string;
  role: string;
}

type Db = Parameters<typeof createTemplateRow>[0];

// Copying a template runs several statements against a remote database, more than the default five seconds allow.
export const TEMPLATE_TX = { timeout: 30_000, maxWait: 10_000 };

const LOCKED_MESSAGE =
  "This assessment has been submitted in a program, so it can no longer be changed. Copy it to make a new version.";

const MANUAL_LOCK_MESSAGE =
  "This assessment is locked. Unlock it first to change its categories or questions.";

function notify(): void {
  broadcastToAdmins("assessments");
}

async function loadTemplate(id: string): Promise<PublicAssessmentTemplate> {
  const tpl = await findTemplateById(id);
  if (!tpl) throw ApiError.notFound("Template not found.");
  return tpl;
}

export function getTemplates(actor: TemplateActor): Promise<PublicAssessmentTemplate[]> {
  return listTemplates(isAdminLevel(actor.role) ? null : actor.id);
}

/** A page of the templates and program assessments, for the Assessments list. */
export async function getTemplatesPage(
  actor: TemplateActor,
  query: { page: number; limit: number; search?: string; kind?: QuestionKind }
) {
  const { rows, total } = await listTemplatesPage(isAdminLevel(actor.role) ? null : actor.id, {
    search: query.search,
    kind: query.kind,
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
  });
  return {
    templates: rows,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

/** A template the actor may open; anything else is reported as missing. */
export async function getVisibleTemplate(
  id: string,
  actor: TemplateActor
): Promise<PublicAssessmentTemplate> {
  const tpl = await findTemplateById(id);
  if (!tpl) throw ApiError.notFound("Template not found.");
  if (isAdminLevel(actor.role) || tpl.is_global || tpl.owner_id === actor.id) return tpl;
  if (await ownsProgramUsingTemplate(tpl.id, actor.id)) return tpl;
  throw ApiError.notFound("Template not found.");
}

/** A template the actor is in charge of, whether or not it is locked. */
export async function getManageableTemplate(
  id: string,
  actor: TemplateActor
): Promise<PublicAssessmentTemplate> {
  const tpl = await getVisibleTemplate(id, actor);
  if (!isAdminLevel(actor.role)) {
    if (tpl.is_global) {
      throw ApiError.forbidden("Only an admin can change the Global template. Copy it to make your own.");
    }
    // A program's own copy belongs to whoever runs that program, even when an admin made the copy.
    const ownsCopy = tpl.program_id !== null && (await ownsProgramUsingTemplate(tpl.id, actor.id));
    if (tpl.owner_id !== actor.id && !ownsCopy) {
      throw ApiError.forbidden("This template is shared with other programs. Copy it to make changes.");
    }
  }
  return tpl;
}

/** A template whose details, categories and questions the actor may change right now. */
export async function getEditableTemplate(
  id: string,
  actor: TemplateActor
): Promise<PublicAssessmentTemplate> {
  const tpl = await getManageableTemplate(id, actor);
  if (tpl.locked) {
    throw ApiError.conflict(tpl.has_submissions ? LOCKED_MESSAGE : MANUAL_LOCK_MESSAGE);
  }
  return tpl;
}

/** Freezes the questions of a template, or releases them again while nothing has been submitted. */
export async function setTemplateLocked(
  id: string,
  actor: TemplateActor,
  locked: boolean
): Promise<PublicAssessmentTemplate> {
  const tpl = await getManageableTemplate(id, actor);
  if (!locked && tpl.has_submissions) throw ApiError.conflict(LOCKED_MESSAGE);
  if (locked === (tpl.locked_at !== null)) return tpl;
  const ok = await setTemplateLock(id, locked ? actor.id : null);
  if (!ok) throw ApiError.notFound("Template not found.");
  notify();
  return loadTemplate(id);
}

/** The same check for a program naming its own assessment, from the actor who names it. */
export async function assertTemplateNameFree(
  actor: TemplateActor,
  name: string,
  excludeId?: string
): Promise<void> {
  await assertNameFree(isAdminLevel(actor.role) ? null : actor.id, name, excludeId);
}

async function assertNameFree(ownerId: string | null, name: string, excludeId?: string): Promise<void> {
  if (await templateNameTaken(ownerId, name, excludeId)) {
    throw ApiError.conflict(`A template named "${name}" already exists. Choose another name.`);
  }
}

// Where a program starts when no template was chosen: the multiple choice Global,
// else the input based one, so a platform with only one kind still works.
async function defaultGlobal(): Promise<PublicAssessmentTemplate> {
  const global = (await findGlobalTemplate("mcq")) ?? (await findGlobalTemplate("input"));
  if (!global) {
    throw ApiError.conflict("There is no Global assessment template yet. Ask an admin to choose one.");
  }
  return global;
}

async function requireGlobal(kind: QuestionKind = "mcq"): Promise<PublicAssessmentTemplate> {
  const global = await findGlobalTemplate(kind);
  if (!global) {
    const label = kind === "input" ? "input based" : "multiple choice";
    throw ApiError.conflict(`There is no ${label} Global template yet. Ask an admin to choose one.`);
  }
  return global;
}

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  basedOn: string;
  // Only for a blank template: which kind of questions it will hold.
  questionKind?: QuestionKind;
}

export async function addTemplate(
  actor: TemplateActor,
  input: CreateTemplateInput
): Promise<PublicAssessmentTemplate> {
  const name = input.name.trim();
  const ownerId = isAdminLevel(actor.role) ? null : actor.id;
  await assertNameFree(ownerId, name);

  // Blank starts with no categories and no questions; anything else copies its source.
  const source =
    input.basedOn === "blank"
      ? null
      : input.basedOn === "global"
        ? await requireGlobal(input.questionKind ?? "mcq")
        : await getVisibleTemplate(input.basedOn, actor);

  const id = await prisma.$transaction(async (tx) => {
    const created = await createTemplateRow(tx, {
      ownerId,
      programId: null,
      copiedFromId: source?.id ?? null,
      name,
      description: input.description?.trim() || null,
      // A copy holds what its source holds; a blank one holds what was asked for.
      questionKind: source ? source.question_kind : input.questionKind ?? null,
      createdBy: actor.id,
    });
    if (source) await copyTemplateContents(tx, source.id, created);
    return created;
  }, TEMPLATE_TX);

  notify();
  return loadTemplate(id);
}

export async function editTemplate(
  id: string,
  actor: TemplateActor,
  input: { name?: string; description?: string | null; isActive?: boolean }
): Promise<PublicAssessmentTemplate> {
  const tpl = await getEditableTemplate(id, actor);
  const name = input.name?.trim();
  if (name !== undefined) {
    await assertNameFree(tpl.owner_id, name, tpl.id);
  }
  if (input.isActive === false && tpl.is_global) {
    throw ApiError.conflict("The Global template cannot be switched off.");
  }
  const ok = await updateTemplateRow(id, {
    name,
    description: input.description === undefined ? undefined : input.description?.trim() || null,
    isActive: input.isActive,
  });
  if (!ok) throw ApiError.notFound("Template not found.");
  notify();
  return loadTemplate(id);
}

export async function removeTemplate(id: string, actor: TemplateActor): Promise<void> {
  const tpl = await getEditableTemplate(id, actor);
  if (tpl.is_global) throw ApiError.conflict("The Global template cannot be deleted.");
  if (tpl.program_id !== null || tpl.linked_program_count > 0) {
    throw ApiError.conflict(
      "This template is used by a program, so it cannot be deleted. Change the program's template first."
    );
  }
  const removed = await prisma.$transaction((tx) => softDeleteTemplates(tx, [id]), TEMPLATE_TX);
  if (!removed) {
    throw ApiError.conflict("This template was changed or removed by someone else. Refresh and try again.");
  }
  notify();
}

/** Only an admin template that no program uses can take over as Global. */
export async function makeGlobal(id: string, actor: TemplateActor): Promise<PublicAssessmentTemplate> {
  if (!isAdminLevel(actor.role)) {
    throw ApiError.forbidden("Only an admin can choose the Global template.");
  }
  const tpl = await getVisibleTemplate(id, actor);
  if (tpl.is_global) return tpl;
  if (tpl.owner_id !== null || tpl.program_id !== null || tpl.linked_program_count > 0) {
    throw ApiError.conflict("Only an admin template that no program uses can become the Global template.");
  }
  if (!tpl.is_active) {
    throw ApiError.conflict("Switch this template on before making it the Global template.");
  }
  if (!(await setGlobalTemplate(id))) {
    throw ApiError.conflict("This template was changed or removed by someone else. Refresh and try again.");
  }
  notify();
  return loadTemplate(id);
}

/** The template a program starts from: the one chosen, or Global when none is. */
export async function resolveProgramSource(
  templateId: string | null | undefined,
  actor: TemplateActor
): Promise<PublicAssessmentTemplate | null> {
  if (templateId === "blank") return null;
  if (!templateId) return defaultGlobal();
  const tpl = await getVisibleTemplate(templateId, actor);
  if (!tpl.is_active) {
    throw ApiError.badRequest("This assessment template is switched off. Choose another one.");
  }
  return tpl;
}

/** Gives a program its own copy of the source template, or an empty one for a blank start, inside the caller's transaction. */
export async function createProgramCopy(
  db: Db,
  source: PublicAssessmentTemplate | null,
  program: { id: string; name: string },
  actor: TemplateActor,
  questionKind?: QuestionKind,
  // The name the admin gave it; otherwise it is named after the program.
  templateName?: string
): Promise<string> {
  const id = await createTemplateRow(db, {
    ownerId: isAdminLevel(actor.role) ? null : actor.id,
    programId: program.id,
    copiedFromId: source?.id ?? null,
    name: (templateName?.trim() || `${program.name} assessment`).slice(0, 150),
    description: null,
    questionKind: source ? source.question_kind : questionKind ?? null,
    createdBy: actor.id,
  });
  if (source) await copyTemplateContents(db, source.id, id);
  return id;
}

/** A template a new program can point at until its own copy exists. */
export async function holdingTemplateId(source: PublicAssessmentTemplate | null): Promise<string> {
  return source?.id ?? (await defaultGlobal()).id;
}

export { programHasAnswers };
