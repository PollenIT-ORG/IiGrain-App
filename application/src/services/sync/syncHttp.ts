import axios, { AxiosHeaders, type AxiosInstance, type AxiosError } from 'axios';
import { Env } from '../../config/env';
import { refreshAccessToken } from '../http';
import { tokenStorage } from '../tokenStorage';

type RetriableConfig = { _syncRefreshAttempted?: boolean };

export const createSyncHttpClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: Env.API_BASE_URL,
    timeout: Env.API_TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use(async config => {
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
    return config;
  });

  client.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
      if (error.response?.status !== 401) {
        return Promise.reject(error);
      }

      const original = error.config as (typeof error.config & RetriableConfig) | undefined;
      if (!original || original._syncRefreshAttempted) {
        return Promise.reject(error);
      }

      original._syncRefreshAttempted = true;
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        return Promise.reject(error);
      }

      const headers = AxiosHeaders.from(original.headers);
      headers.set('Authorization', `Bearer ${refreshed}`);
      original.headers = headers;
      return client(original);
    },
  );

  return client;
};

export const syncHttp = createSyncHttpClient();
