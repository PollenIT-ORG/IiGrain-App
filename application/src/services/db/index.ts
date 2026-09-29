import { getDatabase } from './database';
import { runTransactionOn } from './transaction';
import type { Transaction } from './types';

export {
  DATABASE_NAME,
  closeDatabase,
  databaseLocation,
  getDatabase,
  getDatabaseStatus,
  getSchemaVersion,
  initializeDatabase,
  isDatabaseReady,
} from './database';

export { LATEST_SCHEMA_VERSION, MIGRATIONS } from './migrations';

export { runTransactionOn } from './transaction';

export { newIdempotencyKey, newLocalId, nowIso } from './ids';

export {
  AUTHOR_ROLES,
  RECORD_SYNC_STATES,
  SYNC_OPERATIONS,
  SYNC_STATUSES,
  UPLOAD_STATUSES,
  asOwnerUserId,
} from './types';

export type {
  AuthorRole,
  DatabaseStatus,
  DbAssessment,
  DbAssessmentAnswer,
  DbAssessmentCategory,
  DbAssessmentQuestion,
  DbDocument,
  DbFarm,
  DbField,
  DbFieldBoundary,
  DbFieldSoil,
  DbMediaFile,
  DbMonitoringRecord,
  DbProgram,
  DbProgramField,
  DbSyncQueueEntry,
  DbSyncState,
  DbUser,
  JournalMode,
  Migration,
  OwnedRow,
  OwnerUserId,
  RecordSyncState,
  SyncOperation,
  SyncStatus,
  UploadStatus,
} from './types';

export const runTransaction = <T>(work: (tx: Transaction) => Promise<T>): Promise<T> =>
  runTransactionOn(getDatabase(), work);
