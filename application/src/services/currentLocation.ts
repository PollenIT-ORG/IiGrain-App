import { Platform, PermissionsAndroid, Linking } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  isMock?: boolean;
}

export type LocationErrorCode =
  | 'permission_denied'
  | 'permission_blocked'
  | 'location_services_disabled'
  | 'timeout'
  | 'position_unavailable';

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

const LOW_ACCURACY: PositionOpts = { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 };
const HIGH_ACCURACY: PositionOpts = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };

interface MaybeMockedPosition {
  coords: { latitude: number; longitude: number; accuracy?: number | null };
  mocked?: boolean;
}

export const toCoords = (position: unknown): Coords => {
  const p = position as MaybeMockedPosition;
  const accuracy = p.coords.accuracy;
  return {
    latitude: p.coords.latitude,
    longitude: p.coords.longitude,
    accuracyM: typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : null,
    isMock: p.mocked === true,
  };
};

const getPosition = (opts: PositionOpts): Promise<Coords> =>
  new Promise<Coords>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos => resolve(toCoords(pos)),
      err => reject(err),
      opts,
    );
  });

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
    if (code1 === 'permission_denied' || code1 === 'permission_blocked') {
      throw new LocationError(code1);
    }
    try {
      return await getPosition(HIGH_ACCURACY);
    } catch (e2) {
      throw new LocationError(toCode(e2 as GeoError));
    }
  }
};

export const openLocationSettings = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      return;
    } catch {
    }
  }
  await Linking.openSettings();
};

export const openAppSettings = (): void => {
  Linking.openSettings();
};
