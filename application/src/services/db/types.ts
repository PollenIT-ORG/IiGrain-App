import type { DB, QueryResult, Scalar, Transaction } from '@op-engineering/op-sqlite';

export type { DB, QueryResult, Scalar, Transaction };

export type OwnerUserId = string & { readonly __ownerUserId: unique symbol };

export const asOwnerUserId = (value: string): OwnerUserId => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('owner_user_id must be a non-empty string.');
  }
  return trimmed as OwnerUserId;
};

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly up: (tx: Transaction) => Promise<void>;
}

export type JournalMode = 'wal' | 'delete' | 'truncate' | 'persist' | 'memory' | 'off';

export interface DatabaseStatus {
  readonly name: string;
  readonly location: string;
  readonly journalMode: JournalMode;
  readonly foreignKeys: boolean;
  readonly schemaVersion: number;
  readonly sqliteVersion: string;
}

export const SYNC_STATUSES = ['pending', 'processing', 'failed', 'completed'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const SYNC_OPERATIONS = ['create', 'update', 'delete'] as const;
export type SyncOperation = (typeof SYNC_OPERATIONS)[number];

export const RECORD_SYNC_STATES = [
  'local',
  'pending',
  'synced',
  'conflict',
  'failed',
] as const;
export type RecordSyncState = (typeof RECORD_SYNC_STATES)[number];

export const UPLOAD_STATUSES = ['local', 'pending', 'uploaded', 'failed'] as const;
export type UploadStatus = (typeof UPLOAD_STATUSES)[number];

export const AUTHOR_ROLES = ['farmer', 'assessor'] as const;
export type AuthorRole = (typeof AUTHOR_ROLES)[number];

export interface OwnedRow {
  readonly local_id: string;
  readonly server_id: string | null;
  readonly owner_user_id: string;
  readonly sync_state: RecordSyncState;
  readonly deleted_local: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly updated_at_local: string;
  readonly server_updated_at: string | null;
  readonly last_pulled_at: string | null;
}

export interface DbFarm extends OwnedRow {
  readonly name: string;
  readonly business_entity: string | null;
  readonly owner_name: string | null;
  readonly owner_email: string | null;
  readonly location: string | null;
  readonly address_resolved: number;
  readonly area_acres: number | null;
  readonly used_acres: number | null;
  readonly available_acres: number | null;
  readonly field_count: number;
  readonly status: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly org_id: string | null;
  readonly org_name: string | null;
}

export interface DbField extends OwnedRow {
  readonly farm_local_id: string;
  readonly name: string;
  readonly area_acres: number | null;
  readonly crop: string | null;
  readonly season: string | null;
  readonly irrigation: string | null;
  readonly location: string | null;
  readonly address_resolved: number;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly sowing_date: string | null;
  readonly expected_harvest: string | null;
  readonly status: string;
  readonly weather: string | null;
  readonly has_boundary: number;
  readonly boundary_updated_at: string | null;
}

export interface DbFieldBoundary {
  readonly field_local_id: string;
  readonly owner_user_id: string;
  readonly farm_local_id: string;
  readonly ring_json: string;
  readonly geojson: string;
  readonly area_sq_m: number;
  readonly center_lat: number;
  readonly center_lng: number;
  readonly bbox_min_lat: number;
  readonly bbox_min_lng: number;
  readonly bbox_max_lat: number;
  readonly bbox_max_lng: number;
  readonly version: number;
  readonly sync_state: RecordSyncState;
  readonly updated_at: string;
  readonly updated_at_local: string;
}

export interface DbFieldSoil {
  readonly field_local_id: string;
  readonly owner_user_id: string;
  readonly ph: number | null;
  readonly organic_matter: number | null;
  readonly nitrogen: number | null;
  readonly phosphorus: number | null;
  readonly potassium: number | null;
  readonly moisture: number | null;
  readonly texture: string | null;
  readonly notes: string | null;
  readonly tested_on: string | null;
  readonly locked: number;
  readonly sync_state: RecordSyncState;
  readonly updated_at_local: string;
  readonly last_pulled_at: string | null;
}

export interface DbProgram {
  readonly owner_user_id: string;
  readonly program_id: string;
  readonly name: string;
  readonly code: string | null;
  readonly description: string | null;
  readonly type: string | null;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly user_limit: number | null;
  readonly enrolled_count: number;
  readonly is_full: number;
  readonly already_enrolled: number;
  readonly can_enroll: number;
  readonly survey_url: string | null;
  readonly survey_acres: number | null;
  readonly last_pulled_at: string | null;
}

export interface DbProgramField {
  readonly owner_user_id: string;
  readonly program_id: string;
  readonly field_local_id: string;
  readonly enrolled: number;
  readonly last_pulled_at: string | null;
}

export interface DbAssessment extends OwnedRow {
  readonly program_id: string;
  readonly field_local_id: string;
  readonly author_role: AuthorRole;
  readonly title: string | null;
  readonly year: number | null;
  readonly status: string;
  readonly total_questions: number;
  readonly answered: number;
  readonly percentage: number;
  readonly submitted_at: string | null;
  readonly submit_pending: number;
  readonly locked: number;
}

export interface DbAssessmentCategory {
  readonly owner_user_id: string;
  readonly program_id: string;
  readonly category_id: string;
  readonly name: string;
  readonly total_questions: number;
  readonly display_order: number;
  readonly last_pulled_at: string | null;
}

export interface DbAssessmentQuestion {
  readonly owner_user_id: string;
  readonly question_id: string;
  readonly program_id: string;
  readonly category_id: string;
  readonly question_code: string | null;
  readonly question_text: string;
  readonly guidance_note: string | null;
  readonly score0_description: string | null;
  readonly score1_description: string | null;
  readonly score2_description: string | null;
  readonly score3_description: string | null;
  readonly display_order: number;
  readonly last_pulled_at: string | null;
}

export interface DbAssessmentAnswer extends OwnedRow {
  readonly assessment_local_id: string;
  readonly question_id: string;
  readonly field_local_id: string;
  readonly program_id: string;
  readonly author_role: AuthorRole;
  readonly score: number;
  readonly comment: string | null;
  readonly evidence_urls_json: string;
}

export interface DbMonitoringRecord extends OwnedRow {
  readonly field_local_id: string;
  readonly module: string;
  readonly status: string;
  readonly notes: string | null;
  readonly values_json: string;
}

export interface DbDocument extends OwnedRow {
  readonly field_local_id: string;
  readonly module: string | null;
  readonly record_local_id: string | null;
  readonly doc_kind: string | null;
  readonly name: string;
  readonly remote_url: string | null;
  readonly mime: string | null;
  readonly size_bytes: number | null;
  readonly uploaded_at: string | null;
  readonly media_local_id: string | null;
}

export interface DbMediaFile {
  readonly local_id: string;
  readonly server_id: string | null;
  readonly remote_url: string | null;
  readonly owner_user_id: string;
  readonly purpose: string;
  readonly attached_to_type: string | null;
  readonly attached_to_local_id: string | null;
  readonly file_path: string;
  readonly file_name: string;
  readonly mime: string | null;
  readonly size_bytes: number | null;
  readonly upload_status: UploadStatus;
  readonly retry_count: number;
  readonly last_error: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly context_json: string | null;
}

export interface DbUser {
  readonly local_id: string;
  readonly server_id: string | null;
  readonly email: string | null;
  readonly name: string | null;
  readonly role: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface DbSyncState {
  readonly id: number;
  readonly owner_user_id: string;
  readonly last_sync_started_at: string | null;
  readonly last_sync_completed_at: string | null;
  readonly last_sync_error: string | null;
  readonly status: SyncStatus;
  readonly updated_at: string;
}

export interface DbSyncQueueEntry {
  readonly id: number;
  readonly owner_user_id: string;
  readonly entity_type: string;
  readonly entity_local_id: string;
  readonly entity_server_id: string | null;
  readonly operation: SyncOperation;
  readonly payload_json: string | null;
  readonly idempotency_key: string;
  readonly status: SyncStatus;
  readonly attempt_count: number;
  readonly available_at: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly last_error: string | null;
  readonly depends_on_id: number | null;
  readonly claimed_at: string | null;
}
