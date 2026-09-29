import type { DbFarm, OwnerUserId } from '../services/db/types';
import { createOwnedRepository } from './ownedRepository';
import { queryCount, requireOwner } from './ownerScope';

const COLUMNS = [
  'name',
  'business_entity',
  'owner_name',
  'owner_email',
  'location',
  'address_resolved',
  'area_acres',
  'used_acres',
  'available_acres',
  'field_count',
  'status',
  'latitude',
  'longitude',
  'org_id',
  'org_name',
  'server_id',
] as const;

export const farmRepository = createOwnedRepository<DbFarm>({
  table: 'farms',
  columns: COLUMNS,
  defaultOrderBy: 'name COLLATE NOCASE ASC',
});

export const searchFarms = (
  owner: OwnerUserId,
  term: string,
): Promise<DbFarm[]> =>
  farmRepository.listWhere(owner, 'name LIKE ?', [`%${term.trim()}%`]);

export const farmsAwaitingServerId = (owner: OwnerUserId): Promise<DbFarm[]> =>
  farmRepository.listWhere(owner, 'server_id IS NULL');

export const countFarmsPendingAddress = (owner: OwnerUserId): Promise<number> =>
  queryCount(
    'SELECT COUNT(*) FROM farms WHERE owner_user_id = ? AND deleted_local = 0 AND address_resolved = 0',
    [requireOwner(owner)],
  );
