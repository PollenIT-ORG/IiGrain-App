import type { FieldDocument } from './fieldDetails';

export type ModuleKey =
  | 'training'
  | 'soil_samples'
  | 'irrigation'
  | 'pesticide'
  | 'fertilizer'
  | 'tillage'
  | 'amendment'
  | 'crop'
  | 'nutrient';

export const MODULE_KEYS: readonly ModuleKey[] = [
  'training',
  'soil_samples',
  'irrigation',
  'pesticide',
  'fertilizer',
  'tillage',
  'amendment',
  'crop',
  'nutrient',
];

export const isModuleKey = (value: string): value is ModuleKey =>
  (MODULE_KEYS as readonly string[]).includes(value);

export type ModuleStatus = 'in_progress' | 'completed';

export type DocumentModule = ModuleKey | 'other';

export type DocumentKind = 'document' | 'photo' | 'lab_report' | 'certificate';

export type MonitoringValue = string | number | boolean | null;

export type MonitoringValues = Record<string, MonitoringValue>;

export interface MonitoringContext {
  fieldId: string;
  fieldName: string;
  farmName: string;
  ownerId: string;
  programId: string;
  programName: string;
}

export interface ModuleSummary {
  module: ModuleKey;
  label: string;
  total: number;
  completed: number;
  documents: number;
}

export interface MonitoringRecord {
  id: string;
  status: ModuleStatus;
  notes: string;
  documentCount: number;
  createdAtISO: string | null;
  updatedAtISO: string | null;
  values: MonitoringValues;
}

export interface MonitoringDocument extends FieldDocument {
  module: DocumentModule;
  recordId: string | null;
  docKind: DocumentKind;
}

export interface MonitoringProgram {
  programId: string;
  programName: string;
  startDateISO: string | null;
  fieldIds: string[];
}

export type MonitoringFieldErrors = Record<string, string>;

export interface MonitoringWriteFailure {
  message: string;
  fieldErrors: MonitoringFieldErrors;
  notFound: boolean;
  notEnrolled: boolean;
}

export interface RecordPayload {
  status: ModuleStatus;
  notes: string | null;
  values: MonitoringValues;
}

export interface RecordPatch {
  status?: ModuleStatus;
  notes?: string | null;
  values?: MonitoringValues;
}

export interface UploadTarget {
  programId: string;
  fieldId: string;
  module: DocumentModule;
  recordId?: string | null;
  kind?: DocumentKind;
}

export interface UploadFile {
  uri: string;
  name: string;
  mime: string;
  size?: number | null;
}
