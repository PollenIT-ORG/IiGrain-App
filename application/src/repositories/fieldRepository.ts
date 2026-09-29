import type { DbField, OwnerUserId } from '../services/db/types';
import { createOwnedRepository } from './ownedRepository';
import { queryAll, requireOwner } from './ownerScope';

const COLUMNS = [
  'farm_local_id',
  'name',
  'area_acres',
  'crop',
  'season',
  'irrigation',
  'location',
  'address_resolved',
  'latitude',
  'longitude',
  'sowing_date',
  'expected_harvest',
  'status',
  'weather',
  'has_boundary',
  'boundary_updated_at',
  'server_id',
] as const;

export const fieldRepository = createOwnedRepository<DbField>({
  table: 'fields',
  columns: COLUMNS,
  defaultOrderBy: 'name COLLATE NOCASE ASC',
});

export const listFieldsByFarm = (
  owner: OwnerUserId,
  farmLocalId: string,
): Promise<DbField[]> =>
  fieldRepository.listWhere(owner, 'farm_local_id = ?', [farmLocalId]);

export const countFieldsByFarm = async (
  owner: OwnerUserId,
  farmLocalId: string,
): Promise<number> => (await listFieldsByFarm(owner, farmLocalId)).length;

export const fieldsBlockedByUnsyncedFarm = (
  owner: OwnerUserId,
): Promise<DbField[]> =>
  queryAll<DbField>(
    `SELECT f.* FROM fields f
       JOIN farms fa ON fa.local_id = f.farm_local_id
      WHERE f.owner_user_id = ?
        AND f.deleted_local = 0
        AND f.server_id IS NULL
        AND fa.server_id IS NULL
      ORDER BY f.updated_at_local ASC`,
    [requireOwner(owner)],
  );
