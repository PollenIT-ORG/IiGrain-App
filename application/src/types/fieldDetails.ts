import type { FieldHealth, SoilMetric } from './farm';

export interface FieldOverview {
  id: string;
  farmId: string;
  farmName: string;
  name: string;
  areaAcres: number;
  crop: string;
  season: string;
  irrigation: string;
  location: string;
  sowingDateISO: string | null;
  expectedHarvestISO: string | null;
  status: FieldHealth;
  isActive: boolean;
  createdAtISO: string | null;
  updatedAtISO: string | null;
}

export interface FieldSoil {
  metrics: SoilMetric[];
  texture: string;
  notes: string;
  testedOnISO: string | null;
  /** True until the field is enrolled in a started program. */
  locked: boolean;
}

export interface SoilRecord {
  ph: number | null;
  organicMatter: number | null;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
  moisture: number | null;
  texture: string;
  notes: string;
  testedOnISO: string | null;
}

export interface SaveSoilInput {
  ph?: number | null;
  organicMatter?: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  moisture?: number | null;
  texture?: string | null;
  notes?: string | null;
  testedOn?: string | null;
}

export type FieldDocumentKind = 'pdf' | 'image' | 'video' | 'file';

export interface FieldDocument {
  id: string;
  name: string;
  url: string;
  kind: FieldDocumentKind;
  icon: string;
  sizeLabel: string;
  uploadedAtISO: string | null;
}
