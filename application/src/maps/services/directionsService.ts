import axios, { type AxiosInstance } from 'axios';
import { Env } from '../../config/env';
import type { LatLng, MapRoute } from '../types';
import { decodePolyline } from '../utils/polyline';

const DIRECTIONS_BASE_URL = 'https://maps.googleapis.com/maps/api';

const directionsClient: AxiosInstance = axios.create({
  baseURL: DIRECTIONS_BASE_URL,
  timeout: 12_000,
});

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

export const fetchDrivingRoute = async (
  origin: LatLng,
  destination: LatLng,
  signal?: AbortSignal,
): Promise<MapRoute | null> => {
  if (!Env.MAPS_API_KEY) {
    if (__DEV__) {
      console.log('[directions] MAPS_API_KEY is empty — route not fetched, drawing straight line');
    }
    return null;
  }

  try {
    const response = await directionsClient.get<DirectionsResponse>('/directions/json', {
      signal,
      params: {
        origin: toParam(origin),
        destination: toParam(destination),
        mode: 'driving',
        overview: 'full',
        key: Env.MAPS_API_KEY,
      },
    });

    const data = response.data;
    if (data.status !== 'OK') {
      if (__DEV__) {
        console.log('[directions] not OK →', data.status, '·', data.error_message ?? '');
      }
      return null;
    }

    const route = data.routes?.[0];
    const encoded = route?.overview_polyline?.points;
    if (!route || !encoded) {
      if (__DEV__) {
        console.log('[directions] OK but no polyline in response');
      }
      return null;
    }

    const path = decodePolyline(encoded);
    if (path.length < 2) {
      return null;
    }

    const legs = route.legs ?? [];
    const distanceMeters = legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0);
    const durationSeconds = legs.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0);

    if (__DEV__) {
      console.log('[directions] route OK ·', path.length, 'points ·', distanceMeters, 'm');
    }
    return { path, distanceMeters, durationSeconds };
  } catch (error) {
    if (__DEV__) {
      console.log('[directions] request failed →', error instanceof Error ? error.message : error);
    }
    return null;
  }
};
