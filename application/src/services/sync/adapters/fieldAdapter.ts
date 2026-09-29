import { Endpoints } from '../../../config/endpoints';
import { farmRepository, fieldRepository } from '../../../repositories';
import { ENTITY_TYPES } from '../entityRegistry';
import { syncHttp } from '../syncHttp';
import type {
  DomainSyncAdapter,
  SyncAdapterContext,
  SyncAdapterResult,
} from '../types';
import type { DbField } from '../../db/types';

interface RawField {
  id?: string;
  name?: string;
  area_acres?: string | number | null;
  created_at?: string;
  updated_at?: string;
}

interface FieldEnvelope {
  data?: { field?: RawField; fields?: RawField[] };
}

const VERIFY_WINDOW_MS = 24 * 60 * 60 * 1000;

const toBody = (row: DbField): Record<string, string | number | null> => {
  const body: Record<string, string | number | null> = { name: row.name };
  if (row.area_acres !== null) {
    body.areaAcres = row.area_acres;
  }
  if (row.crop) {
    body.crop = row.crop;
  }
  if (row.season) {
    body.season = row.season;
  }
  if (row.irrigation) {
    body.irrigation = row.irrigation;
  }
  if (row.location) {
    body.location = row.location;
  }
  if (row.latitude !== null) {
    body.latitude = row.latitude;
  }
  if (row.longitude !== null) {
    body.longitude = row.longitude;
  }
  if (row.sowing_date) {
    body.sowingDate = row.sowing_date;
  }
  if (row.expected_harvest) {
    body.expectedHarvest = row.expected_harvest;
  }
  return body;
};

const requireRow = async (context: SyncAdapterContext): Promise<DbField> => {
  const row = await fieldRepository.getByLocalId(
    context.ownerUserId,
    context.entry.entity_local_id,
  );
  if (!row) {
    throw new Error('Field row no longer exists locally.');
  }
  return row;
};

const resolveFarmServerId = async (
  context: SyncAdapterContext,
  row: DbField,
): Promise<string> => {
  const farm = await farmRepository.getByLocalId(
    context.ownerUserId,
    row.farm_local_id,
  );
  if (!farm) {
    throw new Error('The farm this field belongs to no longer exists locally.');
  }
  if (!farm.server_id) {
    throw new Error('The farm this field belongs to has not been synced yet.');
  }
  return farm.server_id;
};

const requireServerId = (row: DbField): string => {
  if (!row.server_id) {
    throw new Error('Field has not been created on the server yet.');
  }
  return row.server_id;
};

const sameArea = (
  left: number | null,
  right: string | number | null | undefined,
): boolean => {
  if (left === null || right === null || right === undefined || right === '') {
    return left === null;
  }
  const parsed = typeof right === 'number' ? right : Number.parseFloat(right);
  return Number.isFinite(parsed) && Math.abs(parsed - left) < 0.001;
};

export const fieldAdapter: DomainSyncAdapter = {
  entityType: ENTITY_TYPES.field,

  async create(context): Promise<SyncAdapterResult> {
    const row = await requireRow(context);
    const farmServerId = await resolveFarmServerId(context, row);
    const response = await syncHttp.post<FieldEnvelope>(
      Endpoints.farms.fields(farmServerId),
      toBody(row),
    );
    const created = response.data?.data?.field;
    return {
      serverId: created?.id ?? null,
      serverUpdatedAt: created?.updated_at ?? null,
    };
  },

  async update(context): Promise<SyncAdapterResult> {
    const row = await requireRow(context);
    const farmServerId = await resolveFarmServerId(context, row);
    const response = await syncHttp.patch<FieldEnvelope>(
      Endpoints.farms.field(farmServerId, requireServerId(row)),
      toBody(row),
    );
    const updated = response.data?.data?.field;
    return { serverUpdatedAt: updated?.updated_at ?? null };
  },

  async delete(context): Promise<SyncAdapterResult> {
    const serverId = context.entry.entity_server_id;
    if (!serverId) {
      return { serverId: null };
    }
    const row = await fieldRepository.getByLocalId(
      context.ownerUserId,
      context.entry.entity_local_id,
    );
    if (!row) {
      return { serverId };
    }
    const farmServerId = await resolveFarmServerId(context, row);
    await syncHttp.delete(Endpoints.farms.field(farmServerId, serverId));
    return { serverId };
  },

  async verifyCreated(context): Promise<SyncAdapterResult | null> {
    const row = await fieldRepository.getByLocalId(
      context.ownerUserId,
      context.entry.entity_local_id,
    );
    if (!row || row.server_id) {
      return null;
    }

    const farm = await farmRepository.getByLocalId(
      context.ownerUserId,
      row.farm_local_id,
    );
    if (!farm?.server_id) {
      return null;
    }

    const response = await syncHttp.get<FieldEnvelope>(
      Endpoints.farms.fields(farm.server_id),
    );
    const fields = response.data?.data?.fields ?? [];
    const createdAtMs = Date.parse(row.created_at);

    const match = fields.find(candidate => {
      if (!candidate.id || candidate.name !== row.name) {
        return false;
      }
      if (!sameArea(row.area_acres, candidate.area_acres)) {
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
