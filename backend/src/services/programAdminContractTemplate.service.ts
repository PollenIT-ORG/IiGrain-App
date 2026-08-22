import ApiError from "../utils/ApiError.js";
import { broadcastToAdmins } from "./realtime.service.js";
import {
  listForOwner,
  findById,
  findGlobal,
  create,
  update,
  softDelete,
  setGlobal,
  inUse,
  type PublicContractTemplate,
  type ContractClause,
} from "../models/programAdminContractTemplate.model.js";

// Contract templates for the Program Admin Survey module. Same ownership rules
// as the survey templates: the global one is shared and read-only; a program
// administrator can copy it (or another of theirs), or start blank, and edit
// their own copy freely.

const BLANK_CLAUSES: ContractClause[] = [
  {
    heading: "1. The program",
    body: "Describe what the producer is agreeing to take part in.",
  },
];

export function getTemplates(
  ownerId: string | null
): Promise<PublicContractTemplate[]> {
  return listForOwner(ownerId);
}

/** Loads a contract template the caller may use (global or their own). */
export async function getForOwner(
  id: string,
  ownerId: string | null
): Promise<PublicContractTemplate> {
  const tpl = await findById(id);
  if (!tpl) throw ApiError.notFound("Contract template not found.");
  if (ownerId && !tpl.is_global && tpl.owner_id !== ownerId) {
    throw ApiError.forbidden("You do not have access to this contract template.");
  }
  return tpl;
}

/**
 * A contract the caller may edit. The global one is the shared master: only a
 * platform admin (ownerId null) maintains it; a program administrator must copy
 * it to make their own.
 */
async function getEditable(
  id: string,
  ownerId: string | null
): Promise<PublicContractTemplate> {
  const tpl = await getForOwner(id, ownerId);
  // The wording is legal text: only the platform team edits it.
  if (tpl.source === "designed") assertMayAuthor(ownerId);
  if (tpl.is_global && ownerId !== null) {
    throw ApiError.forbidden(
      "The global contract cannot be edited. Copy it to make your own."
    );
  }
  return tpl;
}

export interface CreateInput {
  name: string;
  // "global" copies the shared global contract; a uuid copies that template;
  // "blank" starts fresh.
  basedOn: "global" | "blank" | string;
}

/**
 * Writing a contract is a legal act, so only a platform admin may do it. A
 * program administrator uploads the PDF the admin sends them instead.
 */
function assertMayAuthor(ownerId: string | null): void {
  if (ownerId !== null) {
    throw ApiError.forbidden(
      "Contracts are written by the platform team. Upload the contract PDF you were sent instead."
    );
  }
}

export async function addTemplate(
  ownerId: string | null,
  actorId: string,
  input: CreateInput
): Promise<PublicContractTemplate> {
  assertMayAuthor(ownerId);
  let source: PublicContractTemplate | null = null;
  if (input.basedOn === "global") {
    source = await findGlobal();
  } else if (input.basedOn !== "blank") {
    source = await getForOwner(input.basedOn, ownerId);
  }

  const created = await create({
    ownerId,
    name: input.name.trim(),
    intro: source?.intro ?? null,
    clauses: source ? source.clauses : BLANK_CLAUSES,
    createdBy: actorId,
    source: "designed",
  });
  broadcastToAdmins("program_admin_survey");
  return created;
}

/**
 * A program administrator uploads the contract PDF the admin emailed them. It
 * becomes a contract they can attach to their programs; the producer reads and
 * signs exactly that PDF.
 */
export async function addUploadedTemplate(
  ownerId: string | null,
  actorId: string,
  input: { name: string; pdfUrl: string; pdfName: string }
): Promise<PublicContractTemplate> {
  const created = await create({
    ownerId,
    name: input.name.trim(),
    intro: null,
    clauses: [],
    createdBy: actorId,
    pdfUrl: input.pdfUrl,
    pdfName: input.pdfName,
    source: "uploaded",
  });
  broadcastToAdmins("program_admin_survey");
  return created;
}

export async function editTemplate(
  id: string,
  ownerId: string | null,
  input: {
    name?: string;
    intro?: string | null;
    clauses?: ContractClause[];
    isActive?: boolean;
  }
): Promise<PublicContractTemplate> {
  const tpl = await getEditable(id, ownerId);
  const clauses = input.clauses?.map((c) => ({
    heading: c.heading.trim(),
    body: c.body.trim(),
  }));
  const updated = await update(id, {
    name: input.name?.trim(),
    intro: input.intro !== undefined ? input.intro?.trim() || null : undefined,
    clauses,
    isActive: input.isActive,
    allowGlobal: tpl.is_global,
  });
  if (!updated) throw ApiError.notFound("Contract template not found.");
  broadcastToAdmins("program_admin_survey");
  return updated;
}

export async function removeTemplate(
  id: string,
  ownerId: string | null
): Promise<void> {
  const tpl = await getEditable(id, ownerId);
  // The global contract is the shared fallback, so only the platform team may
  // retire it - and they are expected to put another one in its place.
  if (tpl.is_global) assertMayAuthor(ownerId);
  if (await inUse(id)) {
    throw ApiError.conflict(
      "This contract is used by a program. Change that program's contract first."
    );
  }
  const ok = await softDelete(id, tpl.is_global);
  if (!ok) throw ApiError.notFound("Contract template not found.");
  broadcastToAdmins("program_admin_survey");
}

/**
 * Makes a contract the shared global one, replacing whatever held that place.
 * Only the platform team decides this, and only for a contract of their own -
 * a program administrator's contract is theirs alone.
 */
export async function makeGlobal(
  id: string,
  ownerId: string | null
): Promise<PublicContractTemplate> {
  assertMayAuthor(ownerId);
  const tpl = await getForOwner(id, ownerId);
  if (tpl.is_global) return tpl;
  if (tpl.owner_id !== null) {
    throw ApiError.forbidden(
      "Only a contract of your own can be made the global one."
    );
  }
  const updated = await setGlobal(id);
  if (!updated) throw ApiError.notFound("Contract template not found.");
  broadcastToAdmins("program_admin_survey");
  return updated;
}

/**
 * The contract a producer signs for a program: the program's own template, or
 * the shared global one when the program has not picked a different one.
 */
export async function resolveForProgram(contractTemplateId: string | null): Promise<{
  // Identifies the document itself, for its title and reference.
  id: string | null;
  name: string;
  intro: string | null;
  clauses: ContractClause[];
  // When set, this PDF is the contract the producer reads and signs.
  pdfUrl: string | null;
}> {
  const tpl = contractTemplateId
    ? await findById(contractTemplateId)
    : await findGlobal();
  const fallback = tpl ?? (await findGlobal());
  return {
    id: fallback?.id ?? null,
    name: fallback?.name ?? "Program contract",
    intro: fallback?.intro ?? null,
    clauses: fallback?.clauses ?? [],
    pdfUrl: fallback?.pdf_url ?? null,
  };
}

export type { PublicContractTemplate, ContractClause };
