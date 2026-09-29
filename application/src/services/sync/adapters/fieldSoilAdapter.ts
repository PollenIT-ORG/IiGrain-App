import { Endpoints } from '../../../config/endpoints';
import { fieldRepository } from '../../../repositories';
import { getSoil, setSoilSyncState } from '../../../repositories/fieldSoilRepository';
import { ENTITY_TYPES } from '../entityRegistry';
import { syncHttp } from '../syncHttp';
import type {
  DomainSyncAdapter,
  SyncAdapterContext,
  SyncAdapterResult,
} from '../types';
import type { DbFieldSoil } from '../../db/types';

interface SoilEnvelope {
  data?: { soil?: { updated_at?: string }; locked?: boolean };
}

const toBody = (row: DbFieldSoil): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  if (row.ph !== null) {
    body.ph = row.ph;
  }
  if (row.organic_matter !== null) {
    body.organicMatter = row.organic_matter;
  }
  if (row.nitrogen !== null) {
    body.nitrogen = row.nitrogen;
  }
  if (row.phosphorus !== null) {
    body.phosphorus = row.phosphorus;
  }
  if (row.potassium !== null) {
    body.potassium = row.potassium;
  }
  if (row.moisture !== null) {
    body.moisture = row.moisture;
  }
  if (row.texture !== null) {
    body.texture = row.texture;
  }
  if (row.notes !== null) {
    body.notes = row.notes;
  }
  if (row.tested_on !== null) {
    body.testedOn = row.tested_on;
  }
  return body;
};

const resolveFieldServerId = async (
  context: SyncAdapterContext,
): Promise<string> => {
  const field = await fieldRepository.getByLocalId(
    context.ownerUserId,
    context.entry.entity_local_id,
  );
  if (!field) {
    throw new Error('The field this soil record belongs to no longer exists locally.');
  }
  if (!field.server_id) {
    throw new Error('The field this soil record belongs to has not been synced yet.');
  }
  return field.server_id;
};

const put = async (context: SyncAdapterContext): Promise<SyncAdapterResult> => {
  const fieldLocalId = context.entry.entity_local_id;
  const soil = await getSoil(context.ownerUserId, fieldLocalId);
  if (!soil) {
    throw new Error('This soil record no longer exists on this device.');
  }
  if (soil.locked === 1) {
    await setSoilSyncState(context.ownerUserId, fieldLocalId, 'synced');
    return { serverId: null, serverUpdatedAt: null };
  }

  const fieldServerId = await resolveFieldServerId(context);
  await setSoilSyncState(context.ownerUserId, fieldLocalId, 'pending');

  const response = await syncHttp.put<SoilEnvelope>(
    Endpoints.fields.soil(fieldServerId),
    toBody(soil),
  );

  await setSoilSyncState(context.ownerUserId, fieldLocalId, 'synced');
  return {
    serverId: fieldServerId,
    serverUpdatedAt: response.data?.data?.soil?.updated_at ?? null,
  };
};

export const fieldSoilAdapter: DomainSyncAdapter = {
  entityType: ENTITY_TYPES.fieldSoil,
  create: put,
  update: put,
};
