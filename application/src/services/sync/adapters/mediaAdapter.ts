import { Endpoints } from '../../../config/endpoints';
import { fieldRepository, monitoringRepository } from '../../../repositories';
import { getMedia, setUploadStatus } from '../../../repositories/mediaRepository';
import { MEDIA_ENTITY_TYPE } from '../mediaOutbox';
import { syncHttp } from '../syncHttp';
import type {
  DomainSyncAdapter,
  SyncAdapterContext,
  SyncAdapterResult,
} from '../types';
import type { DbMediaFile } from '../../db/types';

interface DocumentEnvelope {
  data?: {
    document?: { id?: string; url?: string; uploaded_at?: string };
    urls?: string[];
  };
}

interface MediaContext {
  fieldId?: string;
  fieldLocalId?: string;
  module?: string;
  recordId?: string;
  recordLocalId?: string;
  kind?: string;
}

interface ResolvedContext extends MediaContext {
  fieldId?: string;
  recordId?: string;
}

const parseContext = (raw: string | null): MediaContext => {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as MediaContext) : {};
  } catch {
    return {};
  }
};

const filePart = (row: DbMediaFile): Blob => {
  const uri = row.file_path.startsWith('file://')
    ? row.file_path
    : `file://${row.file_path}`;
  return {
    uri,
    name: row.file_name,
    type: row.mime ?? 'application/octet-stream',
  } as unknown as Blob;
};

const resolveContext = async (
  context: SyncAdapterContext,
  raw: MediaContext,
): Promise<ResolvedContext> => {
  const resolved: ResolvedContext = { ...raw };

  if (raw.fieldLocalId) {
    const field = await fieldRepository.getByLocalId(
      context.ownerUserId,
      raw.fieldLocalId,
    );
    if (!field?.server_id) {
      throw new Error('The field this file belongs to has not been synced yet.');
    }
    resolved.fieldId = field.server_id;
  }

  if (raw.recordLocalId) {
    const record = await monitoringRepository.getByLocalId(
      context.ownerUserId,
      raw.recordLocalId,
    );
    if (!record?.server_id) {
      throw new Error('The record this file belongs to has not been synced yet.');
    }
    resolved.recordId = record.server_id;
  }

  return resolved;
};

const endpointFor = (row: DbMediaFile, context: ResolvedContext): string => {
  if (row.purpose === 'assessment_evidence') {
    return Endpoints.assessment.uploadEvidence;
  }
  if (!context.fieldId) {
    throw new Error('Media is missing the field it belongs to.');
  }
  if (row.purpose === 'monitoring_document') {
    return Endpoints.fieldMonitoring.documentUpload(context.fieldId);
  }
  return Endpoints.fields.documents(context.fieldId);
};

const buildForm = (row: DbMediaFile, context: ResolvedContext): FormData => {
  const form = new FormData();

  if (row.purpose === 'assessment_evidence') {
    form.append('files', filePart(row));
    return form;
  }

  form.append('file', filePart(row));
  if (row.purpose === 'monitoring_document') {
    if (context.module) {
      form.append('module', context.module);
    }
    if (context.recordId) {
      form.append('recordId', context.recordId);
    }
    if (context.kind) {
      form.append('kind', context.kind);
    }
    return form;
  }

  form.append('name', row.file_name);
  return form;
};

const upload = async (context: SyncAdapterContext): Promise<SyncAdapterResult> => {
  const row = await getMedia(context.ownerUserId, context.entry.entity_local_id);
  if (!row) {
    throw new Error('Media row no longer exists locally.');
  }
  if (row.upload_status === 'uploaded') {
    return { serverId: row.server_id, serverUpdatedAt: null };
  }

  const RNFS = require('react-native-fs');
  const exists: boolean = await RNFS.exists(row.file_path);
  if (!exists) {
    await setUploadStatus(context.ownerUserId, row.local_id, 'failed', {
      error: 'The stored file is no longer on this device.',
    });
    throw new Error('The stored file is no longer on this device.');
  }

  const mediaContext = await resolveContext(context, parseContext(row.context_json));
  await setUploadStatus(context.ownerUserId, row.local_id, 'pending');

  const response = await syncHttp.post<DocumentEnvelope>(
    endpointFor(row, mediaContext),
    buildForm(row, mediaContext),
  );

  const document = response.data?.data?.document;
  const evidenceUrl = response.data?.data?.urls?.[0] ?? null;
  const remoteUrl = document?.url ?? evidenceUrl;

  await setUploadStatus(context.ownerUserId, row.local_id, 'uploaded', {
    remoteUrl,
  });

  return {
    serverId: document?.id ?? null,
    serverUpdatedAt: document?.uploaded_at ?? null,
  };
};

export const mediaAdapter: DomainSyncAdapter = {
  entityType: MEDIA_ENTITY_TYPE,
  create: upload,
  update: upload,
};
