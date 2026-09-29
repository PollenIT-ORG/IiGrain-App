import { newLocalId, nowIso } from '../services/db/ids';
import type { OwnedRow, OwnerUserId, RecordSyncState } from '../services/db/types';
import {
  execute,
  queryAll,
  queryCount,
  queryOne,
  requireOwner,
  type ColumnValue,
} from './ownerScope';

const DIRTY_STATES: readonly RecordSyncState[] = ['local', 'pending', 'conflict', 'failed'];

export interface ListOptions {
  readonly includeDeleted?: boolean;
  readonly orderBy?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface OwnedRepositoryConfig {
  readonly table: string;
  readonly columns: readonly string[];
  readonly defaultOrderBy?: string;
}

export type ColumnValues = Readonly<Record<string, ColumnValue>>;

export interface OwnedRepository<TRow extends OwnedRow> {
  readonly table: string;
  create(owner: OwnerUserId, values: ColumnValues, localId?: string): Promise<TRow>;
  update(owner: OwnerUserId, localId: string, patch: ColumnValues): Promise<TRow | null>;
  getByLocalId(owner: OwnerUserId, localId: string): Promise<TRow | null>;
  getByServerId(owner: OwnerUserId, serverId: string): Promise<TRow | null>;
  list(owner: OwnerUserId, options?: ListOptions): Promise<TRow[]>;
  listWhere(
    owner: OwnerUserId,
    clause: string,
    params?: readonly ColumnValue[],
    options?: ListOptions,
  ): Promise<TRow[]>;
  count(owner: OwnerUserId, options?: ListOptions): Promise<number>;
  softDelete(owner: OwnerUserId, localId: string): Promise<boolean>;
  hardDelete(owner: OwnerUserId, localId: string): Promise<boolean>;
  setServerId(owner: OwnerUserId, localId: string, serverId: string): Promise<void>;
  setSyncState(
    owner: OwnerUserId,
    localId: string,
    state: RecordSyncState,
  ): Promise<void>;
  markSynced(
    owner: OwnerUserId,
    localId: string,
    serverUpdatedAt?: string | null,
  ): Promise<void>;
  listDirty(owner: OwnerUserId): Promise<TRow[]>;
  upsertFromServer(
    owner: OwnerUserId,
    serverId: string,
    values: ColumnValues,
    serverUpdatedAt?: string | null,
  ): Promise<TRow>;
}

const assertKnownColumns = (
  config: OwnedRepositoryConfig,
  values: ColumnValues,
): void => {
  for (const key of Object.keys(values)) {
    if (!config.columns.includes(key)) {
      throw new Error(`Unknown column "${key}" for table ${config.table}.`);
    }
  }
};

export const createOwnedRepository = <TRow extends OwnedRow>(
  config: OwnedRepositoryConfig,
): OwnedRepository<TRow> => {
  const { table } = config;
  const order = config.defaultOrderBy ?? 'updated_at_local DESC';

  const deletedClause = (options?: ListOptions): string =>
    options?.includeDeleted ? '' : ' AND deleted_local = 0';

  const tail = (options?: ListOptions): string => {
    const parts = [`ORDER BY ${options?.orderBy ?? order}`];
    if (typeof options?.limit === 'number') {
      parts.push(`LIMIT ${Math.max(0, Math.trunc(options.limit))}`);
      if (typeof options?.offset === 'number') {
        parts.push(`OFFSET ${Math.max(0, Math.trunc(options.offset))}`);
      }
    }
    return parts.join(' ');
  };

  const getByLocalId = async (
    owner: OwnerUserId,
    localId: string,
  ): Promise<TRow | null> =>
    queryOne<TRow>(
      `SELECT * FROM ${table} WHERE owner_user_id = ? AND local_id = ?`,
      [requireOwner(owner), localId],
    );

  const repository: OwnedRepository<TRow> = {
    table,

    async create(owner, values, localId) {
      assertKnownColumns(config, values);
      const ownerId = requireOwner(owner);
      const id = localId ?? newLocalId();
      const timestamp = nowIso();

      const columns = ['local_id', 'owner_user_id', ...Object.keys(values)];
      const params: ColumnValue[] = [id, ownerId, ...Object.values(values)];

      columns.push(
        'sync_state',
        'deleted_local',
        'created_at',
        'updated_at',
        'updated_at_local',
      );
      params.push('local', 0, timestamp, timestamp, timestamp);

      const placeholders = columns.map(() => '?').join(', ');
      await execute(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        params,
      );

      const created = await getByLocalId(owner, id);
      if (!created) {
        throw new Error(`Failed to read back the created ${table} row.`);
      }
      return created;
    },

    async update(owner, localId, patch) {
      assertKnownColumns(config, patch);
      const ownerId = requireOwner(owner);
      const entries = Object.entries(patch);
      const timestamp = nowIso();

      const assignments = entries.map(([column]) => `${column} = ?`);
      assignments.push('updated_at_local = ?', 'updated_at = ?');
      assignments.push(
        "sync_state = CASE WHEN sync_state = 'synced' THEN 'local' ELSE sync_state END",
      );

      const params: ColumnValue[] = [
        ...entries.map(([, value]) => value),
        timestamp,
        timestamp,
        ownerId,
        localId,
      ];

      const result = await execute(
        `UPDATE ${table} SET ${assignments.join(', ')} WHERE owner_user_id = ? AND local_id = ?`,
        params,
      );
      if (result.rowsAffected === 0) {
        return null;
      }
      return getByLocalId(owner, localId);
    },

    getByLocalId,

    async getByServerId(owner, serverId) {
      return queryOne<TRow>(
        `SELECT * FROM ${table} WHERE owner_user_id = ? AND server_id = ?`,
        [requireOwner(owner), serverId],
      );
    },

    async list(owner, options) {
      return queryAll<TRow>(
        `SELECT * FROM ${table} WHERE owner_user_id = ?${deletedClause(options)} ${tail(
          options,
        )}`,
        [requireOwner(owner)],
      );
    },

    async listWhere(owner, clause, params = [], options) {
      return queryAll<TRow>(
        `SELECT * FROM ${table} WHERE owner_user_id = ?${deletedClause(
          options,
        )} AND (${clause}) ${tail(options)}`,
        [requireOwner(owner), ...params],
      );
    },

    async count(owner, options) {
      return queryCount(
        `SELECT COUNT(*) FROM ${table} WHERE owner_user_id = ?${deletedClause(options)}`,
        [requireOwner(owner)],
      );
    },

    async softDelete(owner, localId) {
      const timestamp = nowIso();
      const result = await execute(
        `UPDATE ${table}
            SET deleted_local = 1,
                updated_at_local = ?,
                sync_state = CASE WHEN sync_state = 'synced' THEN 'local' ELSE sync_state END
          WHERE owner_user_id = ? AND local_id = ?`,
        [timestamp, requireOwner(owner), localId],
      );
      return result.rowsAffected > 0;
    },

    async hardDelete(owner, localId) {
      const result = await execute(
        `DELETE FROM ${table} WHERE owner_user_id = ? AND local_id = ?`,
        [requireOwner(owner), localId],
      );
      return result.rowsAffected > 0;
    },

    async setServerId(owner, localId, serverId) {
      await execute(
        `UPDATE ${table} SET server_id = ?, updated_at_local = ? WHERE owner_user_id = ? AND local_id = ?`,
        [serverId, nowIso(), requireOwner(owner), localId],
      );
    },

    async setSyncState(owner, localId, state) {
      await execute(
        `UPDATE ${table} SET sync_state = ?, updated_at_local = ? WHERE owner_user_id = ? AND local_id = ?`,
        [state, nowIso(), requireOwner(owner), localId],
      );
    },

    async markSynced(owner, localId, serverUpdatedAt) {
      const timestamp = nowIso();
      await execute(
        `UPDATE ${table}
            SET sync_state = 'synced',
                server_updated_at = ?,
                last_pulled_at = ?,
                updated_at_local = ?
          WHERE owner_user_id = ? AND local_id = ?`,
        [serverUpdatedAt ?? timestamp, timestamp, timestamp, requireOwner(owner), localId],
      );
    },

    async listDirty(owner) {
      const placeholders = DIRTY_STATES.map(() => '?').join(', ');
      return queryAll<TRow>(
        `SELECT * FROM ${table}
          WHERE owner_user_id = ? AND sync_state IN (${placeholders})
          ORDER BY updated_at_local ASC`,
        [requireOwner(owner), ...DIRTY_STATES],
      );
    },

    async upsertFromServer(owner, serverId, values, serverUpdatedAt) {
      assertKnownColumns(config, values);
      const ownerId = requireOwner(owner);
      const timestamp = nowIso();
      const existing = await repository.getByServerId(owner, serverId);

      if (!existing) {
        const id = newLocalId();
        const columns = ['local_id', 'owner_user_id', 'server_id', ...Object.keys(values)];
        const params: ColumnValue[] = [id, ownerId, serverId, ...Object.values(values)];
        columns.push(
          'sync_state',
          'deleted_local',
          'created_at',
          'updated_at',
          'updated_at_local',
          'server_updated_at',
          'last_pulled_at',
        );
        params.push(
          'synced',
          0,
          timestamp,
          timestamp,
          timestamp,
          serverUpdatedAt ?? timestamp,
          timestamp,
        );
        const placeholders = columns.map(() => '?').join(', ');
        await execute(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          params,
        );
        const created = await getByLocalId(owner, id);
        if (!created) {
          throw new Error(`Failed to read back the pulled ${table} row.`);
        }
        return created;
      }

      if (DIRTY_STATES.includes(existing.sync_state)) {
        await execute(
          `UPDATE ${table}
              SET sync_state = 'conflict', server_updated_at = ?, last_pulled_at = ?
            WHERE owner_user_id = ? AND local_id = ?`,
          [serverUpdatedAt ?? timestamp, timestamp, ownerId, existing.local_id],
        );
        const conflicted = await getByLocalId(owner, existing.local_id);
        if (!conflicted) {
          throw new Error(`Failed to read back the conflicted ${table} row.`);
        }
        return conflicted;
      }

      const entries = Object.entries(values);
      const assignments = entries.map(([column]) => `${column} = ?`);
      assignments.push(
        "sync_state = 'synced'",
        'server_updated_at = ?',
        'last_pulled_at = ?',
        'updated_at_local = ?',
        'updated_at = ?',
      );
      const params: ColumnValue[] = [
        ...entries.map(([, value]) => value),
        serverUpdatedAt ?? timestamp,
        timestamp,
        timestamp,
        timestamp,
        ownerId,
        existing.local_id,
      ];
      await execute(
        `UPDATE ${table} SET ${assignments.join(', ')} WHERE owner_user_id = ? AND local_id = ?`,
        params,
      );
      const updated = await getByLocalId(owner, existing.local_id);
      if (!updated) {
        throw new Error(`Failed to read back the pulled ${table} row.`);
      }
      return updated;
    },
  };

  return repository;
};
