import { useMemo } from 'react';
import { useAppDispatch, useAppStore } from '../../../redux/hooks';
import {
  removeBoundary,
  selectBoundary,
  upsertBoundary,
} from '../../../redux/slices/boundarySlice';
import type { BoundaryRepository } from '../services/boundaryRepository';
import { createRemoteBoundaryRepository } from '../services/remoteBoundaryRepository';

export const useBoundaryRepository = (farmId: string): BoundaryRepository => {
  const store = useAppStore();
  const dispatch = useAppDispatch();

  return useMemo(
    () =>
      createRemoteBoundaryRepository({
        store: {
          read: id => selectBoundary(store.getState(), id),
          write: boundary => dispatch(upsertBoundary(boundary)),
          delete: id => dispatch(removeBoundary(id)),
        },
        now: () => new Date().toISOString(),
        farmIdForField: () => farmId,
      }),
    [store, dispatch, farmId],
  );
};
