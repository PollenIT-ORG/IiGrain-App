import { Endpoints } from '../../../config/endpoints';
import { farmRepository, fieldRepository } from '../../../repositories';
import {
  getBoundary,
  setBoundarySyncState,
} from '../../../repositories/fieldBoundaryRepository';
import { ENTITY_TYPES } from '../entityRegistry';
import { syncHttp } from '../syncHttp';
import type {
  DomainSyncAdapter,
  SyncAdapterContext,
  SyncAdapterResult,
} from '../types';

interface Route {
  readonly farmServerId: string;
  readonly fieldServerId: string;
}

const resolveRoute = async (context: SyncAdapterContext): Promise<Route> => {
  const field = await fieldRepository.getByLocalId(
    context.ownerUserId,
    context.entry.entity_local_id,
  );
  if (!field) {
    throw new Error('The field this boundary belongs to no longer exists locally.');
  }
  if (!field.server_id) {
    throw new Error('The field this boundary belongs to has not been synced yet.');
  }
  const farm = await farmRepository.getByLocalId(
    context.ownerUserId,
    field.farm_local_id,
  );
  if (!farm?.server_id) {
    throw new Error('The farm this boundary belongs to has not been synced yet.');
  }
  return { farmServerId: farm.server_id, fieldServerId: field.server_id };
};

const parseGeoJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('This boundary could not be read back for upload.');
  }
};

const put = async (context: SyncAdapterContext): Promise<SyncAdapterResult> => {
  const fieldLocalId = context.entry.entity_local_id;
  const boundary = await getBoundary(context.ownerUserId, fieldLocalId);
  if (!boundary) {
    throw new Error('This boundary no longer exists on this device.');
  }

  const route = await resolveRoute(context);
  await setBoundarySyncState(context.ownerUserId, fieldLocalId, 'pending');

  await syncHttp.put(
    Endpoints.farms.fieldBoundary(route.farmServerId, route.fieldServerId),
    { boundary: parseGeoJson(boundary.geojson) },
  );

  await setBoundarySyncState(context.ownerUserId, fieldLocalId, 'synced');
  return { serverId: route.fieldServerId, serverUpdatedAt: null };
};

export const fieldBoundaryAdapter: DomainSyncAdapter = {
  entityType: ENTITY_TYPES.fieldBoundary,

  create: put,
  update: put,

  async delete(context): Promise<SyncAdapterResult> {
    const route = await resolveRoute(context);
    await syncHttp.put(
      Endpoints.farms.fieldBoundary(route.farmServerId, route.fieldServerId),
      { boundary: null },
    );
    return { serverId: route.fieldServerId };
  },
};
