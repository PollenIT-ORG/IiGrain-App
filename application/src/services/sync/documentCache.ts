import { documentRepository } from '../../repositories';
import { listFieldDocuments } from '../../repositories/documentRepository';
import { classifyMedia } from '../../utils/fileType';
import type { FieldDocument, FieldDocumentKind } from '../../types/fieldDetails';
import type { DbDocument, OwnerUserId } from '../db/types';
import { resolveFieldRow } from './farmCache';

const KB = 1024;
const MB = KB * 1024;

const sizeLabel = (bytes: number | null): string => {
  if (typeof bytes !== 'number' || bytes <= 0) {
    return '';
  }
  return bytes >= MB
    ? `${(bytes / MB).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / KB))} KB`;
};

const DOCUMENT_KINDS: readonly FieldDocumentKind[] = ['pdf', 'image', 'video', 'file'];

const asDocumentKind = (value: string): FieldDocumentKind =>
  DOCUMENT_KINDS.includes(value as FieldDocumentKind)
    ? (value as FieldDocumentKind)
    : 'file';

export const documentFromRow = (row: DbDocument): FieldDocument => {
  const kind = asDocumentKind(row.doc_kind ?? '');
  const meta = classifyMedia({
    kind,
    name: row.name,
    url: row.remote_url ?? row.name,
  });
  return {
    id: row.server_id ?? row.local_id,
    name: row.name,
    url: row.remote_url ?? '',
    kind: row.doc_kind ? kind : asDocumentKind(meta.type),
    icon: meta.icon,
    sizeLabel: sizeLabel(row.size_bytes),
    uploadedAtISO: row.uploaded_at,
  };
};

export const cacheFieldDocuments = async (
  owner: OwnerUserId,
  fieldId: string,
  documents: readonly FieldDocument[],
): Promise<void> => {
  const field = await resolveFieldRow(owner, fieldId);
  if (!field) {
    return;
  }
  for (const document of documents) {
    await documentRepository.upsertFromServer(
      owner,
      document.id,
      {
        field_local_id: field.local_id,
        name: document.name,
        remote_url: document.url || null,
        doc_kind: document.kind,
        uploaded_at: document.uploadedAtISO,
      },
      document.uploadedAtISO,
    );
  }
};

export const readCachedFieldDocuments = async (
  owner: OwnerUserId,
  fieldId: string,
): Promise<FieldDocument[] | null> => {
  const field = await resolveFieldRow(owner, fieldId);
  if (!field) {
    return null;
  }
  const rows = await listFieldDocuments(owner, field.local_id);
  if (rows.length === 0) {
    return null;
  }
  return rows.map(documentFromRow);
};

export const fieldScope = (fieldId: string, part: string): string =>
  `field:${fieldId}:${part}`;
