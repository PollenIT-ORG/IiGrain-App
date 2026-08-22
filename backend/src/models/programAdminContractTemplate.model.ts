import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";

// Program Admin Survey - contract templates. Mirrors the survey templates: one
// shared global template (read-only) plus each program administrator's own.

export interface ContractClause {
  heading: string;
  body: string;
}

// "designed" = written in the panel by an admin; "uploaded" = a PDF a program
// administrator uploaded (the signed legal copy the admin emailed them).
export type ContractSource = "designed" | "uploaded";

export interface PublicContractTemplate {
  id: string;
  owner_id: string | null;
  is_global: boolean;
  name: string;
  intro: string | null;
  clauses: ContractClause[];
  pdf_url: string | null;
  pdf_name: string | null;
  source: ContractSource;
  is_active: boolean;
  created_at: Date;
}

const SELECT = {
  id: true,
  owner_id: true,
  is_global: true,
  name: true,
  intro: true,
  clauses: true,
  pdf_url: true,
  pdf_name: true,
  source: true,
  is_active: true,
  created_at: true,
};

type Row = {
  id: string;
  owner_id: string | null;
  is_global: boolean;
  name: string;
  intro: string | null;
  clauses: Prisma.JsonValue;
  pdf_url: string | null;
  pdf_name: string | null;
  source: string;
  is_active: boolean;
  created_at: Date;
};

function toPublic(r: Row): PublicContractTemplate {
  return {
    id: r.id,
    owner_id: r.owner_id,
    is_global: r.is_global,
    name: r.name,
    intro: r.intro,
    clauses: (r.clauses as unknown as ContractClause[]) ?? [],
    pdf_url: r.pdf_url,
    pdf_name: r.pdf_name,
    source: r.source as ContractSource,
    is_active: r.is_active,
    created_at: r.created_at,
  };
}

/** Contract templates a program admin may use: the global one plus their own. */
export async function listForOwner(
  ownerId: string | null
): Promise<PublicContractTemplate[]> {
  const rows = await prisma.program_admin_contract_templates.findMany({
    where: {
      deleted_at: null,
      ...(ownerId ? { OR: [{ is_global: true }, { owner_id: ownerId }] } : {}),
    },
    orderBy: [{ is_global: "desc" }, { created_at: "desc" }],
    select: SELECT,
  });
  return rows.map(toPublic);
}

export async function findById(
  id: string
): Promise<PublicContractTemplate | null> {
  const row = await prisma.program_admin_contract_templates.findFirst({
    where: { id, deleted_at: null },
    select: SELECT,
  });
  return row ? toPublic(row) : null;
}

export async function findGlobal(): Promise<PublicContractTemplate | null> {
  const row = await prisma.program_admin_contract_templates.findFirst({
    where: { is_global: true, deleted_at: null },
    select: SELECT,
  });
  return row ? toPublic(row) : null;
}

export async function create(p: {
  ownerId: string | null;
  name: string;
  intro: string | null;
  clauses: ContractClause[];
  createdBy: string | null;
  pdfUrl?: string | null;
  pdfName?: string | null;
  source?: ContractSource;
}): Promise<PublicContractTemplate> {
  const row = await prisma.program_admin_contract_templates.create({
    data: {
      owner_id: p.ownerId,
      is_global: false,
      name: p.name,
      intro: p.intro,
      clauses: p.clauses as unknown as Prisma.InputJsonValue,
      created_by: p.createdBy,
      pdf_url: p.pdfUrl ?? null,
      pdf_name: p.pdfName ?? null,
      source: p.source ?? "designed",
    },
    select: SELECT,
  });
  return toPublic(row);
}

export async function update(
  id: string,
  p: {
    name?: string;
    intro?: string | null;
    clauses?: ContractClause[];
    isActive?: boolean;
    // Only a platform admin may edit the shared global contract.
    allowGlobal?: boolean;
  }
): Promise<PublicContractTemplate | null> {
  const data: Record<string, unknown> = { updated_at: new Date() };
  if (p.name !== undefined) data.name = p.name;
  if (p.intro !== undefined) data.intro = p.intro;
  if (p.clauses !== undefined)
    data.clauses = p.clauses as unknown as Prisma.InputJsonValue;
  if (p.isActive !== undefined) data.is_active = p.isActive;
  const { count } = await prisma.program_admin_contract_templates.updateMany({
    where: {
      id,
      deleted_at: null,
      ...(p.allowGlobal ? {} : { is_global: false }),
    },
    data,
  });
  if (!count) return null;
  return findById(id);
}

export async function softDelete(
  id: string,
  allowGlobal = false
): Promise<boolean> {
  const now = new Date();
  const { count } = await prisma.program_admin_contract_templates.updateMany({
    where: { id, deleted_at: null, ...(allowGlobal ? {} : { is_global: false }) },
    data: { deleted_at: now, updated_at: now },
  });
  return count > 0;
}

/** Makes one contract the shared global, stepping the previous one down. */
export async function setGlobal(id: string): Promise<PublicContractTemplate | null> {
  const now = new Date();
  await prisma.$transaction([
    prisma.program_admin_contract_templates.updateMany({
      where: { is_global: true, id: { not: id } },
      data: { is_global: false, updated_at: now },
    }),
    prisma.program_admin_contract_templates.updateMany({
      where: { id, deleted_at: null },
      data: { is_global: true, updated_at: now },
    }),
  ]);
  return findById(id);
}

/**
 * True when a real program still points at this contract. Legacy link rows with
 * no program attached must not block a delete.
 */
export async function inUse(id: string): Promise<boolean> {
  const found = await prisma.program_admin_surveys.findFirst({
    where: {
      contract_template_id: id,
      deleted_at: null,
      program_id: { not: null },
    },
    select: { id: true },
  });
  return found !== null;
}
