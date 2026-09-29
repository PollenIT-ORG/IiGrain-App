import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MEDIA_DRAFT_TYPE,
  captureMedia,
  commitMedia,
  discardMedia,
  getSyncSubsystem,
  listDraftMedia,
  listUnsentMediaFor,
  pendingCreateEntryId,
  resolveOwner,
  subscribeToSyncQueue,
} from '../services/sync';
import { resolveFieldRow } from '../services/sync/farmCache';
import { monitoringRepository } from '../repositories';
import { isDatabaseReady } from '../services/db';
import type { DbMediaFile, OwnerUserId } from '../services/db/types';
import type { PendingAttachmentStatus } from '../components/monitoring/MonitoringAttachments';
import type { DocumentKind, UploadFile } from '../types/monitoring';

export const MONITORING_MEDIA_PURPOSE = 'monitoring_document';

export const MONITORING_RECORD_TYPE = 'monitoring_record';

interface UploadTarget {
  readonly context: Record<string, string | null>;
  readonly dependsOnId: number | null;
}

const uploadTargetFor = async (
  owner: OwnerUserId,
  fieldId: string,
  module: string,
  kind: DocumentKind,
  recordId: string,
): Promise<UploadTarget> => {
  const context: Record<string, string | null> = { module, kind };

  const field = await resolveFieldRow(owner, fieldId);
  if (field?.server_id) {
    context.fieldId = field.server_id;
  } else if (field) {
    context.fieldLocalId = field.local_id;
  } else {
    context.fieldId = fieldId;
  }

  const record =
    (await monitoringRepository.getByServerId(owner, recordId)) ??
    (await monitoringRepository.getByLocalId(owner, recordId));

  if (record && !record.server_id) {
    context.recordLocalId = record.local_id;
    return {
      context,
      dependsOnId: await pendingCreateEntryId(
        owner,
        MONITORING_RECORD_TYPE,
        record.local_id,
      ),
    };
  }

  context.recordId = record?.server_id ?? recordId;
  return { context, dependsOnId: null };
};

export const draftScopeKey = (
  fieldId: string,
  module: string,
  recordId: string | null,
): string => `${fieldId}:${module}:${recordId ?? 'new'}`;

export interface QueuedAttachment {
  readonly localId: string;
  readonly name: string;
  readonly mime: string | null;
  readonly sizeBytes: number | null;
  readonly kind: DocumentKind;
  readonly status: PendingAttachmentStatus;
  readonly lastError: string | null;
}

const statusOf = (
  row: DbMediaFile,
  committed: boolean,
): PendingAttachmentStatus => {
  if (row.upload_status === 'failed') {
    return 'failed';
  }
  if (row.upload_status === 'pending') {
    return 'uploading';
  }
  return committed ? 'waiting' : 'queued';
};

const kindOf = (row: DbMediaFile): DocumentKind => {
  try {
    const parsed: unknown = JSON.parse(row.context_json ?? '{}');
    const value =
      parsed && typeof parsed === 'object'
        ? (parsed as { kind?: string }).kind
        : undefined;
    return (value ?? 'document') as DocumentKind;
  } catch {
    return 'document';
  }
};

const toQueued = (row: DbMediaFile, committed: boolean): QueuedAttachment => ({
  localId: row.local_id,
  name: row.file_name,
  mime: row.mime,
  sizeBytes: row.size_bytes,
  kind: kindOf(row),
  status: statusOf(row, committed),
  lastError: row.last_error,
});

export interface MonitoringAttachmentsScope {
  readonly fieldId: string;
  readonly module: string;
  readonly recordId: string | null;
}

export interface MonitoringAttachmentsApi {
  readonly queued: readonly QueuedAttachment[];
  readonly busy: boolean;
  add: (file: UploadFile, kind: DocumentKind) => Promise<boolean>;
  attach: (file: UploadFile, kind: DocumentKind) => Promise<boolean>;
  remove: (localId: string) => Promise<void>;
  commit: (recordId: string) => Promise<number>;
  refresh: () => Promise<void>;
}

const NONE: readonly QueuedAttachment[] = [];

export const useMonitoringAttachments = (
  scope: MonitoringAttachmentsScope,
): MonitoringAttachmentsApi => {
  const { fieldId, module, recordId } = scope;
  const [queued, setQueued] = useState<readonly QueuedAttachment[]>(NONE);
  const [busy, setBusy] = useState(false);
  const ownerRef = useRef<OwnerUserId | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const owner = useCallback(async (): Promise<OwnerUserId | null> => {
    if (!isDatabaseReady()) {
      return null;
    }
    if (!ownerRef.current) {
      ownerRef.current = getSyncSubsystem().owner() ?? (await resolveOwner());
    }
    return ownerRef.current;
  }, []);

  const refresh = useCallback(async () => {
    const scoped = await owner();
    if (!scoped) {
      return;
    }
    const drafts = await listDraftMedia(
      scoped,
      MONITORING_MEDIA_PURPOSE,
      draftScopeKey(fieldId, module, recordId),
    );
    const attached = recordId
      ? await listUnsentMediaFor(scoped, MONITORING_RECORD_TYPE, recordId)
      : [];
    if (!mounted.current) {
      return;
    }
    setQueued([
      ...drafts.map(row => toQueued(row, false)),
      ...attached.map(row => toQueued(row, true)),
    ]);
  }, [owner, fieldId, module, recordId]);

  useEffect(() => {
    refresh().catch(() => undefined);
    return subscribeToSyncQueue(() => {
      refresh().catch(() => undefined);
    });
  }, [refresh]);

  const add = useCallback(
    async (file: UploadFile, kind: DocumentKind): Promise<boolean> => {
      const scoped = await owner();
      if (!scoped) {
        return false;
      }
      setBusy(true);
      try {
        await captureMedia(scoped, {
          purpose: MONITORING_MEDIA_PURPOSE,
          file: {
            uri: file.uri,
            name: file.name,
            mime: file.mime,
            size: file.size ?? null,
          },
          attachedToType: MEDIA_DRAFT_TYPE,
          attachedToLocalId: draftScopeKey(fieldId, module, recordId),
          context: { fieldId, module, kind, recordId: recordId ?? null },
          draft: true,
        });
        await refresh();
        return true;
      } finally {
        if (mounted.current) {
          setBusy(false);
        }
      }
    },
    [owner, refresh, fieldId, module, recordId],
  );

  const attach = useCallback(
    async (file: UploadFile, kind: DocumentKind): Promise<boolean> => {
      const scoped = await owner();
      if (!scoped || !recordId) {
        return false;
      }
      setBusy(true);
      try {
        const target = await uploadTargetFor(scoped, fieldId, module, kind, recordId);
        await captureMedia(scoped, {
          purpose: MONITORING_MEDIA_PURPOSE,
          file: {
            uri: file.uri,
            name: file.name,
            mime: file.mime,
            size: file.size ?? null,
          },
          attachedToType: MONITORING_RECORD_TYPE,
          attachedToLocalId: recordId,
          context: { ...target.context, kind },
          dependsOnId: target.dependsOnId,
        });
        getSyncSubsystem()
          .flushIfPossible()
          .catch(() => undefined);
        await refresh();
        return true;
      } finally {
        if (mounted.current) {
          setBusy(false);
        }
      }
    },
    [owner, refresh, fieldId, module, recordId],
  );

  const remove = useCallback(
    async (localId: string) => {
      const scoped = await owner();
      if (!scoped) {
        return;
      }
      await discardMedia(scoped, localId);
      await refresh();
    },
    [owner, refresh],
  );

  const commit = useCallback(
    async (targetRecordId: string): Promise<number> => {
      const scoped = await owner();
      if (!scoped) {
        return 0;
      }
      const drafts = await listDraftMedia(
        scoped,
        MONITORING_MEDIA_PURPOSE,
        draftScopeKey(fieldId, module, recordId),
      );
      const target = await uploadTargetFor(
        scoped,
        fieldId,
        module,
        'document',
        targetRecordId,
      );

      for (const draft of drafts) {
        await commitMedia(scoped, draft.local_id, {
          attachedToType: MONITORING_RECORD_TYPE,
          attachedToLocalId: targetRecordId,
          context: target.context,
          dependsOnId: target.dependsOnId,
        });
      }
      if (drafts.length > 0) {
        getSyncSubsystem()
          .flushIfPossible()
          .catch(() => undefined);
      }
      await refresh();
      return drafts.length;
    },
    [owner, refresh, fieldId, module, recordId],
  );

  return { queued, busy, add, attach, remove, commit, refresh };
};
