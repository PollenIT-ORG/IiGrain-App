import { useMemo } from 'react';
import { useAppDispatch, useAppStore } from '../../../redux/hooks';
import {
  removeBoundary,
  selectBoundary,
  upsertBoundary,
} from '../../../redux/slices/boundarySlice';
import { fieldBoundarySaved } from '../../../redux/slices/fieldSlice';
import { refreshFarmDetailThunk } from '../../../redux/slices/farmSlice';
import { invalidateTags } from '../../../redux/slices/syncSlice';
import { tagsForSync } from '../../../redux/syncTags';
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
        onServerSaved: event => {
          dispatch(fieldBoundarySaved(event));
          dispatch(refreshFarmDetailThunk(event.farmId));
          dispatch(
            invalidateTags(
              tagsForSync({
                resource: 'field',
                action: 'updated',
                farmId: event.farmId,
                fieldId: event.fieldId,
              }),
            ),
          );
        },
      }),
    [store, dispatch, farmId],
  );
};
