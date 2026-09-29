import { Endpoints } from '../../../config/endpoints';
import { fieldRepository, monitoringRepository } from '../../../repositories';
import { parseMonitoringValues } from '../../../repositories/monitoringRepository';
import { ENTITY_TYPES } from '../entityRegistry';
import { syncHttp } from '../syncHttp';
import type {
  DomainSyncAdapter,
  SyncAdapterContext,
  SyncAdapterResult,
} from '../types';
import type { DbMonitoringRecord } from '../../db/types';

interface RawRecord {
  id?: string;
  status?: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface RecordEnvelope {
  data?: { record?: RawRecord; records?: RawRecord[] };
}

const VERIFY_WINDOW_MS = 24 * 60 * 60 * 1000;

const toBody = (row: DbMonitoringRecord): Record<string, unknown> => ({
  ...parseMonitoringValues(row),
  status: row.status,
  notes: row.notes,
});

const requireRow = async (
  context: SyncAdapterContext,
): Promise<DbMonitoringRecord> => {
  const row = await monitoringRepository.getByLocalId(
    context.ownerUserId,
    context.entry.entity_local_id,
  );
  if (!row) {
    throw new Error('Monitoring record no longer exists locally.');
  }
  return row;
};

const resolveFieldServerId = async (
  context: SyncAdapterContext,
  row: DbMonitoringRecord,
): Promise<string> => {
  const field = await fieldRepository.getByLocalId(
    context.ownerUserId,
    row.field_local_id,
  );
  if (!field) {
    throw new Error('The field this record belongs to no longer exists locally.');
  }
  if (!field.server_id) {
    throw new Error('The field this record belongs to has not been synced yet.');
  }
  return field.server_id;
};

const requireServerId = (row: DbMonitoringRecord): string => {
  if (!row.server_id) {
    throw new Error('Monitoring record has not been created on the server yet.');
  }
  return row.server_id;
};

const sameValues = (row: DbMonitoringRecord, candidate: RawRecord): boolean => {
  const local = parseMonitoringValues(row);
  const keys = Object.keys(local).filter(key => local[key] !== null && local[key] !== '');
  if (keys.length === 0) {
    return false;
  }
  return keys.every(key => {
    const mine = local[key];
    const theirs = candidate[key];
    if (theirs === undefined || theirs === null) {
      return false;
    }
    if (typeof mine === 'number') {
      const parsed = typeof theirs === 'number' ? theirs : Number.parseFloat(String(theirs));
      return Number.isFinite(parsed) && Math.abs(parsed - mine) < 0.001;
    }
    return String(theirs) === String(mine);
  });
};

export const monitoringAdapter: DomainSyncAdapter = {
  entityType: ENTITY_TYPES.monitoringRecord,

  async create(context): Promise<SyncAdapterResult> {
    const row = await requireRow(context);
    const fieldServerId = await resolveFieldServerId(context, row);
    const response = await syncHttp.post<RecordEnvelope>(
      Endpoints.fieldMonitoring.records(fieldServerId, row.module),
      toBody(row),
    );
    const created = response.data?.data?.record;
    return {
      serverId: created?.id ?? null,
      serverUpdatedAt: created?.updated_at ?? null,
    };
  },

  async update(context): Promise<SyncAdapterResult> {
    const row = await requireRow(context);
    const fieldServerId = await resolveFieldServerId(context, row);
    const response = await syncHttp.patch<RecordEnvelope>(
      Endpoints.fieldMonitoring.record(fieldServerId, row.module, requireServerId(row)),
      toBody(row),
    );
    const updated = response.data?.data?.record;
    return { serverUpdatedAt: updated?.updated_at ?? null };
  },

  async delete(context): Promise<SyncAdapterResult> {
    const serverId = context.entry.entity_server_id;
    if (!serverId) {
      return { serverId: null };
    }
    const row = await monitoringRepository.getByLocalId(
      context.ownerUserId,
      context.entry.entity_local_id,
    );
    if (!row) {
      return { serverId };
    }
    const fieldServerId = await resolveFieldServerId(context, row);
    await syncHttp.delete(
      Endpoints.fieldMonitoring.record(fieldServerId, row.module, serverId),
    );
    return { serverId };
  },

  async verifyCreated(context): Promise<SyncAdapterResult | null> {
    const row = await monitoringRepository.getByLocalId(
      context.ownerUserId,
      context.entry.entity_local_id,
    );
    if (!row || row.server_id) {
      return null;
    }

    const field = await fieldRepository.getByLocalId(
      context.ownerUserId,
      row.field_local_id,
    );
    if (!field?.server_id) {
      return null;
    }

    const response = await syncHttp.get<RecordEnvelope>(
      Endpoints.fieldMonitoring.records(field.server_id, row.module),
    );
    const records = response.data?.data?.records ?? [];
    const createdAtMs = Date.parse(row.created_at);

    const match = records.find(candidate => {
      if (!candidate.id || !sameValues(row, candidate)) {
        return false;
      }
      if (!candidate.created_at || !Number.isFinite(createdAtMs)) {
        return true;
      }
      const candidateMs = Date.parse(candidate.created_at);
      return (
        Number.isFinite(candidateMs) &&
        Math.abs(candidateMs - createdAtMs) <= VERIFY_WINDOW_MS
      );
    });

    if (!match?.id) {
      return null;
    }

    return { serverId: match.id, serverUpdatedAt: match.updated_at ?? null };
  },
};
