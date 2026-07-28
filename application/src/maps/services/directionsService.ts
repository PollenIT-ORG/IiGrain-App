/**
 * src/maps/services/directionsService.ts — road routing via the Google
 * Directions API.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The visit-tracking screens draw the road the assessor is actually driving,
 * plus a distance/ETA badge. Neither can be computed on-device: they need road
 * topology, one-way rules and live-ish traffic modelling.
 *
 * WHY GOOGLE AND NOT OSRM (which the previous Leaflet implementation used)
 *   - The route must agree with the map under it. OSRM's road graph is OSM;
 *     Google's tiles are Google's graph. Where the two disagree the polyline
 *     visibly leaves the road, which reads as a bug.
 *   - `router.project-osrm.org` is a free demo endpoint with no SLA, no
 *     rate-limit guarantees and an explicit "not for production" notice.
 *   - We are already paying for Maps Platform.
 *
 * ⚠️  SECURITY — READ docs/maps/SECURITY.md BEFORE CHANGING THIS FILE
 * Directions is a *web service* API. Google cannot restrict web-service keys by
 * Android package + SHA-1 or by iOS bundle id — only by IP, which a mobile
 * client does not have. So the key used here CANNOT be locked to this app the
 * way the SDK key is. Consequences, in order of preference:
 *   1. BEST — proxy this call through our own backend, so the key never leaves
 *      the server. Tracked in docs/maps/FUTURE_SCOPE.md.
 *   2. ACCEPTABLE — use a SEPARATE key for Directions, restricted to the
 *      Directions API only and capped with a daily quota, so a leaked key
 *      cannot be used to run up SDK/Places billing.
 *   3. NEVER — reuse the unrestricted SDK key here.
 * `DIRECTIONS_BASE_URL` is the single line that changes when option 1 lands.
 */

import axios, { type AxiosInstance } from 'axios';
import { Env } from '../../config/env';
import type { LatLng, MapRoute } from '../types';
import { decodePolyline } from '../utils/polyline';

/**
 * Swap this for our own `${Env.API_BASE_URL}/maps/directions` when the backend
 * proxy exists — the response shape below is deliberately Google's, so a proxy
 * can pass it through untouched and this file will not need to change again.
 */
const DIRECTIONS_BASE_URL = 'https://maps.googleapis.com/maps/api';

/**
 * Own axios instance rather than the app's `http` client: this is a third-party
 * origin, so it must NOT carry our Authorization header, our refresh-token
 * interceptor or our API error envelope handling.
 */
const directionsClient: AxiosInstance = axios.create({
  baseURL: DIRECTIONS_BASE_URL,
  timeout: 12_000,
});

/** Subset of the Directions response we consume. */
interface DirectionsLeg {
  distance?: { value?: number };
  duration?: { value?: number };
}

interface DirectionsRoute {
  overview_polyline?: { points?: string };
  legs?: DirectionsLeg[];
}

interface DirectionsResponse {
  status?: string;
  routes?: DirectionsRoute[];
  error_message?: string;
}

const toParam = (point: LatLng): string => `${point.latitude},${point.longitude}`;

/**
 * Fetches the driving route between two points.
 *
 * Returns `null` — never throws — for every "no route today" case: missing API
 * key, network failure, ZERO_RESULTS, quota exhausted. The caller's job is to
 * fall back to a straight dashed line, and a tracking screen must not be able to
 * crash because a routing request failed.
 *
 * @param signal Abort signal; the caller re-requests as the assessor moves, and
 *               a superseded request must not resolve after the newer one.
 */
export const fetchDrivingRoute = async (
  origin: LatLng,
  destination: LatLng,
  signal?: AbortSignal,
): Promise<MapRoute | null> => {
  if (!Env.MAPS_API_KEY) {
    // Not an error worth surfacing: the straight-line fallback is a valid UI.
    return null;
  }

  try {
    const response = await directionsClient.get<DirectionsResponse>('/directions/json', {
      signal,
      params: {
        origin: toParam(origin),
        destination: toParam(destination),
        mode: 'driving',
        // `overview_polyline` only — we draw the shape, we do not render
        // turn-by-turn steps, and the full step geometry is ~20× the payload.
        overview: 'full',
        key: Env.MAPS_API_KEY,
      },
    });

    const data = response.data;
    if (data.status !== 'OK') {
      return null;
    }

    const route = data.routes?.[0];
    const encoded = route?.overview_polyline?.points;
    if (!route || !encoded) {
      return null;
    }

    const path = decodePolyline(encoded);
    if (path.length < 2) {
      return null;
    }

    // A two-point request produces exactly one leg; summing keeps this correct
    // if waypoints are added later.
    const legs = route.legs ?? [];
    const distanceMeters = legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0);
    const durationSeconds = legs.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0);

    return { path, distanceMeters, durationSeconds };
  } catch {
    // Aborted, offline, 5xx, malformed — all equivalent from the UI's point of
    // view. Deliberately silent: this runs on a timer during live tracking and
    // logging each failure would flood the console.
    return null;
  }
};
