import {
  AxiosError,
  AxiosHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { getApiMessage } from './getApiMessage';

export const ENABLE_API_LOGGER: boolean = __DEV__;

const MASK = '************';
const BEARER_MASK = 'Bearer ************';

const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'password',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'otp',
  'code',
  'pin',
  'secret',
  'apikey',
  'api_key',
]);

const SENSITIVE_HEADERS: ReadonlySet<string> = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-refresh-token',
  'x-access-token',
  'x-api-key',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSensitiveKey = (key: string): boolean =>
  SENSITIVE_KEYS.has(key.toLowerCase());

const maskSensitive = (value: unknown): string =>
  typeof value === 'string' && value.toLowerCase().startsWith('bearer ')
    ? BEARER_MASK
    : MASK;

const maskDeep = (input: unknown, seen: WeakSet<object> = new WeakSet()): unknown => {
  if (Array.isArray(input)) {
    if (seen.has(input)) {
      return '[Circular]';
    }
    seen.add(input);
    return input.map(item => maskDeep(item, seen));
  }
  if (isRecord(input)) {
    if (seen.has(input)) {
      return '[Circular]';
    }
    seen.add(input);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input)) {
      out[key] = isSensitiveKey(key)
        ? maskSensitive(input[key])
        : maskDeep(input[key], seen);
    }
    return out;
  }
  return input;
};

const maskHeaders = (
  headers: InternalAxiosRequestConfig['headers'],
): Record<string, string> => {
  const flat = AxiosHeaders.from(headers ?? {}).toJSON() as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const name of Object.keys(flat)) {
    const value = flat[name];
    if (value === undefined || value === null) {
      continue;
    }
    out[name] = SENSITIVE_HEADERS.has(name.toLowerCase())
      ? maskSensitive(value)
      : String(value);
  }
  return out;
};

const groupStart = (title: string): void => {
  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(title);
  } else {
    console.log(title);
  }
};

const groupEnd = (): void => {
  if (typeof console.groupEnd === 'function') {
    console.groupEnd();
  }
};

const printTable = (data: unknown): void => {
  if (typeof console.table === 'function') {
    console.table(data);
  } else {
    console.log(data);
  }
};

const LABEL_WIDTH = 9;
const line = (label: string, value: unknown): void =>
  console.log(`${label.padEnd(LABEL_WIDTH)}:`, value);

const hasKeys = (value: unknown): boolean =>
  isRecord(value) && Object.keys(value).length > 0;

interface RequestMeta {
  readonly start: number;
  readonly timerLabel: string;
}

const metaStore = new WeakMap<object, RequestMeta>();
let sequence = 0;
const nextId = (): number => (sequence = (sequence + 1) % 100000);

type TimerFn = (label?: string) => void;
const consoleTimer = console as unknown as {
  time?: TimerFn;
  timeEnd?: TimerFn;
};

const startTimer = (label: string): void => {
  try {
    consoleTimer.time?.(label);
  } catch {
    /* no console.time here; duration still comes from `start` */
  }
};

const stopTimer = (label: string): void => {
  try {
    consoleTimer.timeEnd?.(label);
  } catch {
    /* timer was never started or runtime lacks console.timeEnd */
  }
};

const formatClock = (date: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const hours24 = date.getHours();
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${pad(hours12)}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${ampm}`;
};

const readMeta = (config: object | undefined): RequestMeta | null => {
  if (!config) {
    return null;
  }
  const meta = metaStore.get(config);
  if (meta) {
    metaStore.delete(config);
  }
  return meta ?? null;
};

export const logApiInit = (baseURL: string): void => {
  if (!ENABLE_API_LOGGER) {
    return;
  }
  console.log(`[apiLogger] enabled - baseURL = ${baseURL}`);
};

export const logApiRequest = (config: InternalAxiosRequestConfig): void => {
  if (!ENABLE_API_LOGGER) {
    return;
  }

  const method = (config.method ?? 'GET').toUpperCase();
  const url = config.url ?? '';
  const timerLabel = `API #${nextId()} ${method} ${url}`;
  metaStore.set(config, { start: Date.now(), timerLabel });
  startTimer(timerLabel);

  groupStart(`API REQUEST ${method} ${url}`);
  line('METHOD', method);
  line('BASE URL', config.baseURL ?? '');
  line('URL', url);
  line('FULL URL', `${config.baseURL ?? ''}${url}`);
  line('TIME', formatClock(new Date()));

  const headers = maskHeaders(config.headers);
  if (hasKeys(headers)) {
    console.log('HEADERS');
    printTable(headers);
  }

  if (hasKeys(config.params)) {
    console.log('QUERY PARAMS');
    printTable(maskDeep(config.params));
  }

  if (config.data !== undefined) {
    console.log('BODY');
    console.log(config.data instanceof FormData ? '[FormData]' : maskDeep(config.data));
  }

  groupEnd();
};

export const logApiResponse = (response: AxiosResponse): void => {
  if (!ENABLE_API_LOGGER) {
    return;
  }

  const meta = readMeta(response.config);
  if (meta) {
    stopTimer(meta.timerLabel);
  }
  const duration = meta ? Date.now() - meta.start : null;
  const url = response.config?.url ?? '';
  const success = response.status >= 200 && response.status < 300;

  groupStart(
    `${success ? 'OK' : 'WARN'} API RESPONSE ${response.status} ${url}` +
      (duration !== null ? `  (${duration} ms)` : ''),
  );
  line('STATUS', response.status);
  line('URL', url);
  line('DURATION', duration !== null ? `${duration} ms` : 'n/a');
  line('SUCCESS', success);

  const message = isRecord(response.data) ? response.data.message : undefined;
  if (typeof message === 'string' && message.trim()) {
    line('MESSAGE', message);
  }

  if (response.data !== undefined) {
    console.log('BODY');
    console.log(maskDeep(response.data));
  }

  groupEnd();
};

export const logApiError = (error: AxiosError): void => {
  if (!ENABLE_API_LOGGER) {
    return;
  }

  const meta = readMeta(error.config);
  if (meta) {
    stopTimer(meta.timerLabel);
  }
  const duration = meta ? Date.now() - meta.start : null;

  const isTimeout = error.code === 'ECONNABORTED' || /timeout/i.test(error.message ?? '');
  const isNetwork = !error.response && !isTimeout;
  const status: string | number = error.response?.status ?? (isTimeout ? 'TIMEOUT' : 'NETWORK');
  const url = error.config?.url ?? '';
  const body = error.response?.data;
  const validation = isRecord(body) ? body.errors : undefined;

  groupStart(
    `API ERROR ${status} ${url}` + (duration !== null ? `  (${duration} ms)` : ''),
  );
  line('STATUS', status);
  line('URL', url);
  line('DURATION', duration !== null ? `${duration} ms` : 'n/a');
  line('MESSAGE', getApiMessage(error));
  line('TYPE', isTimeout ? 'timeout' : isNetwork ? 'network' : 'server');
  line('NETWORK', isNetwork);
  line('TIMEOUT', isTimeout);

  if (validation !== undefined) {
    console.log('VALIDATION ERRORS');
    console.log(maskDeep(validation));
  }

  if (body !== undefined) {
    console.log('BODY');
    console.log(maskDeep(body));
  }

  groupEnd();
};
