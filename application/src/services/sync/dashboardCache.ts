import { nowIso } from '../db/ids';
import type { OwnerUserId } from '../db/types';
import { execute, queryOne, requireOwner } from '../../repositories/ownerScope';

export const PROGRAMS_SCOPE = '__programs__';

interface SnapshotRow {
  readonly payload_json: string;
  readonly captured_at: string;
}

export interface CachedSnapshot<T> {
  readonly payload: T;
  readonly capturedAt: string;
}

const scopeYear = (year?: number | null): number =>
  typeof year === 'number' && Number.isFinite(year) ? year : 0;

export const saveSnapshot = async (
  owner: OwnerUserId,
  scope: string,
  payload: unknown,
  year?: number | null,
): Promise<void> => {
  await execute(
    `INSERT INTO dashboard_snapshots
       (owner_user_id, scope, year, payload_json, captured_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (owner_user_id, scope, year) DO UPDATE SET
       payload_json = excluded.payload_json,
       captured_at  = excluded.captured_at`,
    [requireOwner(owner), scope, scopeYear(year), JSON.stringify(payload), nowIso()],
  );
};

export const readSnapshot = async <T>(
  owner: OwnerUserId,
  scope: string,
  year?: number | null,
): Promise<CachedSnapshot<T> | null> => {
  const row = await queryOne<SnapshotRow>(
    `SELECT payload_json, captured_at FROM dashboard_snapshots
      WHERE owner_user_id = ? AND scope = ? AND year = ?`,
    [requireOwner(owner), scope, scopeYear(year)],
  );
  if (!row) {
    return null;
  }
  try {
    return {
      payload: JSON.parse(row.payload_json) as T,
      capturedAt: row.captured_at,
    };
  } catch {
    return null;
  }
};

export const clearSnapshots = async (owner: OwnerUserId): Promise<number> => {
  const result = await execute(
    'DELETE FROM dashboard_snapshots WHERE owner_user_id = ?',
    [requireOwner(owner)],
  );
  return result.rowsAffected;
};
