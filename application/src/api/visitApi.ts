import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import type { Visit, VisitOutcome, VisitStatus } from '../types/visit';

interface Envelope<T> {
  data: T;
}

type Num = number | string | null | undefined;

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
  started_at?: string;
  startedAt?: string;
  arrived_at?: string;
  arrivedAt?: string;
  ended_at?: string;
  endedAt?: string;
  outcome?: string | null;
}

interface VisitPayload {
  visit?: RawVisit | null;
}

export interface StartVisitInput {
  farmerId: string;
  fieldId: string;
}

const VALID_STATUS: readonly VisitStatus[] = ['en_route', 'arrived', 'completed', 'cancelled'];

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
  startedAtISO: raw.started_at ?? raw.startedAt ?? undefined,
  arrivedAtISO: raw.arrived_at ?? raw.arrivedAt ?? undefined,
  endedAtISO: raw.ended_at ?? raw.endedAt ?? undefined,
  outcome: toOutcome(raw.outcome),
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

export const pushVisitLocation = async (
  visitId: string,
  latitude: number,
  longitude: number,
): Promise<void> => {
  await http.post(Endpoints.visits.location(visitId), { latitude, longitude }, { silent: true });
};

export const markVisitArrived = async (visitId: string): Promise<Visit | null> => {
  const res = await http.post<Envelope<VisitPayload>>(Endpoints.visits.arrive(visitId), {});
  return extractVisit(res.data.data);
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
