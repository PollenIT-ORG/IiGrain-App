import { Env } from '../../config/env';

export type SyncLogEvent =
  | 'flush_started'
  | 'flush_skipped_offline'
  | 'flush_completed'
  | 'entry_claimed'
  | 'request_started'
  | 'request_succeeded'
  | 'retry_scheduled'
  | 'permanent_failure'
  | 'dependency_blocked'
  | 'stale_in_flight_recovered'
  | 'auth_required'
  | 'adapter_missing'
  | 'package_prepared'
  | 'package_unavailable';

export interface SyncLogFields {
  readonly entryId?: number;
  readonly entityType?: string;
  readonly operation?: string;
  readonly status?: string;
  readonly attempt?: number;
  readonly httpStatus?: number | null;
  readonly count?: number;
  readonly reason?: string;
}

const SAFE_KEYS: readonly (keyof SyncLogFields)[] = [
  'entryId',
  'entityType',
  'operation',
  'status',
  'attempt',
  'httpStatus',
  'count',
  'reason',
];

type Sink = (event: SyncLogEvent, fields: SyncLogFields) => void;

const defaultSink: Sink = (event, fields) => {
  if (Env.IS_DEV) {
    console.log(`[sync] ${event}`, fields);
  }
};

let sink: Sink = defaultSink;

export const setSyncLogSink = (next: Sink | null): void => {
  sink = next ?? defaultSink;
};

export const logSync = (event: SyncLogEvent, fields: SyncLogFields = {}): void => {
  const safe: Record<string, unknown> = {};
  for (const key of SAFE_KEYS) {
    const value = fields[key];
    if (value !== undefined) {
      safe[key] = value;
    }
  }
  sink(event, safe as SyncLogFields);
};
