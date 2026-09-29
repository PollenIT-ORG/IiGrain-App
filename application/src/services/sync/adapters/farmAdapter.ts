import { Endpoints } from '../../../config/endpoints';
import { farmRepository } from '../../../repositories';
import { ENTITY_TYPES } from '../entityRegistry';
import { syncHttp } from '../syncHttp';
import type {
  DomainSyncAdapter,
  SyncAdapterContext,
  SyncAdapterResult,
} from '../types';
import type { DbFarm } from '../../db/types';

interface RawFarm {
  id?: string;
  name?: string;
  area_acres?: string | number | null;
  created_at?: string;
  updated_at?: string;
}

interface FarmEnvelope {
  data?: { farm?: RawFarm; farms?: RawFarm[] };
}

const VERIFY_WINDOW_MS = 24 * 60 * 60 * 1000;

const toBody = (row: DbFarm): Record<string, string | number | null> => {
  const body: Record<string, string | number | null> = { name: row.name };
  if (row.business_entity) {
    body.businessEntity = row.business_entity;
  }
  if (row.area_acres !== null) {
    body.areaAcres = row.area_acres;
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
  return body;
};

const requireRow = async (context: SyncAdapterContext): Promise<DbFarm> => {
  const row = await farmRepository.getByLocalId(
    context.ownerUserId,
    context.entry.entity_local_id,
  );
  if (!row) {
    throw new Error('Farm row no longer exists locally.');
  }
  return row;
};

const requireServerId = (row: DbFarm): string => {
  if (!row.server_id) {
    throw new Error('Farm has not been created on the server yet.');
  }
  return row.server_id;
};

const sameArea = (left: number | null, right: string | number | null | undefined): boolean => {
  if (left === null || right === null || right === undefined || right === '') {
    return left === null;
  }
  const parsed = typeof right === 'number' ? right : Number.parseFloat(right);
  return Number.isFinite(parsed) && Math.abs(parsed - left) < 0.001;
};

export const farmAdapter: DomainSyncAdapter = {
  entityType: ENTITY_TYPES.farm,

  async create(context): Promise<SyncAdapterResult> {
    const row = await requireRow(context);
    const response = await syncHttp.post<FarmEnvelope>(
      Endpoints.farms.myFarms,
      toBody(row),
    );
    const created = response.data?.data?.farm;
    return {
      serverId: created?.id ?? null,
      serverUpdatedAt: created?.updated_at ?? null,
    };
  },

  async update(context): Promise<SyncAdapterResult> {
    const row = await requireRow(context);
    const response = await syncHttp.patch<FarmEnvelope>(
      Endpoints.farms.myFarm(requireServerId(row)),
      toBody(row),
    );
    const updated = response.data?.data?.farm;
    return { serverUpdatedAt: updated?.updated_at ?? null };
  },

  async delete(context): Promise<SyncAdapterResult> {
    const serverId = context.entry.entity_server_id;
    if (!serverId) {
      return { serverId: null };
    }
    await syncHttp.delete(Endpoints.farms.myFarm(serverId));
    return { serverId };
  },

  async verifyCreated(context): Promise<SyncAdapterResult | null> {
    const row = await farmRepository.getByLocalId(
      context.ownerUserId,
      context.entry.entity_local_id,
    );
    if (!row || row.server_id) {
      return null;
    }

    const response = await syncHttp.get<FarmEnvelope>(Endpoints.farms.myFarms, {
      params: { page: 1, limit: 100 },
    });
    const farms = response.data?.data?.farms ?? [];
    const createdAtMs = Date.parse(row.created_at);

    const match = farms.find(candidate => {
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
