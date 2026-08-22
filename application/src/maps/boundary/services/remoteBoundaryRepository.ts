import http from '../../../services/http';
import { Endpoints } from '../../../config/endpoints';
import type { LatLng } from '../../types';
import type { FieldBoundary, GeoJSONPolygon } from '../types';
import { buildFieldBoundary } from './boundaryFactory';
import { geoJSONToRing, ringToGeoJSON } from './boundarySerializer';
import type {
  BoundaryRepository,
  LocalBoundaryStore,
  SaveBoundaryInput,
} from './boundaryRepository';


export interface RemoteRepoDeps {
  store: LocalBoundaryStore;
  now: () => string;
  farmIdForField: (fieldId: string) => string | null;
}

interface FieldEnvelope {
  data?: {
    field?: {
      boundary?: unknown;
      boundary_updated_at?: string | null;
    };
  };
}

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

    await http.put(Endpoints.farms.fieldBoundary(input.farmId, input.fieldId), {
      boundary: geo,
    });

    const synced: FieldBoundary = { ...boundary, syncStatus: 'synced' };
    deps.store.write(synced);
    return synced;
  },

  async remove(fieldId) {
    const farmId = deps.farmIdForField(fieldId);
    deps.store.delete(fieldId);
    if (!farmId) {
      return;
    }
    await http.put(Endpoints.farms.fieldBoundary(farmId, fieldId), {
      boundary: null,
    });
  },
});
