import { nowIso } from '../services/db/ids';
import type {
  DbFieldBoundary,
  OwnerUserId,
  RecordSyncState,
} from '../services/db/types';
import { execute, queryAll, queryOne, requireOwner } from './ownerScope';

export interface BoundaryPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface SaveBoundaryInput {
  readonly fieldLocalId: string;
  readonly farmLocalId: string;
  readonly ring: readonly BoundaryPoint[];
  readonly areaSqM?: number;
}

const bboxOf = (ring: readonly BoundaryPoint[]) => {
  const lats = ring.map(p => p.latitude);
  const lngs = ring.map(p => p.longitude);
  return {
    minLat: Math.min(...lats),
    minLng: Math.min(...lngs),
    maxLat: Math.max(...lats),
    maxLng: Math.max(...lngs),
  };
};

const centerOf = (ring: readonly BoundaryPoint[]): BoundaryPoint => {
  const box = bboxOf(ring);
  return {
    latitude: (box.minLat + box.maxLat) / 2,
    longitude: (box.minLng + box.maxLng) / 2,
  };
};

const toGeoJson = (ring: readonly BoundaryPoint[]): string => {
  const coordinates = ring.map(point => [point.longitude, point.latitude]);
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coordinates.push([first[0], first[1]]);
  }
  return JSON.stringify({ type: 'Polygon', coordinates: [coordinates] });
};

export const getBoundary = (
  owner: OwnerUserId,
  fieldLocalId: string,
): Promise<DbFieldBoundary | null> =>
  queryOne<DbFieldBoundary>(
    'SELECT * FROM field_boundaries WHERE owner_user_id = ? AND field_local_id = ?',
    [requireOwner(owner), fieldLocalId],
  );

export const saveBoundary = async (
  owner: OwnerUserId,
  input: SaveBoundaryInput,
): Promise<DbFieldBoundary> => {
  if (input.ring.length < 3) {
    throw new Error('A boundary needs at least three points.');
  }
  const ownerId = requireOwner(owner);
  const timestamp = nowIso();
  const existing = await getBoundary(owner, input.fieldLocalId);
  const box = bboxOf(input.ring);
  const center = centerOf(input.ring);

  await execute(
    `INSERT INTO field_boundaries
       (field_local_id, owner_user_id, farm_local_id, ring_json, geojson, area_sq_m,
        center_lat, center_lng, bbox_min_lat, bbox_min_lng, bbox_max_lat, bbox_max_lng,
        version, sync_state, updated_at, updated_at_local)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', ?, ?)
     ON CONFLICT (field_local_id) DO UPDATE SET
       farm_local_id = excluded.farm_local_id,
       ring_json = excluded.ring_json,
       geojson = excluded.geojson,
       area_sq_m = excluded.area_sq_m,
       center_lat = excluded.center_lat,
       center_lng = excluded.center_lng,
       bbox_min_lat = excluded.bbox_min_lat,
       bbox_min_lng = excluded.bbox_min_lng,
       bbox_max_lat = excluded.bbox_max_lat,
       bbox_max_lng = excluded.bbox_max_lng,
       version = excluded.version,
       sync_state = 'local',
       updated_at = excluded.updated_at,
       updated_at_local = excluded.updated_at_local`,
    [
      input.fieldLocalId,
      ownerId,
      input.farmLocalId,
      JSON.stringify(input.ring),
      toGeoJson(input.ring),
      input.areaSqM ?? 0,
      center.latitude,
      center.longitude,
      box.minLat,
      box.minLng,
      box.maxLat,
      box.maxLng,
      (existing?.version ?? 0) + 1,
      timestamp,
      timestamp,
    ],
  );

  await execute(
    `UPDATE fields
        SET has_boundary = 1,
            boundary_updated_at = ?,
            updated_at_local = ?,
            sync_state = CASE WHEN sync_state = 'synced' THEN 'local' ELSE sync_state END
      WHERE owner_user_id = ? AND local_id = ?`,
    [timestamp, timestamp, ownerId, input.fieldLocalId],
  );

  const saved = await getBoundary(owner, input.fieldLocalId);
  if (!saved) {
    throw new Error('Failed to read back the saved boundary.');
  }
  return saved;
};

export const removeBoundary = async (
  owner: OwnerUserId,
  fieldLocalId: string,
): Promise<boolean> => {
  const ownerId = requireOwner(owner);
  const result = await execute(
    'DELETE FROM field_boundaries WHERE owner_user_id = ? AND field_local_id = ?',
    [ownerId, fieldLocalId],
  );
  if (result.rowsAffected > 0) {
    const timestamp = nowIso();
    await execute(
      `UPDATE fields
          SET has_boundary = 0,
              boundary_updated_at = NULL,
              updated_at_local = ?,
              sync_state = CASE WHEN sync_state = 'synced' THEN 'local' ELSE sync_state END
        WHERE owner_user_id = ? AND local_id = ?`,
      [timestamp, ownerId, fieldLocalId],
    );
  }
  return result.rowsAffected > 0;
};

export const setBoundarySyncState = async (
  owner: OwnerUserId,
  fieldLocalId: string,
  state: RecordSyncState,
): Promise<void> => {
  await execute(
    'UPDATE field_boundaries SET sync_state = ?, updated_at_local = ? WHERE owner_user_id = ? AND field_local_id = ?',
    [state, nowIso(), requireOwner(owner), fieldLocalId],
  );
};

export const listDirtyBoundaries = (
  owner: OwnerUserId,
): Promise<DbFieldBoundary[]> =>
  queryAll<DbFieldBoundary>(
    `SELECT * FROM field_boundaries
      WHERE owner_user_id = ? AND sync_state IN ('local', 'pending', 'conflict', 'failed')
      ORDER BY updated_at_local ASC`,
    [requireOwner(owner)],
  );
