import { monitoringRepository } from '../../repositories';
import {
  listMonitoringRecords,
  parseMonitoringValues,
} from '../../repositories/monitoringRepository';
import type {
  ModuleStatus,
  MonitoringRecord,
  MonitoringValues,
} from '../../types/monitoring';
import type { DbMonitoringRecord, OwnerUserId } from '../db/types';
import { resolveFieldRow } from './farmCache';

const MODULE_STATUSES: readonly ModuleStatus[] = ['in_progress', 'completed'];

const asStatus = (value: string): ModuleStatus =>
  MODULE_STATUSES.includes(value as ModuleStatus)
    ? (value as ModuleStatus)
    : 'in_progress';

export const recordFromRow = (row: DbMonitoringRecord): MonitoringRecord => ({
  id: row.server_id ?? row.local_id,
  status: asStatus(row.status),
  notes: row.notes ?? '',
  documentCount: 0,
  createdAtISO: row.created_at,
  updatedAtISO: row.updated_at_local,
  values: parseMonitoringValues(row) as MonitoringValues,
});

export const cacheMonitoringRecords = async (
  owner: OwnerUserId,
  fieldId: string,
  module: string,
  records: readonly MonitoringRecord[],
): Promise<void> => {
  const field = await resolveFieldRow(owner, fieldId);
  if (!field) {
    return;
  }
  for (const record of records) {
    await monitoringRepository.upsertFromServer(
      owner,
      record.id,
      {
        field_local_id: field.local_id,
        module,
        status: record.status,
        notes: record.notes || null,
        values_json: JSON.stringify(record.values ?? {}),
      },
      record.updatedAtISO,
    );
  }
};

export const readCachedMonitoringRecords = async (
  owner: OwnerUserId,
  fieldId: string,
  module: string,
): Promise<MonitoringRecord[] | null> => {
  const field = await resolveFieldRow(owner, fieldId);
  if (!field) {
    return null;
  }
  const rows = await listMonitoringRecords(owner, field.local_id, module);
  if (rows.length === 0) {
    return null;
  }
  return rows.map(recordFromRow);
};

export const readCachedMonitoringRecord = async (
  owner: OwnerUserId,
  recordId: string,
): Promise<MonitoringRecord | null> => {
  const row =
    (await monitoringRepository.getByServerId(owner, recordId)) ??
    (await monitoringRepository.getByLocalId(owner, recordId));
  return row ? recordFromRow(row) : null;
};
