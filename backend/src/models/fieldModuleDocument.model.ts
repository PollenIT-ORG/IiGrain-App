import prisma from "../db/prisma.js";
import type { ModuleKey } from "./fieldModule.model.js";

/**
 * Attachments for the monitoring modules: the lab report PDF, the training
 * certificate, the extra photos, and the loose files uploaded from the panel.
 *
 * One table for all of them. A file either belongs to a single record, through
 * record_id, or to the module as a whole when record_id is null, which is what
 * the Upload New Document box at the bottom of each admin tab produces.
 */

export type DocumentModule = ModuleKey | "other";

export type DocumentKind = "document" | "photo" | "lab_report" | "certificate";

export interface PublicModuleDocument {
  id: string;
  field_id: string;
  module: DocumentModule;
  record_id: string | null;
  kind: DocumentKind;
  name: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: Date;
}

type Row = {
  id: string;
  field_id: string;
  module: string;
  record_id: string | null;
  kind: string;
  name: string;
  url: string;
  mime_type: string | null;
  size_bytes: bigint | null;
  uploaded_by: string | null;
  created_at: Date;
};

/** size_bytes is a bigint in the database and JSON cannot carry one. */
function toPublic(r: Row): PublicModuleDocument {
  return {
    id: r.id,
    field_id: r.field_id,
    module: r.module as DocumentModule,
    record_id: r.record_id,
    kind: r.kind as DocumentKind,
    name: r.name,
    url: r.url,
    mime_type: r.mime_type,
    size_bytes: r.size_bytes === null ? null : Number(r.size_bytes),
    uploaded_by: r.uploaded_by,
    created_at: r.created_at,
  };
}

const SELECT = {
  id: true,
  field_id: true,
  module: true,
  record_id: true,
  kind: true,
  name: true,
  url: true,
  mime_type: true,
  size_bytes: true,
  uploaded_by: true,
  created_at: true,
} as const;

export async function listDocuments(input: {
  fieldId: string;
  module?: DocumentModule;
  recordId?: string;
}): Promise<PublicModuleDocument[]> {
  const rows = await prisma.field_module_documents.findMany({
    where: {
      field_id: input.fieldId,
      deleted_at: null,
      ...(input.module ? { module: input.module } : {}),
      ...(input.recordId ? { record_id: input.recordId } : {}),
    },
    orderBy: { created_at: "desc" },
    select: SELECT,
  });
  return rows.map(toPublic);
}

export async function findDocument(
  id: string
): Promise<PublicModuleDocument | null> {
  const row = await prisma.field_module_documents.findFirst({
    where: { id, deleted_at: null },
    select: SELECT,
  });
  return row ? toPublic(row) : null;
}

export async function createDocument(input: {
  fieldId: string;
  module: DocumentModule;
  recordId: string | null;
  kind: DocumentKind;
  name: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
}): Promise<PublicModuleDocument> {
  const row = await prisma.field_module_documents.create({
    data: {
      field_id: input.fieldId,
      module: input.module,
      record_id: input.recordId,
      kind: input.kind,
      name: input.name,
      url: input.url,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      uploaded_by: input.uploadedBy,
    },
    select: SELECT,
  });
  return toPublic(row);
}

export async function softDeleteDocument(id: string): Promise<void> {
  await prisma.field_module_documents.update({
    where: { id },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
}

/**
 * How many files each record carries, so a list can show a paperclip without
 * fetching every file for every row.
 */
export async function documentCountsByRecord(input: {
  fieldId: string;
  module: DocumentModule;
}): Promise<Map<string, number>> {
  const rows = await prisma.field_module_documents.groupBy({
    by: ["record_id"],
    where: {
      field_id: input.fieldId,
      module: input.module,
      deleted_at: null,
      record_id: { not: null },
    },
    _count: { _all: true },
  });
  return new Map(
    rows
      .filter((r) => r.record_id !== null)
      .map((r) => [r.record_id as string, r._count._all])
  );
}
