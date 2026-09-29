import type { DbDocument, OwnerUserId } from '../services/db/types';
import { createOwnedRepository } from './ownedRepository';

export const documentRepository = createOwnedRepository<DbDocument>({
  table: 'documents',
  columns: [
    'field_local_id',
    'module',
    'record_local_id',
    'doc_kind',
    'name',
    'remote_url',
    'mime',
    'size_bytes',
    'uploaded_at',
    'media_local_id',
    'server_id',
  ],
  defaultOrderBy: 'created_at DESC',
});

export const listFieldDocuments = (
  owner: OwnerUserId,
  fieldLocalId: string,
): Promise<DbDocument[]> =>
  documentRepository.listWhere(owner, 'field_local_id = ?', [fieldLocalId]);

export const listModuleDocuments = (
  owner: OwnerUserId,
  fieldLocalId: string,
  module: string,
): Promise<DbDocument[]> =>
  documentRepository.listWhere(owner, 'field_local_id = ? AND module = ?', [
    fieldLocalId,
    module,
  ]);

export const listRecordDocuments = (
  owner: OwnerUserId,
  recordLocalId: string,
): Promise<DbDocument[]> =>
  documentRepository.listWhere(owner, 'record_local_id = ?', [recordLocalId]);
