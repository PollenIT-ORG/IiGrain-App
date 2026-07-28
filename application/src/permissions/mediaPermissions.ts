import { Linking, PermissionsAndroid, Platform, type Permission } from 'react-native';
import type { MediaPermissionStatus, MediaPermissionType } from '../types/media';

const ANDROID_TIRAMISU = 33;

const androidPermissionsFor = (
  type: MediaPermissionType,
  extra = false,
): Permission[] => {
  if (type === 'camera') {
    const perms: Permission[] = [PermissionsAndroid.PERMISSIONS.CAMERA];
    if (extra) {
      perms.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    }
    return perms;
  }
  const apiLevel =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(`${Platform.Version}`, 10);
  if (apiLevel < ANDROID_TIRAMISU) {
    return [PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE];
  }
  const perms: Permission[] = [PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES];
  if (extra) {
    perms.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO);
  }
  return perms;
};

const normalizeAndroid = (result: string): MediaPermissionStatus => {
  switch (result) {
    case PermissionsAndroid.RESULTS.GRANTED:
      return 'granted';
    case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
      return 'blocked';
    default:
      return 'denied';
  }
};

const ensure = async (
  type: MediaPermissionType,
  extra = false,
): Promise<MediaPermissionStatus> => {
  if (Platform.OS !== 'android') {
    return 'granted';
  }
  try {
    let worst: MediaPermissionStatus = 'granted';
    for (const permission of androidPermissionsFor(type, extra)) {
      const alreadyGranted = await PermissionsAndroid.check(permission);
      if (alreadyGranted) {
        continue;
      }
      const status = normalizeAndroid(await PermissionsAndroid.request(permission));
      if (status === 'blocked' || (status === 'denied' && worst === 'granted')) {
        worst = status;
      }
    }
    return worst;
  } catch {
    return 'unavailable';
  }
};

export const isPermissionUsable = (status: MediaPermissionStatus): boolean =>
  status === 'granted' || status === 'limited';

export const requestCameraPermission = (
  includeAudio = false,
): Promise<MediaPermissionStatus> => ensure('camera', includeAudio);

export const requestGalleryPermission = (
  includeVideo = false,
): Promise<MediaPermissionStatus> => ensure('gallery', includeVideo);

export const openAppSettings = async (): Promise<void> => {
  try {
    await Linking.openSettings();
  } catch {
  }
};
