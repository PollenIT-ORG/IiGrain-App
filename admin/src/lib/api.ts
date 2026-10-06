import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { API_BASE_URL } from "../config/apiConfig";

export const TOKEN_KEY = "farmer_admin_token";
export const REFRESH_TOKEN_KEY = "farmer_admin_refresh_token";
const USER_KEY = "farmer_admin_user";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export function setTokens(token: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function forceLogout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (window.location.pathname !== "/login") {
    // Survives the hard redirect so the login page can explain why the user
    // landed there instead of dropping them silently.
    sessionStorage.setItem("session_expired", "1");
    window.location.href = "/login";
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshWaiters: Array<(token: string | null) => void> = [];

function onRefreshed(token: string | null): void {
  refreshWaiters.forEach((cb) => cb(token));
  refreshWaiters = [];
}

const AUTH_FLOW_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/verify-otp",
  "/auth/request-otp",
  "/auth/refresh-token",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
  // A 401 here means "current password is wrong", not an expired session, so it
  // must not trigger a token refresh / retry (which double-fires the request and
  // can log the user out over a simple typo).
  "/profile/change-password",
];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const is401 = error.response?.status === 401;
    const isAuthFlow = AUTH_FLOW_PATHS.some((p) => original?.url?.includes(p));

    if (!is401 || !original || original._retry || isAuthFlow) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      forceLogout();
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshWaiters.push((newToken) => {
          if (newToken) {
            original.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(original));
          } else {
            reject(error);
          }
        });
      });
    }

    isRefreshing = true;
    try {
      const { data } = await axios.post<{ data: { token: string } }>(
        `${API_BASE_URL}/auth/refresh-token`,
        { refreshToken }
      );
      const newToken = data.data.token;
      localStorage.setItem(TOKEN_KEY, newToken);

      onRefreshed(newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshErr) {
      onRefreshed(null);
      forceLogout();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

/** Fetches a new access token with the refresh token. Resolves null when that is not possible. */
export function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(null);
  if (isRefreshing) {
    return new Promise((resolve) => refreshWaiters.push(resolve));
  }
  isRefreshing = true;
  return axios
    .post<{ data: { token: string } }>(`${API_BASE_URL}/auth/refresh-token`, { refreshToken })
    .then(({ data }) => {
      const newToken = data.data.token;
      localStorage.setItem(TOKEN_KEY, newToken);
      onRefreshed(newToken);
      return newToken;
    })
    .catch(() => {
      onRefreshed(null);
      return null;
    })
    .finally(() => {
      isRefreshing = false;
    });
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errors?: { message: string }[] }
      | undefined;
    if (data?.errors?.length) return data.errors[0].message;
    if (data?.message) return data.message;
    if (error.code === "ERR_NETWORK") {
      return "Cannot reach the server. Is the backend running?";
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export default api;
