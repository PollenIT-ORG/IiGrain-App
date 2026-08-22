import { useEffect, useRef, useState } from 'react';
import { fetchDrivingRoute } from '../services/directionsService';
import type { LatLng, MapRoute } from '../types';
import { distanceMeters, isValidLatLng } from '../utils/geo';

const REROUTE_DISTANCE_M = 40;

const REROUTE_INTERVAL_MS = 8_000;

export interface UseRouteToDestination {
  route: MapRoute | null;
  path: readonly LatLng[];
  isFallback: boolean;
  directDistanceMeters: number | null;
}

export const useRouteToDestination = (
  origin: LatLng | null,
  destination: LatLng | null,
): UseRouteToDestination => {
  const [route, setRoute] = useState<MapRoute | null>(null);

  const routedFromRef = useRef<LatLng | null>(null);
  const routedAtRef = useRef(0);
  const inFlightRef = useRef<AbortController | null>(null);

  const hasOrigin = isValidLatLng(origin);
  const hasDestination = isValidLatLng(destination);

  useEffect(() => {
    if (!hasOrigin || !hasDestination || !origin || !destination) {
      return;
    }

    const previous = routedFromRef.current;
    const movedEnough =
      previous === null || distanceMeters(previous, origin) > REROUTE_DISTANCE_M;
    const waitedEnough = Date.now() - routedAtRef.current > REROUTE_INTERVAL_MS;

    if (previous !== null && !(movedEnough && waitedEnough)) {
      return;
    }

    inFlightRef.current?.abort();
    const controller = new AbortController();
    inFlightRef.current = controller;

    routedFromRef.current = origin;
    routedAtRef.current = Date.now();

    fetchDrivingRoute(origin, destination, controller.signal)
      .then(result => {
        if (controller.signal.aborted) {
          return;
        }
        if (result) {
          setRoute(result);
        } else if (routedFromRef.current === origin) {
          routedFromRef.current = null;
        }
      })
      .catch(() => {
        routedFromRef.current = null;
      });

    return () => {
      controller.abort();
    };
  }, [hasOrigin, hasDestination, origin, destination]);

  useEffect(() => {
    setRoute(null);
    routedFromRef.current = null;
    routedAtRef.current = 0;
  }, [destination?.latitude, destination?.longitude]);

  const bothKnown = hasOrigin && hasDestination && !!origin && !!destination;

  return {
    route,
    path: route?.path ?? (bothKnown ? [origin, destination] : []),
    isFallback: !route,
    directDistanceMeters: bothKnown ? distanceMeters(origin, destination) : null,
  };
};
