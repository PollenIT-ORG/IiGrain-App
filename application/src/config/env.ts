import { API_BASE_URL, API_PREFIX, API_TIMEOUT , MAPS_API_KEY} from '@env';

const REMOTE_HOST = 'https://api.farmer.tcqitsolution.com';

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const resolveTimeout = (raw: string | undefined): number => {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
};

const HOST = stripTrailingSlash((API_BASE_URL ?? '').trim() || REMOTE_HOST);
const PREFIX = (API_PREFIX ?? '').trim() || '/api/v1';

export interface AppEnv {
  readonly API_HOST: string;
  readonly API_PREFIX: string;
  readonly API_BASE_URL: string;
  readonly API_TIMEOUT: number;
  readonly IS_DEV: boolean;
  /**
   * Google Maps Platform key, used from JS ONLY for the Directions API
   * (see src/maps/services/directionsService.ts).
   *
   * The map tiles themselves never read this value: the native SDKs are keyed
   * at build time through the AndroidManifest / Info.plist, because they are
   * initialised before the JS bundle exists. Empty string when unset — callers
   * must degrade gracefully rather than assume a key is present.
   */
  readonly MAPS_API_KEY: string;
}

export const Env: AppEnv = Object.freeze({
  API_HOST: HOST,
  API_PREFIX: PREFIX,
  API_BASE_URL: `${HOST}${PREFIX}`,
  API_TIMEOUT: resolveTimeout(API_TIMEOUT),
  IS_DEV: __DEV__,
  MAPS_API_KEY: (MAPS_API_KEY ?? '').trim(),
});