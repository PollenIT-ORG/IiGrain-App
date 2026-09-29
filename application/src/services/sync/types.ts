import type {
  DbSyncQueueEntry,
  OwnerUserId,
  SyncOperation,
  SyncStatus,
} from '../db/types';

export type { DbSyncQueueEntry, SyncOperation, SyncStatus };

export type SyncFailureKind = 'retryable' | 'permanent' | 'auth' | 'offline';

export interface SyncFailure {
  readonly kind: SyncFailureKind;
  readonly message: string;
  readonly status: number | null;
}

export interface SyncAdapterResult {
  readonly serverId?: string | null;
  readonly serverUpdatedAt?: string | null;
}

export interface SyncAdapterContext {
  readonly ownerUserId: OwnerUserId;
  readonly entry: DbSyncQueueEntry;
  resolveServerId(entityType: string, entityLocalId: string): Promise<string | null>;
}

export interface DomainSyncAdapter {
  readonly entityType: string;
  create?(context: SyncAdapterContext): Promise<SyncAdapterResult>;
  update?(context: SyncAdapterContext): Promise<SyncAdapterResult>;
  delete?(context: SyncAdapterContext): Promise<SyncAdapterResult>;
  verifyCreated?(context: SyncAdapterContext): Promise<SyncAdapterResult | null>;
}

export interface EntitySyncWriter {
  applyServerId(
    ownerUserId: OwnerUserId,
    entityType: string,
    entityLocalId: string,
    serverId: string,
  ): Promise<void>;
  markSynced(
    ownerUserId: OwnerUserId,
    entityType: string,
    entityLocalId: string,
    serverUpdatedAt: string | null,
  ): Promise<void>;
  readServerId(
    ownerUserId: OwnerUserId,
    entityType: string,
    entityLocalId: string,
  ): Promise<string | null>;
}

export interface ConnectivityProvider {
  isOnline(): Promise<boolean>;
  subscribe?(listener: (online: boolean) => void): () => void;
}

export type FlushStopReason =
  | 'drained'
  | 'offline'
  | 'auth_required'
  | 'busy'
  | 'max_items'
  | 'no_adapter';

export interface FlushResult {
  readonly attempted: number;
  readonly succeeded: number;
  readonly retried: number;
  readonly failed: number;
  readonly blocked: number;
  readonly stoppedBecause: FlushStopReason;
}

export interface EnqueueInput {
  readonly entityType: string;
  readonly entityLocalId: string;
  readonly operation: SyncOperation;
  readonly entityServerId?: string | null;
  readonly payloadJson?: string | null;
  readonly dependsOnId?: number | null;
}

export type EnqueueOutcome =
  | { readonly kind: 'inserted'; readonly entry: DbSyncQueueEntry }
  | { readonly kind: 'coalesced'; readonly entry: DbSyncQueueEntry }
  | { readonly kind: 'annihilated'; readonly removedId: number };
