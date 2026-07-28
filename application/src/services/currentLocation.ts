import { Platform, PermissionsAndroid, Linking } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface Coords {
  latitude: number;
  longitude: number;
}

/**
 * Actionable failure reasons for a single location acquisition. Each one maps to
 * a specific recovery path in the UI:
 *  - permission_denied         → ask again (soft "not now")
 *  - permission_blocked        → open App Settings (never-ask-again / iOS denied)
 *  - location_services_disabled→ open Location Settings (GPS provider is off)
 *  - timeout                   → no fix in time (indoors / weak signal) → retry
 *  - position_unavailable      → anything else
 */
export type LocationErrorCode =
  | 'permission_denied'
  | 'permission_blocked'
  | 'location_services_disabled'
  | 'timeout'
  | 'position_unavailable';

/**
 * Typed error carrying a stable {@link LocationErrorCode}. `message` is set to the
 * code as well so older call sites that read `error.message` keep working.
 */
export class LocationError extends Error {
  readonly code: LocationErrorCode;
  constructor(code: LocationErrorCode) {
    super(code);
    this.name = 'LocationError';
    this.code = code;
  }
}

type AndroidStatus = 'granted' | 'denied' | 'blocked';

const requestAndroid = async (): Promise<AndroidStatus> => {
  const perm = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const already = await PermissionsAndroid.check(perm);
  if (already) {
    return 'granted';
  }
  const result = await PermissionsAndroid.request(perm, {
    title: 'Location permission',
    message: 'iiGrain needs your location to center the map on where you are.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return 'granted';
  }
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    return 'blocked';
  }
  return 'denied';
};

const requestIOS = (): Promise<void> =>
  new Promise(resolve => {
    Geolocation.requestAuthorization(
      () => resolve(),
      () => resolve(),
    );
  });

/**
 * Ensures permission only (no fix). Kept for the assessor visit stream, which
 * manages its own `watchPosition`. Returns true when granted.
 */
export const ensureLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    return (await requestAndroid()) === 'granted';
  }
  await requestIOS();
  return true;
};

interface GeoError {
  code?: number;
  message?: string;
}

interface PositionOpts {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}

// Fast, cache-tolerant first try, then a precise GPS try. Two profiles instead of
// a single high-accuracy call so a cached/network fix returns instantly when it
// exists, and we only pay the GPS-warmup cost when it doesn't.
const LOW_ACCURACY: PositionOpts = { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 };
const HIGH_ACCURACY: PositionOpts = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };

const getPosition = (opts: PositionOpts): Promise<Coords> =>
  new Promise<Coords>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      err => reject(err),
      opts,
    );
  });

// Geolocation error codes: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE
// (on Android this is what a disabled location provider surfaces as),
// 3 = TIMEOUT.
const toCode = (err: GeoError): LocationErrorCode => {
  switch (err.code) {
    case 1:
      return Platform.OS === 'ios' ? 'permission_blocked' : 'permission_denied';
    case 2:
      return 'location_services_disabled';
    case 3:
      return 'timeout';
    default:
      return 'position_unavailable';
  }
};

/**
 * Acquires a single location fix with full permission + provider handling.
 * Throws {@link LocationError} with an actionable {@link LocationErrorCode}.
 *
 * This is intentionally a ONE-SHOT read, never a `watchPosition`: a picker must
 * not stream fixes, otherwise the map re-centers on every GPS tick and appears
 * to "continuously refresh". Live tracking belongs only to the visit stream.
 */
export const getCurrentLocation = async (): Promise<Coords> => {
  if (Platform.OS === 'android') {
    const status = await requestAndroid();
    if (status === 'denied') {
      throw new LocationError('permission_denied');
    }
    if (status === 'blocked') {
      throw new LocationError('permission_blocked');
    }
  } else {
    await requestIOS();
  }

  try {
    return await getPosition(LOW_ACCURACY);
  } catch (e1) {
    const code1 = toCode(e1 as GeoError);
    // A permission failure won't be fixed by retrying — surface it now.
    if (code1 === 'permission_denied' || code1 === 'permission_blocked') {
      throw new LocationError(code1);
    }
    // The network provider may be unavailable while GPS still works (and vice
    // versa), so give the precise provider a chance before deciding it failed.
    try {
      return await getPosition(HIGH_ACCURACY);
    } catch (e2) {
      throw new LocationError(toCode(e2 as GeoError));
    }
  }
};

/**
 * Opens the OS screen where the user can turn the device location provider (GPS)
 * back on. Android has a dedicated intent; iOS has no such deep link, so we fall
 * back to the app's own settings page.
 */
export const openLocationSettings = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      return;
    } catch {
      // Fall through to the generic settings screen if the intent is unavailable.
    }
  }
  await Linking.openSettings();
};

/** Opens this app's settings page (to grant a permanently-denied permission). */
export const openAppSettings = (): void => {
  Linking.openSettings();
};
