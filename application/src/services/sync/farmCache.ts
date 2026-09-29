import { farmRepository, fieldRepository } from '../../repositories';
import { listFieldsByFarm } from '../../repositories/fieldRepository';
import type { Farm, FarmStatus, Field, FieldHealth } from '../../types/farm';
import type { PageMeta, PageQuery } from '../../types/pagination';
import {
  getSoil,
  lockSoil,
  saveSoil,
  setSoilSyncState,
} from '../../repositories/fieldSoilRepository';
import type { SoilRecord } from '../../types/fieldDetails';
import type { DbFarm, DbField, DbFieldSoil, OwnerUserId } from '../db/types';

const FARM_STATUSES: readonly FarmStatus[] = ['active', 'pending', 'inactive'];
const FIELD_HEALTHS: readonly FieldHealth[] = ['healthy', 'monitor', 'critical'];

const asFarmStatus = (value: string): FarmStatus =>
  FARM_STATUSES.includes(value as FarmStatus) ? (value as FarmStatus) : 'active';

const asFieldHealth = (value: string): FieldHealth =>
  FIELD_HEALTHS.includes(value as FieldHealth) ? (value as FieldHealth) : 'healthy';

const isPending = (serverId: string | null, syncState: string): boolean =>
  !serverId || syncState !== 'synced';

export const farmFromRow = (row: DbFarm): Farm => ({
  id: row.server_id ?? row.local_id,
  name: row.name,
  businessEntity: row.business_entity ?? undefined,
  ownerName: row.owner_name ?? '',
  location: row.location ?? '',
  areaAcres: row.area_acres ?? 0,
  usedAcres: row.used_acres ?? undefined,
  availableAcres: row.available_acres ?? undefined,
  fieldsCount: row.field_count,
  status: asFarmStatus(row.status),
  lastUpdatedISO: row.updated_at_local,
  soilType: '',
  regenScore: 0,
  latitude: row.latitude,
  longitude: row.longitude,
  ownerEmail: row.owner_email ?? undefined,
  orgId: row.org_id ?? undefined,
  orgName: row.org_name ?? undefined,
  createdAt: row.created_at,
  pendingSync: isPending(row.server_id, row.sync_state),
});

export const fieldFromRow = (row: DbField, farmId: string): Field => ({
  id: row.server_id ?? row.local_id,
  farmId,
  name: row.name,
  areaAcres: row.area_acres ?? 0,
  crop: row.crop ?? '',
  season: row.season ?? '',
  status: asFieldHealth(row.status),
  coordinates: row.location ?? '',
  sowingDateISO: row.sowing_date ?? '',
  expectedHarvestISO: row.expected_harvest ?? '',
  irrigation: row.irrigation ?? '',
  weather: row.weather ?? '',
  healthLabel: '',
  latitude: row.latitude,
  longitude: row.longitude,
  hasBoundary: row.has_boundary === 1,
  boundaryUpdatedAt: row.boundary_updated_at,
  pendingSync: isPending(row.server_id, row.sync_state),
});

const toFarmValues = (farm: Farm): Record<string, string | number | null> => ({
  name: farm.name,
  business_entity: farm.businessEntity ?? null,
  owner_name: farm.ownerName || null,
  owner_email: farm.ownerEmail ?? null,
  location: farm.location || null,
  area_acres: farm.areaAcres,
  used_acres: farm.usedAcres ?? null,
  available_acres: farm.availableAcres ?? null,
  field_count: farm.fieldsCount,
  status: farm.status,
  latitude: farm.latitude ?? null,
  longitude: farm.longitude ?? null,
  org_id: farm.orgId ?? null,
  org_name: farm.orgName ?? null,
});

const toFieldValues = (
  field: Field,
  farmLocalId: string,
): Record<string, string | number | null> => ({
  farm_local_id: farmLocalId,
  name: field.name,
  area_acres: field.areaAcres,
  crop: field.crop || null,
  season: field.season || null,
  irrigation: field.irrigation || null,
  location: field.coordinates || null,
  latitude: field.latitude ?? null,
  longitude: field.longitude ?? null,
  sowing_date: field.sowingDateISO || null,
  expected_harvest: field.expectedHarvestISO || null,
  status: field.status,
  weather: field.weather || null,
  has_boundary: field.hasBoundary ? 1 : 0,
  boundary_updated_at: field.boundaryUpdatedAt ?? null,
});

export const cacheFarmList = async (
  owner: OwnerUserId,
  farms: readonly Farm[],
): Promise<void> => {
  for (const farm of farms) {
    await farmRepository.upsertFromServer(
      owner,
      farm.id,
      toFarmValues(farm),
      farm.lastUpdatedISO,
    );
  }
};

export const cacheFieldList = async (
  owner: OwnerUserId,
  farmServerId: string,
  fields: readonly Field[],
): Promise<void> => {
  const farm = await farmRepository.getByServerId(owner, farmServerId);
  if (!farm) {
    return;
  }
  for (const field of fields) {
    await fieldRepository.upsertFromServer(owner, field.id, toFieldValues(field, farm.local_id));
  }
};

export const resolveFarmRow = async (
  owner: OwnerUserId,
  farmId: string,
): Promise<DbFarm | null> =>
  (await farmRepository.getByServerId(owner, farmId)) ??
  (await farmRepository.getByLocalId(owner, farmId));

export const resolveFieldRow = async (
  owner: OwnerUserId,
  fieldId: string,
): Promise<DbField | null> =>
  (await fieldRepository.getByServerId(owner, fieldId)) ??
  (await fieldRepository.getByLocalId(owner, fieldId));

const matchesSearch = (farm: DbFarm, search?: string): boolean => {
  if (!search) {
    return true;
  }
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return (
    farm.name.toLowerCase().includes(needle) ||
    (farm.location ?? '').toLowerCase().includes(needle)
  );
};

const pageOf = <T,>(items: readonly T[], query?: PageQuery): { items: T[]; meta: PageMeta } => {
  const limit = Math.max(1, query?.limit ?? (items.length || 1));
  const page = Math.max(1, query?.page ?? 1);
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    meta: {
      page,
      limit,
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / limit)),
    },
  };
};

export const readCachedFarmList = async (
  owner: OwnerUserId,
  query?: PageQuery,
): Promise<{ farms: Farm[]; meta: PageMeta } | null> => {
  const rows = await farmRepository.list(owner);
  const matching = rows.filter(row => matchesSearch(row, query?.search));
  if (matching.length === 0) {
    return null;
  }
  const paged = pageOf(matching, query);
  return { farms: paged.items.map(farmFromRow), meta: paged.meta };
};

export const readCachedFieldList = async (
  owner: OwnerUserId,
  farmId: string,
): Promise<Field[] | null> => {
  const farm = await resolveFarmRow(owner, farmId);
  if (!farm) {
    return null;
  }
  const rows = await listFieldsByFarm(owner, farm.local_id);
  if (rows.length === 0) {
    return null;
  }
  return rows.map(row => fieldFromRow(row, farmId));
};

export const readCachedFarm = async (
  owner: OwnerUserId,
  farmId: string,
): Promise<Farm | null> => {
  const row = await resolveFarmRow(owner, farmId);
  return row ? farmFromRow(row) : null;
};

export const soilFromRow = (row: DbFieldSoil): SoilRecord => ({
  ph: row.ph,
  organicMatter: row.organic_matter,
  nitrogen: row.nitrogen,
  phosphorus: row.phosphorus,
  potassium: row.potassium,
  moisture: row.moisture,
  texture: row.texture ?? '',
  notes: row.notes ?? '',
  testedOnISO: row.tested_on,
});

export const cacheFieldSoil = async (
  owner: OwnerUserId,
  fieldId: string,
  record: SoilRecord,
  locked: boolean,
): Promise<void> => {
  const field = await resolveFieldRow(owner, fieldId);
  if (!field) {
    return;
  }
  const existing = await getSoil(owner, field.local_id);
  if (existing && existing.sync_state !== 'synced') {
    return;
  }
  await saveSoil(owner, field.local_id, {
    ph: record.ph,
    organicMatter: record.organicMatter,
    nitrogen: record.nitrogen,
    phosphorus: record.phosphorus,
    potassium: record.potassium,
    moisture: record.moisture,
    texture: record.texture || null,
    notes: record.notes || null,
    testedOn: record.testedOnISO,
  });
  await setSoilSyncState(owner, field.local_id, 'synced');
  if (locked) {
    await lockSoil(owner, field.local_id);
  }
};

export const readCachedFieldSoil = async (
  owner: OwnerUserId,
  fieldId: string,
): Promise<{ record: SoilRecord; locked: boolean } | null> => {
  const field = await resolveFieldRow(owner, fieldId);
  if (!field) {
    return null;
  }
  const row = await getSoil(owner, field.local_id);
  return row ? { record: soilFromRow(row), locked: row.locked === 1 } : null;
};
