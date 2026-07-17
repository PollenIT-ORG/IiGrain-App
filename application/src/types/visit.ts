export type VisitStatus = 'en_route' | 'arrived' | 'completed' | 'cancelled';
export type VisitOutcome = 'completed' | 'cancelled';

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

  startedAtISO?: string;
  arrivedAtISO?: string;
  endedAtISO?: string;
  outcome?: VisitOutcome | null;
}

export const isVisitActive = (status: VisitStatus): boolean =>
  status === 'en_route' || status === 'arrived';
