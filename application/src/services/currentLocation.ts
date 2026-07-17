import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface Coords {
  latitude: number;
  longitude: number;
}

export type LocationErrorCode =
  | 'permission_denied'
  | 'permission_blocked'
  | 'position_unavailable';

type AndroidStatus = 'granted' | 'denied' | 'blocked';

const requestAndroid = async (): Promise<AndroidStatus> => {
  const perm = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const already = await PermissionsAndroid.check(perm);
  console.log('[currentLocation] android: already granted?', already);
  if (already) {
    return 'granted';
  }
  const result = await PermissionsAndroid.request(perm, {
    title: 'Location permission',
    message: 'iiGrain needs your location to center the map on where you are.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  console.log('[currentLocation] android: request result =', result);
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

const getPosition = (opts: PositionOpts): Promise<Coords> =>
  new Promise<Coords>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      err => reject(err),
      opts,
    );
  });

const mapError = (err: GeoError): Error =>
  err.code === 1
    ? new Error(Platform.OS === 'ios' ? 'permission_blocked' : 'permission_denied')
    : new Error('position_unavailable');

export const getCurrentLocation = async (): Promise<Coords> => {
  console.log('[currentLocation] getCurrentLocation() called · platform =', Platform.OS);
  if (Platform.OS === 'android') {
    const status = await requestAndroid();
    console.log('[currentLocation] android permission status =', status);
    if (status === 'denied') {
      throw new Error('permission_denied');
    }
    if (status === 'blocked') {
      throw new Error('permission_blocked');
    }
  } else {
    console.log('[currentLocation] ios: requesting authorization…');
    await requestIOS();
    console.log('[currentLocation] ios: authorization step done');
  }

  try {
    console.log('[currentLocation] attempt 1: low accuracy (fast, cached OK)…');
    const c = await getPosition({ enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
    console.log('[currentLocation] position (low accuracy):', c.latitude, c.longitude);
    return c;
  } catch (e1) {
    const err1 = e1 as GeoError;
    console.log('[currentLocation] attempt 1 failed · code =', err1.code, '·', err1.message);
    if (err1.code === 1) {
      throw mapError(err1);
    }
    try {
      console.log('[currentLocation] attempt 2: high accuracy (GPS)…');
      const c = await getPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      console.log('[currentLocation] position (high accuracy):', c.latitude, c.longitude);
      return c;
    } catch (e2) {
      const err2 = e2 as GeoError;
      console.log('[currentLocation] attempt 2 failed · code =', err2.code, '·', err2.message);
      throw mapError(err2);
    }
  }
};
