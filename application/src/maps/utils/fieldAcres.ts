import type { GeoJSONPolygon } from '../boundary/types';
import { geoJSONToRing } from '../boundary/services/boundarySerializer';
import type { LatLng } from '../types';
import { convertArea, polygonAreaSqMeters } from './geo';

const MIN_RING_POINTS = 3;
const ACRE_DECIMALS = 2;

export const roundAcres = (acres: number): number => Number(acres.toFixed(ACRE_DECIMALS));

export const acresFromRing = (ring: readonly LatLng[] | null | undefined): number | null => {
  if (!ring || ring.length < MIN_RING_POINTS) {
    return null;
  }
  const acres = convertArea(polygonAreaSqMeters(ring), 'acre');
  return Number.isFinite(acres) ? roundAcres(acres) : null;
};

export const acresFromBoundary = (
  boundary: GeoJSONPolygon | null | undefined,
): number | null => acresFromRing(geoJSONToRing(boundary));

const groupThousands = (digits: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const formatAcres = (acres: number): string => {
  if (!Number.isFinite(acres)) {
    return '0';
  }
  const rounded = roundAcres(acres);
  const [whole, fraction = ''] = Math.abs(rounded).toFixed(ACRE_DECIMALS).split('.');
  const decimals = fraction.replace(/0+$/, '');
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${groupThousands(whole)}${decimals ? `.${decimals}` : ''}`;
};

export interface FarmFitInput {
  farmAcres: number;
  usedAcres: number;
  ownAcres: number;
  fieldAcres: number;
}

export interface FarmFit {
  grows: boolean;
  farmAcresBefore: number;
  farmAcresAfter: number;
  freeAcresBefore: number;
  freeAcresAfter: number;
}

export const fitFieldInFarm = ({
  farmAcres,
  usedAcres,
  ownAcres,
  fieldAcres,
}: FarmFitInput): FarmFit => {
  const current = roundAcres(farmAcres);
  const others = Math.max(0, usedAcres - ownAcres);
  const freeBefore = roundAcres(Math.max(0, current - others));
  const needed = roundAcres(others + fieldAcres);
  if (needed > current) {
    return {
      grows: true,
      farmAcresBefore: current,
      farmAcresAfter: needed,
      freeAcresBefore: freeBefore,
      freeAcresAfter: 0,
    };
  }
  return {
    grows: false,
    farmAcresBefore: current,
    farmAcresAfter: current,
    freeAcresBefore: freeBefore,
    freeAcresAfter: roundAcres(current - needed),
  };
};
