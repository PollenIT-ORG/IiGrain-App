import type { LatLng } from '../maps/types';

export type VisitStatus =
  | 'en_route'
  | 'arrived'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type VisitOutcome = 'completed' | 'cancelled';

export interface ArrivalCheckResult {
  verified: boolean | null;
  distanceM: number | null;
  accuracyM: number | null;
}

export type VisitLocationFlag =
  | 'mock_location'
  | 'impossible_speed'
  | 'teleport';

export interface Visit {
  id: string;
  status: VisitStatus;

  assessorLat: number | null;
  assessorLng: number | null;
  destLat: number | null;
  destLng: number | null;

  assessorId: string;
  assessorName: string;
  farmerId: string;
  farmerName: string;
  farmName?: string;
  fieldId?: string;
  fieldName?: string;
  fieldBoundary?: LatLng[];

  startedAtISO?: string;
  arrivedAtISO?: string;
  endedAtISO?: string;
  lastLocationAtISO?: string | null;
  outcome?: VisitOutcome | null;

  arrival?: ArrivalCheckResult;
  locationFlag?: VisitLocationFlag | null;
}

export const isVisitActive = (status: VisitStatus): boolean =>
  status === 'en_route' || status === 'arrived';

export const isVisitTerminal = (status: VisitStatus): boolean =>
  !isVisitActive(status);
