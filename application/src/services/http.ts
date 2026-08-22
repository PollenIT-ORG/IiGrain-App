import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from 'axios';
import { Env } from '../config/env';
import { Endpoints, isPublicAuthPath } from '../config/endpoints';
import { tokenStorage } from './tokenStorage';
import { showError } from './errorService';
import { getApiMessage } from '../utils/getApiMessage';
import { accountRevocationFor } from '../utils/sessionGuards';
import { reauthSocket } from './socket';
import {
  logApiInit,
  logApiRequest,
  logApiResponse,
  logApiError,
} from '../utils/apiLogger';

declare module 'axios' {
  export interface AxiosRequestConfig {
    silent?: boolean;
    skipRetry?: boolean;
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null): void => {
  onUnauthorized = handler;
};

const http = axios.create({
  baseURL: Env.API_BASE_URL,
  timeout: Env.API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

logApiInit(Env.API_BASE_URL);

http.interceptors.request.use(async config => {
  const token = await tokenStorage.get();
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }

  if (config.data instanceof FormData) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Content-Type', 'multipart/form-data');
    config.headers = headers;
    config.transformRequest = data => data;
  }

  logApiRequest(config);
  return config;
});

type RetryableConfig = InternalAxiosRequestConfig & {
  _retryCount?: number;
  _refreshAttempted?: boolean;
  skipRetry?: boolean;
};
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 800;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

interface RefreshEnvelope {
  data?: { token?: string; refreshToken?: string };
}

const refreshClient = axios.create({
  baseURL: Env.API_BASE_URL,
  timeout: Env.API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<string | null> | null = null;

const performRefresh = async (): Promise<string | null> => {
  const refreshToken = await tokenStorage.getRefresh();
  if (!refreshToken) {
    return null;
  }
  try {
    const res = await refreshClient.post<RefreshEnvelope>(Endpoints.auth.refreshToken, {
      refreshToken,
    });
    const newAccess = res.data?.data?.token;
    if (!newAccess) {
      return null;
    }
    const rotated = res.data?.data?.refreshToken ?? refreshToken;
    await tokenStorage.save(newAccess, rotated);
    reauthSocket(newAccess);
    return newAccess;
  } catch {
    return null;
  }
};

const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

http.interceptors.response.use(
  response => {
    logApiResponse(response);
    return response;
  },
  async (error: AxiosError) => {
    const retryConfig = error.config as RetryableConfig | undefined;
    if (!error.response && retryConfig && !retryConfig.skipRetry) {
      retryConfig._retryCount = (retryConfig._retryCount ?? 0) + 1;
      if (retryConfig._retryCount <= MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * retryConfig._retryCount);
        return http(retryConfig);
      }
    }

    logApiError(error);

    const message = getApiMessage(error);
    error.message = message;

    const status = error.response?.status ?? null;
    const url = error.config?.url;
    const publicAuth = isPublicAuthPath(url);
    const silent = Boolean((error.config as RetryableConfig | undefined)?.silent);

    const revoked = accountRevocationFor(status, message);
    if (revoked && !publicAuth) {
      if (onUnauthorized) {
        onUnauthorized();
      }
      showError(error);
      return Promise.reject(error);
    }

    if (status === 401 && !publicAuth) {
      const original = error.config as RetryableConfig | undefined;
      if (original && !original._refreshAttempted) {
        original._refreshAttempted = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          const headers = AxiosHeaders.from(original.headers);
          headers.set('Authorization', `Bearer ${newToken}`);
          original.headers = headers;
          return http(original);
        }
      }

      if (onUnauthorized) {
        onUnauthorized();
      }
      showError(error);
      return Promise.reject(error);
    }

    if (publicAuth) {
      return Promise.reject(error);
    }

    if (!silent) {
      showError(error);
    }
    return Promise.reject(error);
  },
);

export default http;
