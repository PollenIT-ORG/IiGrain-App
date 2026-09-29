import type { DbMonitoringRecord, OwnerUserId } from '../services/db/types';
import { createOwnedRepository } from './ownedRepository';
import { queryCount, requireOwner } from './ownerScope';

export const monitoringRepository = createOwnedRepository<DbMonitoringRecord>({
  table: 'monitoring_records',
  columns: [
    'field_local_id',
    'module',
    'status',
    'notes',
    'values_json',
    'server_id',
  ],
  defaultOrderBy: 'created_at DESC',
});

export interface MonitoringValues {
  readonly [key: string]: string | number | boolean | null;
}

export const createMonitoringRecord = (
  owner: OwnerUserId,
  fieldLocalId: string,
  module: string,
  values: MonitoringValues,
  options?: { status?: 'in_progress' | 'completed'; notes?: string | null },
): Promise<DbMonitoringRecord> =>
  monitoringRepository.create(owner, {
    field_local_id: fieldLocalId,
    module,
    status: options?.status ?? 'in_progress',
    notes: options?.notes ?? null,
    values_json: JSON.stringify(values),
  });

export const updateMonitoringValues = (
  owner: OwnerUserId,
  localId: string,
  values: MonitoringValues,
): Promise<DbMonitoringRecord | null> =>
  monitoringRepository.update(owner, localId, { values_json: JSON.stringify(values) });

export const listMonitoringRecords = (
  owner: OwnerUserId,
  fieldLocalId: string,
  module: string,
): Promise<DbMonitoringRecord[]> =>
  monitoringRepository.listWhere(owner, 'field_local_id = ? AND module = ?', [
    fieldLocalId,
    module,
  ]);

export const countMonitoringRecords = (
  owner: OwnerUserId,
  fieldLocalId: string,
  module: string,
): Promise<number> =>
  queryCount(
    `SELECT COUNT(*) FROM monitoring_records
      WHERE owner_user_id = ? AND field_local_id = ? AND module = ? AND deleted_local = 0`,
    [requireOwner(owner), fieldLocalId, module],
  );

export const parseMonitoringValues = (row: DbMonitoringRecord): MonitoringValues => {
  try {
    return JSON.parse(row.values_json) as MonitoringValues;
  } catch {
    return {};
  }
};
