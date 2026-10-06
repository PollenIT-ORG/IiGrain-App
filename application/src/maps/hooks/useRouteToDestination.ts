import { useMemo } from 'react';
import type { LatLng, MapRoute } from '../types';
import { distanceMeters, isValidLatLng } from '../utils/geo';

export interface UseRouteToDestination {
  route: MapRoute | null;
  path: readonly LatLng[];
  isFallback: boolean;
  directDistanceMeters: number | null;
}

export const useRouteToDestination = (
  origin: LatLng | null,
  destination: LatLng | null,
): UseRouteToDestination =>
  useMemo(() => {
    if (!isValidLatLng(origin) || !isValidLatLng(destination)) {
      return { route: null, path: [], isFallback: true, directDistanceMeters: null };
    }
    return {
      route: null,
      path: [origin, destination],
      isFallback: true,
      directDistanceMeters: distanceMeters(origin, destination),
    };
  }, [origin, destination]);
