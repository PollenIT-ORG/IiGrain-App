export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// Plain (non-readonly) mirror of maps/boundary/types#GeoJSONPolygon — kept separate so
// this shape stays Immer-draft-friendly when a Field is stored in redux state.
export interface FieldBoundaryGeoJSON {
  type: 'Polygon';
  coordinates: Array<Array<[number, number]>>;
}

export type FarmStatus = 'active' | 'pending' | 'inactive';
export type FieldHealth = 'healthy' | 'monitor' | 'critical';

export interface Farm {
  id: string;
  name: string;
  businessEntity?: string;
  ownerName: string;
  location: string;
  areaAcres: number;
  usedAcres?: number;
  availableAcres?: number;
  fieldsCount: number;
  status: FarmStatus;
  lastUpdatedISO: string;
  soilType: string;
  regenScore: number;
  latitude?: number | null;
  longitude?: number | null;

  ownerEmail?: string;
  orgId?: string;
  orgName?: string;
  createdAt?: string;

  pendingSync?: boolean;
}

export interface Field {
  id: string;
  farmId: string;
  name: string;
  areaAcres: number;
  crop: string;
  season: string;
  status: FieldHealth;
  coordinates: string;
  sowingDateISO: string;
  expectedHarvestISO: string;
  irrigation: string;
  weather: string;
  healthLabel: string;
  latitude?: number | null;
  longitude?: number | null;
  hasBoundary?: boolean;
  areaFromOutline?: boolean;
  boundary?: FieldBoundaryGeoJSON | null;
  boundaryUpdatedAt?: string | null;

  pendingSync?: boolean;
}

export interface ActivityEntry {
  id: string;
  title: string;
  description: string;
  dateISO: string;
  icon: string;
}

export interface SoilMetric {
  id: string;
  label: string;
  value: string;
  icon: string;
  tone: BadgeTone;
}

export interface FarmDocument {
  id: string;
  name: string;
  sizeLabel: string;
  dateISO: string;
  icon: string;
}

export const FARM_STATUS_META: Record<FarmStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};

export const FIELD_HEALTH_META: Record<FieldHealth, { label: string; tone: BadgeTone }> = {
  healthy: { label: 'Healthy', tone: 'success' },
  monitor: { label: 'Monitor', tone: 'warning' },
  critical: { label: 'Critical', tone: 'danger' },
};
