import { nowIso } from '../services/db/ids';
import type {
  DbFieldSoil,
  OwnerUserId,
  RecordSyncState,
} from '../services/db/types';
import { execute, queryAll, queryOne, requireOwner } from './ownerScope';

export interface SoilInput {
  readonly ph?: number | null;
  readonly organicMatter?: number | null;
  readonly nitrogen?: number | null;
  readonly phosphorus?: number | null;
  readonly potassium?: number | null;
  readonly moisture?: number | null;
  readonly texture?: string | null;
  readonly notes?: string | null;
  readonly testedOn?: string | null;
}

export const getSoil = (
  owner: OwnerUserId,
  fieldLocalId: string,
): Promise<DbFieldSoil | null> =>
  queryOne<DbFieldSoil>(
    'SELECT * FROM field_soil WHERE owner_user_id = ? AND field_local_id = ?',
    [requireOwner(owner), fieldLocalId],
  );

export const saveSoil = async (
  owner: OwnerUserId,
  fieldLocalId: string,
  input: SoilInput,
): Promise<DbFieldSoil> => {
  const ownerId = requireOwner(owner);
  const timestamp = nowIso();

  await execute(
    `INSERT INTO field_soil
       (field_local_id, owner_user_id, ph, organic_matter, nitrogen, phosphorus,
        potassium, moisture, texture, notes, tested_on, locked, sync_state, updated_at_local)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'local', ?)
     ON CONFLICT (field_local_id) DO UPDATE SET
       ph = excluded.ph,
       organic_matter = excluded.organic_matter,
       nitrogen = excluded.nitrogen,
       phosphorus = excluded.phosphorus,
       potassium = excluded.potassium,
       moisture = excluded.moisture,
       texture = excluded.texture,
       notes = excluded.notes,
       tested_on = excluded.tested_on,
       sync_state = 'local',
       updated_at_local = excluded.updated_at_local`,
    [
      fieldLocalId,
      ownerId,
      input.ph ?? null,
      input.organicMatter ?? null,
      input.nitrogen ?? null,
      input.phosphorus ?? null,
      input.potassium ?? null,
      input.moisture ?? null,
      input.texture ?? null,
      input.notes ?? null,
      input.testedOn ?? null,
      timestamp,
    ],
  );

  const saved = await getSoil(owner, fieldLocalId);
  if (!saved) {
    throw new Error('Failed to read back the saved soil record.');
  }
  return saved;
};

export const setSoilSyncState = async (
  owner: OwnerUserId,
  fieldLocalId: string,
  state: RecordSyncState,
): Promise<void> => {
  await execute(
    'UPDATE field_soil SET sync_state = ?, updated_at_local = ? WHERE owner_user_id = ? AND field_local_id = ?',
    [state, nowIso(), requireOwner(owner), fieldLocalId],
  );
};

export const lockSoil = async (
  owner: OwnerUserId,
  fieldLocalId: string,
): Promise<void> => {
  await execute(
    'UPDATE field_soil SET locked = 1 WHERE owner_user_id = ? AND field_local_id = ?',
    [requireOwner(owner), fieldLocalId],
  );
};

export const listDirtySoil = (owner: OwnerUserId): Promise<DbFieldSoil[]> =>
  queryAll<DbFieldSoil>(
    `SELECT * FROM field_soil
      WHERE owner_user_id = ? AND sync_state IN ('local', 'pending', 'conflict', 'failed')
      ORDER BY updated_at_local ASC`,
    [requireOwner(owner)],
  );
