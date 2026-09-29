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
  const [attempt, setAttempt] = useState(0);

  const routedFromRef = useRef<LatLng | null>(null);
  const routedAtRef = useRef(0);
  const inFlightRef = useRef<AbortController | null>(null);

  const hasOrigin = isValidLatLng(origin);
  const hasDestination = isValidLatLng(destination);

  const originLat = hasOrigin ? origin.latitude : null;
  const originLng = hasOrigin ? origin.longitude : null;
  const destLat = hasDestination ? destination.latitude : null;
  const destLng = hasDestination ? destination.longitude : null;

  useEffect(() => {
    inFlightRef.current?.abort();
    inFlightRef.current = null;
    routedFromRef.current = null;
    routedAtRef.current = 0;
    setRoute(null);
  }, [destLat, destLng]);

  useEffect(() => () => {
    inFlightRef.current?.abort();
    inFlightRef.current = null;
  }, []);

  useEffect(() => {
    if (originLat === null || originLng === null || destLat === null || destLng === null) {
      return;
    }
    if (inFlightRef.current) {
      return;
    }

    const from: LatLng = { latitude: originLat, longitude: originLng };
    const to: LatLng = { latitude: destLat, longitude: destLng };

    const previous = routedFromRef.current;
    if (previous !== null) {
      const waitedEnough = Date.now() - routedAtRef.current > REROUTE_INTERVAL_MS;
      const movedEnough = distanceMeters(previous, from) > REROUTE_DISTANCE_M;
      if (!waitedEnough) {
        return;
      }
      if (!movedEnough && route !== null) {
        return;
      }
    }

    const controller = new AbortController();
    inFlightRef.current = controller;
    routedFromRef.current = from;
    routedAtRef.current = Date.now();

    fetchDrivingRoute(from, to, controller.signal)
      .then(result => {
        if (inFlightRef.current === controller) {
          inFlightRef.current = null;
        }
        if (controller.signal.aborted) {
          return;
        }
        if (result) {
          setRoute(result);
        } else {
          routedFromRef.current = null;
        }
      })
      .catch(() => {
        if (inFlightRef.current === controller) {
          inFlightRef.current = null;
        }
        routedFromRef.current = null;
      });
  }, [originLat, originLng, destLat, destLng, attempt, route]);

  useEffect(() => {
    if (route !== null || originLat === null || destLat === null) {
      return;
    }
    const timer = setTimeout(() => setAttempt(value => value + 1), REROUTE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [route, originLat, destLat, attempt]);

  const bothKnown = hasOrigin && hasDestination;

  return {
    route,
    path: route?.path ?? (bothKnown ? [origin, destination] : []),
    isFallback: !route,
    directDistanceMeters: bothKnown ? distanceMeters(origin, destination) : null,
  };
};
