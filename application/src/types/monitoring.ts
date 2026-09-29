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
  | 'nutrient'
  | 'crop_intensification'
  | 'animal_integration';

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
  'crop_intensification',
  'animal_integration',
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
}

export interface MonitoringField {
  fieldId: string;
  fieldName: string;
  areaAcres: number | null;
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

export type MonitoringFieldErrors = Record<string, string>;

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

export interface UploadFile {
  uri: string;
  name: string;
  mime: string;
  size?: number | null;
}
