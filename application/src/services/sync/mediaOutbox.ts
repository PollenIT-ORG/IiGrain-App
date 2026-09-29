import RNFS from 'react-native-fs';
import { runTransaction } from '../db';
import { newLocalId, nowIso } from '../db/ids';
import type { DbMediaFile, OwnerUserId } from '../db/types';
import { execute, queryAll, requireOwner } from '../../repositories/ownerScope';
import {
  createMedia,
  deleteMedia,
  getMedia,
  setUploadStatus,
} from '../../repositories/mediaRepository';
import { cancel, enqueue, findActiveForEntity } from './syncQueueRepository';
import { logSync } from './syncLogger';

export const MEDIA_ENTITY_TYPE = 'media';

export const MEDIA_DRAFT_TYPE = 'draft';

export const DRAFT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const BASE_DIR = RNFS.DocumentDirectoryPath;

export const outboxDirFor = (ownerUserId: string): string =>
  `${BASE_DIR}/iiGrain/outbox/${ownerUserId}`;

const sanitizeExtension = (fileName: string): string => {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(fileName);
  return match ? `.${match[1].toLowerCase()}` : '';
};

export interface MediaCaptureFile {
  readonly uri: string;
  readonly name: string;
  readonly mime?: string | null;
  readonly size?: number | null;
}

export type MediaContextValue = string | null;

export interface MediaCaptureInput {
  readonly purpose: string;
  readonly file: MediaCaptureFile;
  readonly attachedToType?: string | null;
  readonly attachedToLocalId?: string | null;
  readonly context?: Record<string, MediaContextValue> | null;
  readonly draft?: boolean;
  readonly dependsOnId?: number | null;
}

const stripScheme = (uri: string): string =>
  uri.startsWith('file://') ? uri.replace('file://', '') : uri;

const readContext = (raw: string | null): Record<string, MediaContextValue> => {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, MediaContextValue>)
      : {};
  } catch {
    return {};
  }
};

const requireMedia = async (
  owner: OwnerUserId,
  localId: string,
): Promise<DbMediaFile> => {
  const row = await getMedia(owner, localId);
  if (!row) {
    throw new Error('That attachment is no longer on this device.');
  }
  return row;
};

const removeFileQuietly = async (path: string): Promise<void> => {
  try {
    const exists = await RNFS.exists(path);
    if (exists) {
      await RNFS.unlink(path);
    }
  } catch {
    return;
  }
};

export const captureMedia = async (
  owner: OwnerUserId,
  input: MediaCaptureInput,
): Promise<DbMediaFile> => {
  const ownerId = requireOwner(owner);
  const localId = newLocalId();
  const directory = outboxDirFor(ownerId);
  const destination = `${directory}/${localId}${sanitizeExtension(input.file.name)}`;

  await RNFS.mkdir(directory);
  await RNFS.copyFile(stripScheme(input.file.uri), destination);

  const exists = await RNFS.exists(destination);
  if (!exists) {
    throw new Error('Could not store the selected file on this device.');
  }

  let createdId = '';
  try {
    await runTransaction(async () => {
      const row = await createMedia(owner, {
        purpose: input.purpose,
        filePath: destination,
        fileName: input.file.name,
        mime: input.file.mime ?? null,
        sizeBytes: input.file.size ?? null,
        attachedToType: input.attachedToType ?? null,
        attachedToLocalId: input.attachedToLocalId ?? null,
      });

      if (input.context) {
        await execute(
          'UPDATE media_files SET context_json = ?, updated_at = ? WHERE owner_user_id = ? AND local_id = ?',
          [JSON.stringify(input.context), nowIso(), ownerId, row.local_id],
        );
      }

      if (!input.draft) {
        await enqueue(owner, {
          entityType: MEDIA_ENTITY_TYPE,
          entityLocalId: row.local_id,
          operation: 'create',
          dependsOnId: input.dependsOnId ?? null,
        });
      }

      createdId = row.local_id;
      return row;
    });
  } catch (error) {
    await removeFileQuietly(destination);
    throw error;
  }

  const stored = await getMedia(owner, createdId);
  if (!stored) {
    throw new Error('Failed to read back the captured media row.');
  }

  logSync('entry_claimed', {
    entityType: MEDIA_ENTITY_TYPE,
    operation: input.draft ? 'drafted' : 'captured',
  });

  return stored;
};

export interface MediaCommitInput {
  readonly attachedToType?: string | null;
  readonly attachedToLocalId?: string | null;
  readonly context?: Record<string, MediaContextValue> | null;
  readonly dependsOnId?: number | null;
}

export const commitMedia = async (
  owner: OwnerUserId,
  localId: string,
  input: MediaCommitInput = {},
): Promise<DbMediaFile> => {
  const ownerId = requireOwner(owner);
  const row = await requireMedia(owner, localId);

  await runTransaction(async () => {
    const merged = { ...readContext(row.context_json), ...(input.context ?? {}) };

    await execute(
      `UPDATE media_files
          SET attached_to_type = COALESCE(?, attached_to_type),
              attached_to_local_id = COALESCE(?, attached_to_local_id),
              context_json = ?,
              updated_at = ?
        WHERE owner_user_id = ? AND local_id = ?`,
      [
        input.attachedToType ?? null,
        input.attachedToLocalId ?? null,
        JSON.stringify(merged),
        nowIso(),
        ownerId,
        localId,
      ],
    );

    await enqueue(owner, {
      entityType: MEDIA_ENTITY_TYPE,
      entityLocalId: localId,
      operation: 'create',
      dependsOnId: input.dependsOnId ?? null,
    });
  });

  return requireMedia(owner, localId);
};

export const discardMedia = async (
  owner: OwnerUserId,
  localId: string,
): Promise<boolean> => {
  const row = await getMedia(owner, localId);
  if (!row) {
    return false;
  }
  if (row.upload_status === 'uploaded') {
    return false;
  }

  const entry = await findActiveForEntity(owner, MEDIA_ENTITY_TYPE, localId);
  if (entry) {
    const cancelled = await cancel(owner, entry.id);
    if (!cancelled) {
      return false;
    }
  }

  await deleteMedia(owner, localId);
  await removeFileQuietly(row.file_path);
  return true;
};

export const listDraftMedia = (
  owner: OwnerUserId,
  purpose: string,
  draftScope: string,
): Promise<DbMediaFile[]> =>
  queryAll<DbMediaFile>(
    `SELECT * FROM media_files
      WHERE owner_user_id = ?
        AND purpose = ?
        AND attached_to_type = ?
        AND attached_to_local_id = ?
      ORDER BY created_at ASC`,
    [requireOwner(owner), purpose, MEDIA_DRAFT_TYPE, draftScope],
  );

export const listUnsentMediaFor = (
  owner: OwnerUserId,
  attachedToType: string,
  attachedToLocalId: string,
): Promise<DbMediaFile[]> =>
  queryAll<DbMediaFile>(
    `SELECT * FROM media_files
      WHERE owner_user_id = ?
        AND attached_to_type = ?
        AND attached_to_local_id = ?
        AND upload_status <> 'uploaded'
      ORDER BY created_at ASC`,
    [requireOwner(owner), attachedToType, attachedToLocalId],
  );

export const reconcileMediaFiles = async (owner: OwnerUserId): Promise<number> => {
  const ownerId = requireOwner(owner);
  const rows = await queryAll<DbMediaFile>(
    `SELECT * FROM media_files
      WHERE owner_user_id = ? AND upload_status IN ('local', 'pending', 'failed')`,
    [ownerId],
  );

  let missing = 0;
  for (const row of rows) {
    const exists = await RNFS.exists(row.file_path);
    if (exists) {
      continue;
    }
    missing += 1;
    await setUploadStatus(owner, row.local_id, 'failed', {
      error: 'The stored file is no longer on this device.',
    });
  }

  if (missing > 0) {
    logSync('permanent_failure', {
      entityType: MEDIA_ENTITY_TYPE,
      count: missing,
      reason: 'missing local files',
    });
  }
  return missing;
};

export const purgeAbandonedDrafts = async (
  owner: OwnerUserId,
  retentionMs: number = DRAFT_RETENTION_MS,
): Promise<number> => {
  const cutoff = new Date(Date.now() - retentionMs).toISOString();
  const rows = await queryAll<DbMediaFile>(
    `SELECT m.* FROM media_files m
      WHERE m.owner_user_id = ?
        AND m.attached_to_type = ?
        AND m.upload_status = 'local'
        AND m.created_at < ?
        AND NOT EXISTS (
          SELECT 1 FROM sync_queue q
           WHERE q.owner_user_id = m.owner_user_id
             AND q.entity_type = ?
             AND q.entity_local_id = m.local_id
        )`,
    [requireOwner(owner), MEDIA_DRAFT_TYPE, cutoff, MEDIA_ENTITY_TYPE],
  );

  for (const row of rows) {
    await deleteMedia(owner, row.local_id);
    await removeFileQuietly(row.file_path);
  }

  if (rows.length > 0) {
    logSync('flush_completed', {
      entityType: MEDIA_ENTITY_TYPE,
      count: rows.length,
      reason: 'abandoned drafts purged',
    });
  }
  return rows.length;
};
