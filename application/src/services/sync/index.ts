export {
  createManualConnectivity,
  offlineConnectivity,
  optimisticConnectivity,
} from './connectivity';

export { assessmentAnswerAdapter } from './adapters/assessmentAnswerAdapter';
export {
  ASSESSMENT_SUBMIT_ENTITY_TYPE,
  assessmentSubmitAdapter,
} from './adapters/assessmentSubmitAdapter';
export { farmAdapter } from './adapters/farmAdapter';
export { fieldAdapter } from './adapters/fieldAdapter';
export {
  PROGRAMS_SCOPE,
  clearSnapshots,
  readSnapshot,
  saveSnapshot,
} from './dashboardCache';
export type { CachedSnapshot } from './dashboardCache';

export { fieldBoundaryAdapter } from './adapters/fieldBoundaryAdapter';
export { fieldSoilAdapter } from './adapters/fieldSoilAdapter';
export { monitoringAdapter } from './adapters/monitoringAdapter';
export { mediaAdapter } from './adapters/mediaAdapter';

export {
  DRAFT_RETENTION_MS,
  MEDIA_DRAFT_TYPE,
  MEDIA_ENTITY_TYPE,
  captureMedia,
  commitMedia,
  discardMedia,
  listDraftMedia,
  listUnsentMediaFor,
  outboxDirFor,
  purgeAbandonedDrafts,
  reconcileMediaFiles,
} from './mediaOutbox';
export type {
  MediaCaptureFile,
  MediaCaptureInput,
  MediaCommitInput,
  MediaContextValue,
} from './mediaOutbox';

export {
  createFarmOffline,
  createFieldOffline,
  createMonitoringOffline,
  deleteFarmOffline,
  deleteFieldOffline,
  deleteMonitoringOffline,
  pendingCreateEntryId,
  removeBoundaryOffline,
  saveBoundaryOffline,
  saveSoilOffline,
  saveAnswerOffline,
  submitAssessmentOffline,
  updateFarmOffline,
  updateFieldOffline,
  updateMonitoringOffline,
} from './domainWrites';

export { ENTITY_TYPES, repositoryEntityWriter, repositoryFor } from './entityRegistry';
export type { EntityType } from './entityRegistry';

export {
  BACKOFF_FACTOR,
  BASE_DELAY_MS,
  JITTER_RATIO,
  MAX_ATTEMPTS,
  MAX_DELAY_MS,
  STALE_CLAIM_MS,
  backoffDelayMs,
  classifyFailure,
  hasAttemptsLeft,
  isStaleClaim,
  nextAvailableAt,
} from './retryPolicy';

export { createSyncEngine, DEFAULT_MAX_ITEMS_PER_FLUSH } from './syncEngine';
export type { SyncEngine, SyncEngineOptions } from './syncEngine';

export { createNetInfoConnectivity, isStateOnline, netInfoConnectivity } from './netInfoConnectivity';

export { clearOwner, establishOwner, resolveOwner } from './ownerSession';

export {
  createSyncSubsystem,
  getSyncSubsystem,
  resetSyncSubsystem,
} from './syncBootstrap';
export type { SyncSubsystem, SyncSubsystemOptions } from './syncBootstrap';

export { createSyncHttpClient, syncHttp } from './syncHttp';

export { notifySyncQueueChanged, subscribeToSyncQueue } from './syncEvents';

export { logSync, setSyncLogSink } from './syncLogger';
export type { SyncLogEvent, SyncLogFields } from './syncLogger';

import * as syncQueue from './syncQueueRepository';

export { syncQueue };

export type {
  ConnectivityProvider,
  DbSyncQueueEntry,
  DomainSyncAdapter,
  EnqueueInput,
  EnqueueOutcome,
  EntitySyncWriter,
  FlushResult,
  FlushStopReason,
  SyncAdapterContext,
  SyncAdapterResult,
  SyncFailure,
  SyncFailureKind,
  SyncOperation,
  SyncStatus,
} from './types';
