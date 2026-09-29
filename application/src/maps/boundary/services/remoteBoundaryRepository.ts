import http from '../../../services/http';
import { Endpoints } from '../../../config/endpoints';
import {
  saveFieldBoundary,
  updateFarmField,
  type FieldBoundarySaveResult,
} from '../../../api/FieldApi';
import { acresFromRing } from '../../utils/fieldAcres';
import type { LatLng } from '../../types';
import type { FieldBoundary, GeoJSONPolygon } from '../types';
import { buildFieldBoundary } from './boundaryFactory';
import { geoJSONToRing, ringToGeoJSON } from './boundarySerializer';
import type {
  BoundaryRepository,
  LocalBoundaryStore,
  SaveBoundaryInput,
} from './boundaryRepository';
import { handleApiError } from '../../../utils/handleApiError';
import { isDatabaseReady } from '../../../services/db';
import type { OwnerUserId } from '../../../services/db/types';
import {
  removeBoundaryOffline,
  resolveOwner,
  saveBoundaryOffline,
} from '../../../services/sync';
import { resolveFarmRow, resolveFieldRow } from '../../../services/sync/farmCache';
import { getSyncSubsystem } from '../../../services/sync';


export interface BoundarySavedEvent {
  farmId: string;
  fieldId: string;
  areaAcres: number | null;
  hasBoundary: boolean;
}

export interface RemoteRepoDeps {
  store: LocalBoundaryStore;
  now: () => string;
  farmIdForField: (fieldId: string) => string | null;
  onServerSaved?: (event: BoundarySavedEvent) => void;
}

interface FieldEnvelope {
  data?: {
    field?: {
      boundary?: unknown;
      boundary_updated_at?: string | null;
    };
  };
}

const currentOwner = async (): Promise<OwnerUserId | null> => {
  if (!isDatabaseReady()) {
    return null;
  }
  return getSyncSubsystem().owner() ?? (await resolveOwner());
};

const isOffline = (error: unknown): boolean =>
  handleApiError(error).kind === 'offline';

const queueBoundaryLocally = async (
  fieldId: string,
  farmId: string,
  ring: readonly LatLng[],
): Promise<boolean> => {
  const owner = await currentOwner();
  if (!owner) {
    return false;
  }
  const field = await resolveFieldRow(owner, fieldId);
  const farm = await resolveFarmRow(owner, farmId);
  if (!field || !farm) {
    return false;
  }
  await saveBoundaryOffline(owner, {
    fieldLocalId: field.local_id,
    farmLocalId: farm.local_id,
    ring: ring.map(point => ({ latitude: point.latitude, longitude: point.longitude })),
  });
  return true;
};

const queueBoundaryRemovalLocally = async (fieldId: string): Promise<boolean> => {
  const owner = await currentOwner();
  if (!owner) {
    return false;
  }
  const field = await resolveFieldRow(owner, fieldId);
  if (!field) {
    return false;
  }
  await removeBoundaryOffline(owner, field.local_id);
  return true;
};

const ACRE_TOLERANCE = 0.015;

const acresForSavedOutline = async (
  farmId: string,
  fieldId: string,
  ring: readonly LatLng[],
  serverAcres: number | null,
): Promise<number | null> => {
  const drawn = acresFromRing(ring);
  if (drawn === null) {
    return serverAcres;
  }
  if (serverAcres !== null && Math.abs(serverAcres - drawn) <= ACRE_TOLERANCE) {
    return serverAcres;
  }
  try {
    const field = await updateFarmField(farmId, fieldId, { areaAcres: drawn });
    return field.areaAcres;
  } catch {
    return serverAcres;
  }
};

const ringFromResponse = (envelope: unknown): LatLng[] => {
  const boundary = (envelope as FieldEnvelope)?.data?.field?.boundary;
  return geoJSONToRing(boundary as GeoJSONPolygon | null);
};

const sameRing = (a: readonly LatLng[], b: readonly LatLng[]): boolean =>
  a.length === b.length &&
  a.every(
    (point, i) =>
      point.latitude === b[i].latitude && point.longitude === b[i].longitude,
  );

export const createRemoteBoundaryRepository = (
  deps: RemoteRepoDeps,
): BoundaryRepository => ({
  async load(fieldId) {
    const cached = deps.store.read(fieldId);
    const farmId = deps.farmIdForField(fieldId);
    if (!farmId) {
      return cached;
    }

    try {
      const { data } = await http.get(Endpoints.farms.field(farmId, fieldId));
      const ring = ringFromResponse(data);
      if (ring.length < 3) {
        return cached;
      }
      if (cached && sameRing(cached.ring, ring)) {
        if (cached.syncStatus === 'synced') {
          return cached;
        }
        const synced: FieldBoundary = { ...cached, syncStatus: 'synced' };
        deps.store.write(synced);
        return synced;
      }

      const boundary = buildFieldBoundary({
        fieldId,
        farmId,
        orgId: cached?.orgId ?? null,
        ring,
        version: (cached?.version ?? 0) + 1,
        updatedAt: deps.now(),
      });
      if (!boundary) {
        return cached;
      }
      const synced: FieldBoundary = { ...boundary, syncStatus: 'synced' };
      deps.store.write(synced);
      return synced;
    } catch {
      return cached;
    }
  },

  async save(input: SaveBoundaryInput) {
    const previous = deps.store.read(input.fieldId);
    const boundary = buildFieldBoundary({
      fieldId: input.fieldId,
      farmId: input.farmId,
      orgId: input.orgId,
      ring: input.ring,
      version: (previous?.version ?? 0) + 1,
      updatedAt: deps.now(),
    });
    if (!boundary) {
      throw new Error('Cannot save a boundary with fewer than 3 points.');
    }

    deps.store.write(boundary);

    const geo = ringToGeoJSON(input.ring);
    if (!geo) {
      throw new Error('Cannot serialise this boundary.');
    }

    let saved: FieldBoundarySaveResult;
    try {
      saved = await saveFieldBoundary(input.farmId, input.fieldId, geo);
    } catch (error) {
      if (isOffline(error)) {
        const queued = await queueBoundaryLocally(
          input.fieldId,
          input.farmId,
          input.ring,
        ).catch(() => false);
        if (queued) {
          const pending: FieldBoundary = { ...boundary, syncStatus: 'pending' };
          deps.store.write(pending);
          return pending;
        }
      }
      throw error;
    }

    const areaAcres = await acresForSavedOutline(
      input.farmId,
      input.fieldId,
      input.ring,
      saved.areaAcres,
    );

    const synced: FieldBoundary = { ...boundary, syncStatus: 'synced' };
    deps.store.write(synced);
    deps.onServerSaved?.({
      farmId: input.farmId,
      fieldId: input.fieldId,
      areaAcres,
      hasBoundary: true,
    });
    return synced;
  },

  async remove(fieldId) {
    const farmId = deps.farmIdForField(fieldId);
    deps.store.delete(fieldId);
    if (!farmId) {
      return;
    }
    let saved: FieldBoundarySaveResult;
    try {
      saved = await saveFieldBoundary(farmId, fieldId, null);
    } catch (error) {
      if (isOffline(error)) {
        const queued = await queueBoundaryRemovalLocally(fieldId).catch(() => false);
        if (queued) {
          return;
        }
      }
      throw error;
    }
    deps.onServerSaved?.({
      farmId,
      fieldId,
      areaAcres: saved.areaAcres,
      hasBoundary: false,
    });
  },
});
