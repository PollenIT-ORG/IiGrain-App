import { API_BASE_URL, API_PREFIX, API_TIMEOUT } from '@env';

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
}

export const Env: AppEnv = Object.freeze({
  API_HOST: HOST,
  API_PREFIX: PREFIX,
  API_BASE_URL: `${HOST}${PREFIX}`,
  API_TIMEOUT: resolveTimeout(API_TIMEOUT),
  IS_DEV: __DEV__,
});
