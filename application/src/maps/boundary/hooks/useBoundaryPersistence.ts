/**
 * src/maps/boundary/hooks/useBoundaryPersistence.ts — load/save a field's
 * boundary through the repository seam.
 *
 * This hook is where Redux is wired to the storage-agnostic `BoundaryRepository`
 * interface. In Phase E, replacing `createLocalBoundaryRepository` with
 * `createApiBoundaryRepository` here is the ONLY change needed to move boundary
 * storage to the server — no component, engine or screen file is touched.
 * (docs/maps/FarmBoundary/ARCHITECTURE.md §5.)
 */

import { useCallback, useMemo, useState } from 'react';
import { useAppDispatch, useAppStore } from '../../../redux/hooks';
import {
  removeBoundary,
  selectBoundary,
  upsertBoundary,
} from '../../../redux/slices/boundarySlice';
import type { LatLng } from '../../types';
import type { FieldBoundary } from '../types';
import {
  createLocalBoundaryRepository,
  type BoundaryRepository,
} from '../services/boundaryRepository';

export interface UseBoundaryPersistence {
  /** Read the saved boundary synchronously from the store (for first paint). */
  readonly saved: FieldBoundary | null;
  readonly saving: boolean;
  readonly deleting: boolean;
  /** Persist a ring for this field. Resolves with the stored boundary (version
   *  bumped). Throws if the ring is unsavable. */
  readonly save: (ring: readonly LatLng[]) => Promise<FieldBoundary>;
  /** Remove this field's boundary. */
  readonly remove: () => Promise<void>;
}

export interface BoundaryPersistenceArgs {
  fieldId: string;
  farmId: string;
  orgId?: string | null;
}

export const useBoundaryPersistence = ({
  fieldId,
  farmId,
  orgId = null,
}: BoundaryPersistenceArgs): UseBoundaryPersistence => {
  const store = useAppStore();
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Bind the local (Phase D) repository to the Redux slice. Swap this line for
  // the API repository in Phase E — nothing else changes.
  const repository: BoundaryRepository = useMemo(
    () =>
      createLocalBoundaryRepository({
        store: {
          read: id => selectBoundary(store.getState(), id),
          write: boundary => dispatch(upsertBoundary(boundary)),
          delete: id => dispatch(removeBoundary(id)),
        },
        now: () => new Date().toISOString(),
      }),
    [store, dispatch],
  );

  // Read synchronously for first paint; the screen also subscribes via a
  // selector so it re-renders after a save.
  const saved = selectBoundary(store.getState(), fieldId);

  const save = useCallback(
    async (ring: readonly LatLng[]) => {
      setSaving(true);
      try {
        return await repository.save({ fieldId, farmId, orgId, ring });
      } finally {
        setSaving(false);
      }
    },
    [repository, fieldId, farmId, orgId],
  );

  const remove = useCallback(async () => {
    setDeleting(true);
    try {
      await repository.remove(fieldId);
    } finally {
      setDeleting(false);
    }
  }, [repository, fieldId]);

  return { saved, saving, deleting, save, remove };
};
