import { MAPS_API_KEY_ANDROID, MAPS_API_KEY_IOS } from '@env';
import { Platform } from 'react-native';

const LOG_TAG = 'CHECK_KEYS_POINTS';
const MASK_HEAD = 8;
const MASK_TAIL = 4;

const mask = (raw: string | undefined): string => {
  const key = (raw ?? '').trim();
  if (!key) {
    return '(EMPTY)';
  }
  if (key.length <= MASK_HEAD + MASK_TAIL) {
    return '****';
  }
  return `${key.slice(0, MASK_HEAD)}…${key.slice(-MASK_TAIL)} (len ${key.length})`;
};

export const logMapKeysDevOnly = (screen: string): void => {
  if (!__DEV__) {
    return;
  }
  const nativeKey = Platform.OS === 'ios' ? MAPS_API_KEY_IOS : MAPS_API_KEY_ANDROID;
  console.log(
    [
      `${LOG_TAG} screen=${screen} platform=${Platform.OS}`,
      `${LOG_TAG}   native map SDK key (${Platform.OS === 'ios' ? 'MAPS_API_KEY_IOS' : 'MAPS_API_KEY_ANDROID'}): ${mask(nativeKey)}`,
      `${LOG_TAG}   MAPS_API_KEY_ANDROID: ${mask(MAPS_API_KEY_ANDROID)}`,
      `${LOG_TAG}   MAPS_API_KEY_IOS: ${mask(MAPS_API_KEY_IOS)}`,
    ].join('\n'),
  );
};
