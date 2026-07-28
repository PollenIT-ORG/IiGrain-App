/**
 * src/maps/hooks/useRouteToDestination.ts — keeps a road route between a moving
 * origin and a fixed destination, without hammering the Directions API.
 *
 * WHY A HOOK AND NOT A CALL INSIDE THE COMPONENT
 * ----------------------------------------------
 * The assessor's position arrives over a socket, several times a minute. A
 * naive `useEffect(fetchRoute, [origin])` would issue a billed Directions
 * request per GPS tick — thousands per visit — and each response would redraw
 * the whole polyline, causing a visible flicker.
 *
 * The throttling policy lives here so both the farmer-side and assessor-side
 * tracking screens get identical behaviour and identical cost:
 *
 *   - Route once as soon as BOTH endpoints are known.
 *   - Re-route only when the origin has drifted more than REROUTE_DISTANCE_M
 *     from where the current route started, AND at least REROUTE_INTERVAL_MS
 *     has passed. Below that threshold the existing polyline is still accurate
 *     to within a few metres at map scale.
 *   - Never allow two requests in flight; a superseded request is aborted.
 *
 * The straight-line fallback is intentional, not a stopgap: an assessor on a
 * farm track that Google has no road for should still see the direction and
 * distance to the field.
 */

import { useEffect, useRef, useState } from 'react';
import { fetchDrivingRoute } from '../services/directionsService';
import type { LatLng, MapRoute } from '../types';
import { distanceMeters, isValidLatLng } from '../utils/geo';

/** Metres the origin must move before the route is considered stale. */
const REROUTE_DISTANCE_M = 40;

/** Minimum gap between two Directions requests, in milliseconds. */
const REROUTE_INTERVAL_MS = 8_000;

export interface UseRouteToDestination {
  /** The road route, or `null` while unavailable. */
  route: MapRoute | null;
  /**
   * Points to draw right now: the road geometry when we have it, otherwise the
   * two endpoints (rendered dashed by the caller). Empty when either endpoint
   * is missing.
   */
  path: readonly LatLng[];
  /** `true` when `path` is the straight-line fallback rather than a real road. */
  isFallback: boolean;
  /** Straight-line distance — always available, used for the badge when the
   *  Directions call has not returned (or will not). */
  directDistanceMeters: number | null;
}

export const useRouteToDestination = (
  origin: LatLng | null,
  destination: LatLng | null,
): UseRouteToDestination => {
  const [route, setRoute] = useState<MapRoute | null>(null);

  // Where the current route was computed from, and when — the throttle state.
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
    // `Date.now` is the right clock here: we are throttling wall-clock
    // frequency of a billed network call, not measuring an interval.
    const waitedEnough = Date.now() - routedAtRef.current > REROUTE_INTERVAL_MS;

    if (previous !== null && !(movedEnough && waitedEnough)) {
      return;
    }

    // Supersede any request still in flight — its answer is now stale.
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
        // A failed lookup must NOT clear a previously good route: the assessor
        // driving through a tunnel would otherwise see the road vanish.
        if (result) {
          setRoute(result);
        } else if (routedFromRef.current === origin) {
          // First attempt failed → allow an immediate retry on the next fix
          // instead of waiting out the throttle window.
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

  // Destination changed entirely (user switched visit) → the old road is wrong.
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
