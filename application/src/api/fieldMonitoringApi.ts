import { isAxiosError } from 'axios';
import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import { moduleDef } from '../config/monitoringModules';
import type { FieldDocumentKind } from '../types/fieldDetails';
import type {
  DocumentKind,
  DocumentModule,
  ModuleKey,
  ModuleStatus,
  ModuleSummary,
  MonitoringContext,
  MonitoringDocument,
  MonitoringFieldErrors,
  MonitoringProgram,
  MonitoringRecord,
  MonitoringValues,
  RecordPatch,
  RecordPayload,
  UploadFile,
} from '../types/monitoring';
import { MODULE_KEYS, isModuleKey } from '../types/monitoring';
import { toDateOnly, toNumberOrNull } from '../utils/monitoringValues';


interface Envelope<T> {
  data: T;
}

type RawRecord = Record<string, unknown> & {
  id: string;
  status?: string;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  document_count?: number;
};

interface RawContext {
  fieldId: string;
  fieldName: string;
  farmName: string;
  ownerId: string;
  programId: string;
  programName: string;
}

interface RawModuleSummary {
  module: string;
  label: string;
  total: number;
  completed: number;
  documents?: number;
}

interface ModulesPayload {
  context: RawContext;
  modules: RawModuleSummary[];
}

interface RecordsPayload {
  context: RawContext;
  records: RawRecord[];
}

interface RecordPayloadEnvelope {
  record: RawRecord;
}

interface RawDocument {
  id: string;
  field_id: string;
  program_id: string;
  module: string;
  record_id: string | null;
  kind: string;
  name: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
}

interface DocumentsPayload {
  documents: RawDocument[];
}

interface DocumentPayload {
  document: RawDocument;
}

interface RawFarmProgram {
  programId: string;
  programName: string;
  startDate: string | null;
  fields?: Array<{ fieldId: string; fieldName: string; areaAcres: number | null }> | null;
}

interface FarmProgramsPayload {
  farmName: string;
  programs: RawFarmProgram[];
}


const toStatus = (raw: unknown): ModuleStatus =>
  raw === 'completed' ? 'completed' : 'in_progress';

const toText = (raw: unknown): string | null => {
  if (typeof raw === 'string') {
    return raw.length ? raw : null;
  }
  if (typeof raw === 'number') {
    return String(raw);
  }
  return null;
};

const mapContext = (raw: RawContext): MonitoringContext => ({
  fieldId: raw?.fieldId ?? '',
  fieldName: raw?.fieldName ?? '',
  farmName: raw?.farmName ?? '',
  ownerId: raw?.ownerId ?? '',
  programId: raw?.programId ?? '',
  programName: raw?.programName ?? '',
});

const mapValues = (module: ModuleKey, raw: RawRecord): MonitoringValues => {
  const values: MonitoringValues = {};
  for (const def of moduleDef(module).fields) {
    const cell = raw[def.key];
    switch (def.type) {
      case 'date':
        values[def.key] = toDateOnly(cell);
        break;
      case 'number':
        values[def.key] = toNumberOrNull(cell);
        break;
      case 'boolean':
        values[def.key] = typeof cell === 'boolean' ? cell : null;
        break;
      default:
        values[def.key] = toText(cell);
    }
  }
  return values;
};

const mapRecord = (module: ModuleKey, raw: RawRecord): MonitoringRecord => ({
  id: raw.id,
  status: toStatus(raw.status),
  notes: typeof raw.notes === 'string' ? raw.notes : '',
  documentCount: typeof raw.document_count === 'number' ? raw.document_count : 0,
  createdAtISO: raw.created_at ?? null,
  updatedAtISO: raw.updated_at ?? null,
  values: mapValues(module, raw),
});

const mapModuleSummary = (raw: RawModuleSummary): ModuleSummary | null => {
  if (!isModuleKey(raw.module)) {
    return null;
  }
  return {
    module: raw.module,
    label: raw.label || moduleDef(raw.module).label,
    total: Number(raw.total) || 0,
    completed: Number(raw.completed) || 0,
    documents: Number(raw.documents) || 0,
  };
};

const sizeLabel = (bytes: number | null): string => {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) {
    return '—';
  }
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }
  if (bytes >= 1000) {
    return `${Math.round(bytes / 1000)} KB`;
  }
  return `${bytes} B`;
};

const fileKind = (mime: string, name: string): { kind: FieldDocumentKind; icon: string } => {
  const lower = (mime || '').toLowerCase();
  if (lower === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
    return { kind: 'pdf', icon: 'file-pdf-box' };
  }
  if (lower.startsWith('image/')) {
    return { kind: 'image', icon: 'file-image-outline' };
  }
  if (lower.startsWith('video/')) {
    return { kind: 'video', icon: 'movie-open-outline' };
  }
  return { kind: 'file', icon: 'file-document-outline' };
};

const DOCUMENT_KINDS: readonly DocumentKind[] = [
  'document',
  'photo',
  'lab_report',
  'certificate',
];

const toDocumentKind = (raw: string): DocumentKind =>
  (DOCUMENT_KINDS as readonly string[]).includes(raw) ? (raw as DocumentKind) : 'document';

const toDocumentModule = (raw: string): DocumentModule =>
  isModuleKey(raw) ? raw : 'other';

const mapDocument = (raw: RawDocument): MonitoringDocument => {
  const name = raw.name || 'Document';
  const { kind, icon } = fileKind(raw.mime_type ?? '', name);
  return {
    id: raw.id,
    name,
    url: raw.url,
    kind,
    icon,
    sizeLabel: sizeLabel(raw.size_bytes),
    uploadedAtISO: raw.created_at ?? null,
    module: toDocumentModule(raw.module),
    recordId: raw.record_id,
    docKind: toDocumentKind(raw.kind),
  };
};

const mapProgram = (raw: RawFarmProgram): MonitoringProgram => ({
  programId: raw.programId,
  programName: raw.programName ?? '',
  startDateISO: raw.startDate ?? null,
  fieldIds: (raw.fields ?? []).map(f => f.fieldId),
});


const toBody = (payload: RecordPayload): Record<string, unknown> => ({
  ...payload.values,
  status: payload.status,
  notes: payload.notes,
});

const toPatchBody = (patch: RecordPatch): Record<string, unknown> => ({
  ...(patch.values ?? {}),
  ...(patch.status !== undefined ? { status: patch.status } : {}),
  ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
});


interface RawFieldError {
  field?: unknown;
  message?: unknown;
}

export const extractFieldErrors = (error: unknown): MonitoringFieldErrors => {
  if (!isAxiosError(error)) {
    return {};
  }
  const body = error.response?.data as { errors?: unknown } | undefined;
  const list = body?.errors;
  if (!Array.isArray(list)) {
    return {};
  }
  const out: MonitoringFieldErrors = {};
  for (const item of list as RawFieldError[]) {
    const field = typeof item?.field === 'string' ? item.field : '';
    const message = typeof item?.message === 'string' ? item.message : '';
    if (field && message && !out[field]) {
      out[field] = message;
    }
  }
  return out;
};


export interface ModulesResult {
  context: MonitoringContext;
  modules: ModuleSummary[];
}

export const getFarmPrograms = async (farmId: string): Promise<MonitoringProgram[]> => {
  const res = await http.get<Envelope<FarmProgramsPayload>>(
    Endpoints.fieldMonitoring.farmPrograms(farmId),
  );
  return (res.data.data.programs ?? []).map(mapProgram);
};

export const getModules = async (
  programId: string,
  fieldId: string,
): Promise<ModulesResult> => {
  const res = await http.get<Envelope<ModulesPayload>>(
    Endpoints.fieldMonitoring.modules(programId, fieldId),
  );
  const payload = res.data.data;
  const mapped = (payload.modules ?? [])
    .map(mapModuleSummary)
    .filter((m): m is ModuleSummary => m !== null);

  const byKey = new Map(mapped.map(m => [m.module, m]));
  const modules = MODULE_KEYS.map(
    key =>
      byKey.get(key) ?? {
        module: key,
        label: moduleDef(key).label,
        total: 0,
        completed: 0,
        documents: 0,
      },
  );

  return { context: mapContext(payload.context), modules };
};

export interface RecordsResult {
  context: MonitoringContext;
  records: MonitoringRecord[];
}

export const getRecords = async (
  programId: string,
  fieldId: string,
  module: ModuleKey,
): Promise<RecordsResult> => {
  const res = await http.get<Envelope<RecordsPayload>>(
    Endpoints.fieldMonitoring.records(programId, fieldId, module),
  );
  const payload = res.data.data;
  return {
    context: mapContext(payload.context),
    records: (payload.records ?? []).map(raw => mapRecord(module, raw)),
  };
};

export const getRecord = async (
  programId: string,
  fieldId: string,
  module: ModuleKey,
  recordId: string,
): Promise<MonitoringRecord> => {
  const res = await http.get<Envelope<RecordPayloadEnvelope>>(
    Endpoints.fieldMonitoring.record(programId, fieldId, module, recordId),
  );
  return mapRecord(module, res.data.data.record);
};

export const createRecord = async (
  programId: string,
  fieldId: string,
  module: ModuleKey,
  payload: RecordPayload,
): Promise<MonitoringRecord> => {
  const res = await http.post<Envelope<RecordPayloadEnvelope>>(
    Endpoints.fieldMonitoring.records(programId, fieldId, module),
    toBody(payload),
  );
  return mapRecord(module, res.data.data.record);
};

export const updateRecord = async (
  programId: string,
  fieldId: string,
  module: ModuleKey,
  recordId: string,
  patch: RecordPatch,
): Promise<MonitoringRecord> => {
  const res = await http.patch<Envelope<RecordPayloadEnvelope>>(
    Endpoints.fieldMonitoring.record(programId, fieldId, module, recordId),
    toPatchBody(patch),
  );
  return mapRecord(module, res.data.data.record);
};

export const deleteRecord = async (
  programId: string,
  fieldId: string,
  module: ModuleKey,
  recordId: string,
): Promise<string> => {
  await http.delete(Endpoints.fieldMonitoring.record(programId, fieldId, module, recordId));
  return recordId;
};

export interface DocumentQuery {
  module?: DocumentModule;
  recordId?: string;
}

export const getDocuments = async (
  programId: string,
  fieldId: string,
  query: DocumentQuery = {},
): Promise<MonitoringDocument[]> => {
  const res = await http.get<Envelope<DocumentsPayload>>(
    Endpoints.fieldMonitoring.documents(programId, fieldId),
    {
      params: {
        ...(query.module ? { module: query.module } : {}),
        ...(query.recordId ? { recordId: query.recordId } : {}),
      },
    },
  );
  return (res.data.data.documents ?? []).map(mapDocument);
};

export interface UploadArgs {
  programId: string;
  fieldId: string;
  module: DocumentModule;
  recordId?: string | null;
  kind?: DocumentKind;
  file: UploadFile;
}

export const uploadDocument = async ({
  programId,
  fieldId,
  module,
  recordId,
  kind,
  file,
}: UploadArgs): Promise<MonitoringDocument> => {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mime,
  } as unknown as Blob);
  form.append('module', module);
  if (recordId) {
    form.append('recordId', recordId);
  }
  if (kind) {
    form.append('kind', kind);
  }

  const res = await http.post<Envelope<DocumentPayload>>(
    Endpoints.fieldMonitoring.documentUpload(programId, fieldId),
    form,
  );
  return mapDocument(res.data.data.document);
};

export const deleteDocument = async (
  programId: string,
  fieldId: string,
  documentId: string,
): Promise<string> => {
  await http.delete(Endpoints.fieldMonitoring.document(programId, fieldId, documentId));
  return documentId;
};
