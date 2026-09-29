import { newLocalId, nowIso } from '../services/db/ids';
import type { DbMediaFile, OwnerUserId, UploadStatus } from '../services/db/types';
import { execute, queryAll, queryOne, requireOwner } from './ownerScope';

export interface MediaInput {
  readonly purpose: string;
  readonly filePath: string;
  readonly fileName: string;
  readonly mime?: string | null;
  readonly sizeBytes?: number | null;
  readonly attachedToType?: string | null;
  readonly attachedToLocalId?: string | null;
}

export const createMedia = async (
  owner: OwnerUserId,
  input: MediaInput,
): Promise<DbMediaFile> => {
  const ownerId = requireOwner(owner);
  const localId = newLocalId();
  const timestamp = nowIso();

  await execute(
    `INSERT INTO media_files
       (local_id, owner_user_id, purpose, attached_to_type, attached_to_local_id,
        file_path, file_name, mime, size_bytes, upload_status, retry_count,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 0, ?, ?)`,
    [
      localId,
      ownerId,
      input.purpose,
      input.attachedToType ?? null,
      input.attachedToLocalId ?? null,
      input.filePath,
      input.fileName,
      input.mime ?? null,
      input.sizeBytes ?? null,
      timestamp,
      timestamp,
    ],
  );

  const created = await getMedia(owner, localId);
  if (!created) {
    throw new Error('Failed to read back the created media row.');
  }
  return created;
};

export const getMedia = (
  owner: OwnerUserId,
  localId: string,
): Promise<DbMediaFile | null> =>
  queryOne<DbMediaFile>(
    'SELECT * FROM media_files WHERE owner_user_id = ? AND local_id = ?',
    [requireOwner(owner), localId],
  );

export const listPendingUploads = (owner: OwnerUserId): Promise<DbMediaFile[]> =>
  queryAll<DbMediaFile>(
    `SELECT * FROM media_files
      WHERE owner_user_id = ? AND upload_status IN ('local', 'pending', 'failed')
      ORDER BY created_at ASC`,
    [requireOwner(owner)],
  );

export const listMediaFor = (
  owner: OwnerUserId,
  attachedToType: string,
  attachedToLocalId: string,
): Promise<DbMediaFile[]> =>
  queryAll<DbMediaFile>(
    `SELECT * FROM media_files
      WHERE owner_user_id = ? AND attached_to_type = ? AND attached_to_local_id = ?
      ORDER BY created_at ASC`,
    [requireOwner(owner), attachedToType, attachedToLocalId],
  );

export const setUploadStatus = async (
  owner: OwnerUserId,
  localId: string,
  status: UploadStatus,
  detail?: { remoteUrl?: string | null; error?: string | null },
): Promise<void> => {
  await execute(
    `UPDATE media_files
        SET upload_status = ?,
            remote_url = COALESCE(?, remote_url),
            last_error = ?,
            updated_at = ?
      WHERE owner_user_id = ? AND local_id = ?`,
    [
      status,
      detail?.remoteUrl ?? null,
      detail?.error ?? null,
      nowIso(),
      requireOwner(owner),
      localId,
    ],
  );
};

export const incrementUploadAttempt = async (
  owner: OwnerUserId,
  localId: string,
  error?: string | null,
): Promise<void> => {
  await execute(
    `UPDATE media_files
        SET retry_count = retry_count + 1, last_error = ?, updated_at = ?
      WHERE owner_user_id = ? AND local_id = ?`,
    [error ?? null, nowIso(), requireOwner(owner), localId],
  );
};

export const deleteMedia = async (
  owner: OwnerUserId,
  localId: string,
): Promise<boolean> => {
  const result = await execute(
    'DELETE FROM media_files WHERE owner_user_id = ? AND local_id = ?',
    [requireOwner(owner), localId],
  );
  return result.rowsAffected > 0;
};
