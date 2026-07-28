/**
 * src/maps/boundary/services/boundaryRepository.ts — THE swap point.
 *
 * `useBoundaryPersistence` depends on this interface, never on Redux or the API
 * directly. Phase D binds the local implementation (backed by the persisted
 * Redux slice); Phase E binds an `apiBoundaryRepository` against the contract in
 * docs/maps/FarmBoundary/DATA_MODEL.md §4. Swapping storage is one binding — no
 * component, hook or engine file changes.
 *
 * The local factory takes plain accessor callbacks rather than importing the
 * store, so the maps module stays decoupled from Redux and the repo is testable
 * with a fake backing map.
 */

import type { LatLng } from '../../types';
import type { FieldBoundary } from '../types';
import { buildFieldBoundary } from './boundaryFactory';

/** Metadata a save needs beyond the ring itself. */
export interface SaveBoundaryInput {
  readonly fieldId: string;
  readonly farmId: string;
  readonly orgId: string | null;
  readonly ring: readonly LatLng[];
}

/**
 * Persistence contract for a field's boundary. Implementations: local (Phase D)
 * and API (Phase E). Every method is async so the seam never changes shape when
 * the network arrives.
 */
export interface BoundaryRepository {
  load(fieldId: string): Promise<FieldBoundary | null>;
  save(input: SaveBoundaryInput): Promise<FieldBoundary>;
  remove(fieldId: string): Promise<void>;
}

/** Synchronous backing store the local repo drives (provided by the hook from
 *  the Redux slice). */
export interface LocalBoundaryStore {
  read(fieldId: string): FieldBoundary | null;
  write(boundary: FieldBoundary): void;
  delete(fieldId: string): void;
}

/** Injected so the factory stays pure/testable (no `new Date()` inside). */
export interface LocalRepoDeps {
  store: LocalBoundaryStore;
  /** Returns an ISO timestamp. Real impl: () => new Date().toISOString(). */
  now: () => string;
}

/**
 * Local, device-only repository — Phase D. Reads/writes the persisted Redux
 * slice through the injected store, and bumps `version` from whatever was
 * previously stored so the field's version is monotonic even offline.
 */
export const createLocalBoundaryRepository = (deps: LocalRepoDeps): BoundaryRepository => ({
  async load(fieldId) {
    return deps.store.read(fieldId);
  },

  async save(input) {
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
    return boundary;
  },

  async remove(fieldId) {
    deps.store.delete(fieldId);
  },
});
