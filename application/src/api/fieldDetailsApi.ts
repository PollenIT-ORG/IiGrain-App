import http from '../services/http';
import type { GeoJSONPolygon } from '../maps/boundary/types';
import { acresFromBoundary } from '../maps/utils/fieldAcres';
import { Endpoints } from '../config/endpoints';
import type { ActivityEntry, BadgeTone, FieldHealth, SoilMetric } from '../types/farm';
import type {
  FieldDocument,
  FieldDocumentKind,
  FieldOverview,
  FieldSoil,
} from '../types/fieldDetails';

interface Envelope<T> {
  data: T;
}

interface RawOverview {
  id: string;
  farm_id: string;
  farm_name: string;
  name: string;
  area_acres: string;
  crop: string;
  season: string;
  irrigation: string;
  location: string;
  sowing_date: string | null;
  expected_harvest: string | null;
  status: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  boundary?: unknown;
}
interface OverviewPayload {
  overview: RawOverview;
}

interface RawActivity {
  type: string;
  title: string;
  detail: string;
  at: string;
  meta: Record<string, unknown> | null;
}
interface HistoryPayload {
  history: RawActivity[];
}

interface RawSoil {
  ph: string | null;
  organic_matter: string | null;
  nitrogen: string | null;
  phosphorus: string | null;
  potassium: string | null;
  moisture: string | null;
  texture: string | null;
  notes: string | null;
  tested_on: string | null;
}
interface SoilPayload {
  soil: RawSoil | null;
  soilLocked?: boolean;
}

interface RawDocument {
  id: string;
  field_id: string;
  name: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string | null;
  updated_at: string | null;
}
interface DocumentsPayload {
  documents: RawDocument[];
}
interface DocumentPayload {
  document: RawDocument;
}

const FIELD_HEALTHS: readonly FieldHealth[] = ['healthy', 'monitor', 'critical'];
const toFieldHealth = (raw: string): FieldHealth =>
  (FIELD_HEALTHS as readonly string[]).includes(raw) ? (raw as FieldHealth) : 'monitor';

const toNumber = (raw: string | null | undefined): number => {
  const n = Number.parseFloat(raw ?? '');
  return Number.isFinite(n) ? n : 0;
};

const sizeLabel = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
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

const docKind = (mime: string): { kind: FieldDocumentKind; icon: string } => {
  if (mime === 'application/pdf') {
    return { kind: 'pdf', icon: 'file-pdf-box' };
  }
  if (mime.startsWith('image/')) {
    return { kind: 'image', icon: 'file-image-outline' };
  }
  if (mime.startsWith('video/')) {
    return { kind: 'video', icon: 'movie-open-outline' };
  }
  return { kind: 'file', icon: 'file-document-outline' };
};

const activityIcon = (type: string): string => {
  switch (type) {
    case 'assessment_submitted':
      return 'clipboard-check-outline';
    case 'field_updated':
      return 'pencil-outline';
    case 'field_created':
      return 'sprout-outline';
    default:
      return 'timeline-clock-outline';
  }
};

const mapOverview = (raw: RawOverview): FieldOverview => ({
  id: raw.id,
  farmId: raw.farm_id,
  farmName: raw.farm_name ?? '',
  name: raw.name ?? '',
  areaAcres:
    toNumber(raw.area_acres) ||
    (acresFromBoundary(raw.boundary as GeoJSONPolygon | null) ?? 0),
  crop: raw.crop ?? '',
  season: raw.season ?? '',
  irrigation: raw.irrigation ?? '',
  location: raw.location ?? '',
  sowingDateISO: raw.sowing_date ?? null,
  expectedHarvestISO: raw.expected_harvest ?? null,
  status: toFieldHealth(raw.status),
  isActive: !!raw.is_active,
  createdAtISO: raw.created_at ?? null,
  updatedAtISO: raw.updated_at ?? null,
});

const mapActivity = (raw: RawActivity, index: number): ActivityEntry => ({
  id: `activity-${index}-${raw.at ?? ''}`,
  title: raw.title ?? '',
  description: raw.detail ?? '',
  dateISO: raw.at ?? '',
  icon: activityIcon(raw.type),
});

const soilMetric = (
  id: string,
  label: string,
  raw: string | null,
  unit: string,
  icon: string,
  tone: BadgeTone,
): SoilMetric | null =>
  raw === null || raw === undefined || raw === ''
    ? null
    : { id, label, value: `${toNumber(raw)}${unit}`, icon, tone };

const phTone = (raw: string | null): BadgeTone => {
  const ph = toNumber(raw);
  return ph >= 6 && ph <= 7.5 ? 'success' : 'warning';
};

const mapSoil = (raw: RawSoil): FieldSoil => {
  const metrics = [
    soilMetric('ph', 'Soil pH', raw.ph, '', 'ph', 'info'),
    soilMetric('om', 'Organic Matter', raw.organic_matter, '%', 'leaf', 'success'),
    soilMetric('n', 'Nitrogen (N)', raw.nitrogen, ' ppm', 'alpha-n-circle-outline', 'info'),
    soilMetric('p', 'Phosphorus (P)', raw.phosphorus, ' ppm', 'alpha-p-circle-outline', 'info'),
    soilMetric('k', 'Potassium (K)', raw.potassium, ' ppm', 'alpha-k-circle-outline', 'info'),
    soilMetric('moisture', 'Moisture', raw.moisture, '%', 'water-percent', 'neutral'),
  ].filter((m): m is SoilMetric => m !== null);
  const ph = metrics.find(m => m.id === 'ph');
  if (ph) {
    ph.tone = phTone(raw.ph);
  }
  return {
    metrics,
    texture: raw.texture ?? '',
    notes: raw.notes ?? '',
    testedOnISO: raw.tested_on ?? null,
    locked: false,
  };
};

const mapDocument = (raw: RawDocument): FieldDocument => {
  const { kind, icon } = docKind(raw.mime_type ?? '');
  return {
    id: raw.id,
    name: raw.name ?? 'Document',
    url: raw.url,
    kind,
    icon,
    sizeLabel: sizeLabel(raw.size_bytes),
    uploadedAtISO: raw.created_at ?? null,
  };
};

export const getFieldOverview = async (fieldId: string): Promise<FieldOverview> => {
  const res = await http.get<Envelope<OverviewPayload>>(
    Endpoints.fields.details(fieldId),
    { params: { tab: 'overview' } },
  );
  return mapOverview(res.data.data.overview);
};

export const getFieldActivity = async (fieldId: string): Promise<ActivityEntry[]> => {
  const res = await http.get<Envelope<HistoryPayload>>(
    Endpoints.fields.details(fieldId),
    { params: { tab: 'history' } },
  );
  return (res.data.data.history ?? []).map(mapActivity);
};

export const getFieldSoil = async (fieldId: string): Promise<FieldSoil> => {
  const res = await http.get<Envelope<SoilPayload>>(
    Endpoints.fields.details(fieldId),
    { params: { tab: 'soil' } },
  );
  const { soil: raw, soilLocked } = res.data.data;
  const locked = soilLocked ?? false;
  return raw
    ? { ...mapSoil(raw), locked }
    : { metrics: [], texture: '', notes: '', testedOnISO: null, locked };
};

export const getFieldDocuments = async (fieldId: string): Promise<FieldDocument[]> => {
  const res = await http.get<Envelope<DocumentsPayload>>(
    Endpoints.fields.details(fieldId),
    { params: { tab: 'docs' } },
  );
  return (res.data.data.documents ?? []).map(mapDocument);
};

export const deleteFieldDocument = async (
  fieldId: string,
  documentId: string,
): Promise<string> => {
  await http.delete<Envelope<unknown>>(Endpoints.fields.document(fieldId, documentId));
  return documentId;
};

export interface DocumentUploadFile {
  uri: string;
  name: string;
  mime: string;
}
export const uploadFieldDocument = async (
  fieldId: string,
  file: DocumentUploadFile,
  displayName: string,
): Promise<FieldDocument> => {
  const form = new FormData();
  const part = { uri: file.uri, name: file.name, type: file.mime };
  form.append('file', part as unknown as Blob);
  form.append('name', displayName);
  const res = await http.post<Envelope<DocumentPayload>>(
    Endpoints.fields.documents(fieldId),
    form,
  );
  return mapDocument(res.data.data.document);
};
