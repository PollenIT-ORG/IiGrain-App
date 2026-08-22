import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import type {
  Visit,
  VisitLocationFlag,
  VisitOutcome,
  VisitStatus,
} from '../types/visit';
import type { LatLng } from '../maps/types';

interface Envelope<T> {
  data: T;
}

type Num = number | string | null | undefined;

import { geoJSONToRing } from '../maps/boundary/services/boundarySerializer';
import type { GeoJSONPolygon } from '../maps/boundary/types';

export interface RawVisit {
  id: string;
  status?: string;
  last_latitude?: Num;
  lastLatitude?: Num;
  last_longitude?: Num;
  lastLongitude?: Num;
  dest_latitude?: Num;
  destLatitude?: Num;
  dest_longitude?: Num;
  destLongitude?: Num;
  assessor_id?: string;
  assessorId?: string;
  assessor_name?: string;
  assessorName?: string;
  farmer_id?: string;
  farmerId?: string;
  farmer_name?: string;
  farmerName?: string;
  farm_name?: string;
  farmName?: string;
  field_id?: string;
  fieldId?: string;
  field_name?: string;
  fieldName?: string;
  field_boundary?: unknown;
  fieldBoundary?: unknown;
  started_at?: string;
  startedAt?: string;
  arrived_at?: string;
  arrivedAt?: string;
  ended_at?: string;
  endedAt?: string;
  last_location_at?: string | null;
  lastLocationAt?: string | null;
  outcome?: string | null;

  arrival_latitude?: Num;
  arrival_longitude?: Num;
  arrival_accuracy_m?: Num;
  arrival_distance_m?: Num;
  arrival_verified?: boolean | null;
  location_flag?: string | null;
  locationFlag?: string | null;
}

interface VisitPayload {
  visit?: RawVisit | null;
}

export interface StartVisitInput {
  farmerId: string;
  fieldId: string;
}

const VALID_STATUS: readonly VisitStatus[] = [
  'en_route',
  'arrived',
  'completed',
  'cancelled',
  'expired',
];

const VALID_FLAGS: readonly VisitLocationFlag[] = [
  'mock_location',
  'impossible_speed',
  'teleport',
];

const toNumberOrNull = (raw: Num): number | null => {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  return Number.isFinite(n) ? n : null;
};

const toStatus = (raw?: string): VisitStatus =>
  VALID_STATUS.includes(raw as VisitStatus) ? (raw as VisitStatus) : 'en_route';

const toOutcome = (raw?: string | null): VisitOutcome | null =>
  raw === 'completed' || raw === 'cancelled' ? raw : null;

const toFlag = (raw?: string | null): VisitLocationFlag | null =>
  VALID_FLAGS.includes(raw as VisitLocationFlag) ? (raw as VisitLocationFlag) : null;

export const mapVisit = (raw: RawVisit): Visit => ({
  id: raw.id,
  status: toStatus(raw.status),
  assessorLat: toNumberOrNull(raw.last_latitude ?? raw.lastLatitude),
  assessorLng: toNumberOrNull(raw.last_longitude ?? raw.lastLongitude),
  destLat: toNumberOrNull(raw.dest_latitude ?? raw.destLatitude),
  destLng: toNumberOrNull(raw.dest_longitude ?? raw.destLongitude),
  assessorId: raw.assessor_id ?? raw.assessorId ?? '',
  assessorName: raw.assessor_name ?? raw.assessorName ?? 'Assessor',
  farmerId: raw.farmer_id ?? raw.farmerId ?? '',
  farmerName: raw.farmer_name ?? raw.farmerName ?? 'Farmer',
  farmName: raw.farm_name ?? raw.farmName ?? undefined,
  fieldId: raw.field_id ?? raw.fieldId ?? undefined,
  fieldName: raw.field_name ?? raw.fieldName ?? undefined,
  fieldBoundary: geoJSONToRing(
    (raw.field_boundary ?? raw.fieldBoundary) as GeoJSONPolygon | null,
  ),
  startedAtISO: raw.started_at ?? raw.startedAt ?? undefined,
  arrivedAtISO: raw.arrived_at ?? raw.arrivedAt ?? undefined,
  endedAtISO: raw.ended_at ?? raw.endedAt ?? undefined,
  lastLocationAtISO: raw.last_location_at ?? raw.lastLocationAt ?? null,
  outcome: toOutcome(raw.outcome),
  arrival: {
    verified: typeof raw.arrival_verified === 'boolean' ? raw.arrival_verified : null,
    distanceM: toNumberOrNull(raw.arrival_distance_m),
    accuracyM: toNumberOrNull(raw.arrival_accuracy_m),
  },
  locationFlag: toFlag(raw.location_flag ?? raw.locationFlag),
});

const extractVisit = (data: unknown): Visit | null => {
  if (data && typeof data === 'object') {
    const nested = (data as VisitPayload).visit;
    if (nested && typeof nested === 'object') {
      return mapVisit(nested);
    }
    if ('id' in (data as Record<string, unknown>)) {
      return mapVisit(data as RawVisit);
    }
  }
  return null;
};

export const startVisit = async (input: StartVisitInput): Promise<Visit> => {
  const res = await http.post<Envelope<VisitPayload>>(Endpoints.visits.start, {
    farmerId: input.farmerId,
    fieldId: input.fieldId,
  });
  const visit = extractVisit(res.data.data);
  if (!visit) {
    throw new Error('Start visit did not return the visit.');
  }
  return visit;
};

export interface PositionReport {
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  isMock?: boolean;
}

const positionBody = (position: PositionReport): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    latitude: position.latitude,
    longitude: position.longitude,
  };
  if (typeof position.accuracyM === 'number' && Number.isFinite(position.accuracyM)) {
    body.accuracy_m = position.accuracyM;
  }
  if (position.isMock) {
    body.is_mock = true;
  }
  return body;
};

export const pushVisitLocation = async (
  visitId: string,
  position: PositionReport,
): Promise<void> => {
  await http.post(Endpoints.visits.location(visitId), positionBody(position), {
    silent: true,
  });
};

export const markVisitArrived = async (
  visitId: string,
  position?: PositionReport | null,
): Promise<Visit | null> => {
  const body = position
    ? { ...positionBody(position), captured_at: new Date().toISOString() }
    : {};
  const res = await http.post<Envelope<VisitPayload>>(Endpoints.visits.arrive(visitId), body);
  return extractVisit(res.data.data);
};

interface TrackPoint {
  lat?: Num;
  lng?: Num;
  at?: string;
}

export const getVisitTrack = async (visitId: string): Promise<LatLng[]> => {
  const res = await http.get<Envelope<{ points?: TrackPoint[] }>>(
    Endpoints.visits.track(visitId),
    { silent: true },
  );
  const points = res.data.data?.points ?? [];
  const path: LatLng[] = [];
  for (const point of points) {
    const latitude = toNumberOrNull(point.lat);
    const longitude = toNumberOrNull(point.lng);
    if (latitude !== null && longitude !== null) {
      path.push({ latitude, longitude });
    }
  }
  return path;
};

export const endVisit = async (
  visitId: string,
  outcome: VisitOutcome,
): Promise<Visit | null> => {
  const res = await http.post<Envelope<VisitPayload>>(Endpoints.visits.end(visitId), { outcome });
  return extractVisit(res.data.data);
};

export const getMyAssessorVisit = async (): Promise<Visit | null> => {
  const res = await http.get<Envelope<VisitPayload>>(Endpoints.visits.mineAssessor, {
    silent: true,
  });
  return extractVisit(res.data.data);
};

export const getMyFarmerVisit = async (): Promise<Visit | null> => {
  const res = await http.get<Envelope<VisitPayload>>(Endpoints.visits.mineFarmer, {
    silent: true,
  });
  return extractVisit(res.data.data);
};

export const getVisit = async (visitId: string): Promise<Visit | null> => {
  const res = await http.get<Envelope<VisitPayload>>(Endpoints.visits.byId(visitId), {
    silent: true,
  });
  return extractVisit(res.data.data);
};
