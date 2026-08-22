import type { LatLng } from '../../types';
import type { FieldBoundary } from '../types';
import { buildFieldBoundary } from './boundaryFactory';

export interface SaveBoundaryInput {
  readonly fieldId: string;
  readonly farmId: string;
  readonly orgId: string | null;
  readonly ring: readonly LatLng[];
}

export interface BoundaryRepository {
  load(fieldId: string): Promise<FieldBoundary | null>;
  save(input: SaveBoundaryInput): Promise<FieldBoundary>;
  remove(fieldId: string): Promise<void>;
}

export interface LocalBoundaryStore {
  read(fieldId: string): FieldBoundary | null;
  write(boundary: FieldBoundary): void;
  delete(fieldId: string): void;
}

export interface LocalRepoDeps {
  store: LocalBoundaryStore;
  now: () => string;
}

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
