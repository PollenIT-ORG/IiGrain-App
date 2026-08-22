import { useCallback, useEffect, useState } from 'react';
import { useAppSelector } from '../../../redux/hooks';
import { selectBoundary } from '../../../redux/slices/boundarySlice';
import type { LatLng } from '../../types';
import type { FieldBoundary } from '../types';
import { useBoundaryRepository } from './useBoundaryRepository';

export interface UseBoundaryPersistence {
  readonly saved: FieldBoundary | null;
  readonly saving: boolean;
  readonly deleting: boolean;
  readonly hydrating: boolean;
  readonly save: (ring: readonly LatLng[]) => Promise<FieldBoundary>;
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const repository = useBoundaryRepository(farmId);

  const saved = useAppSelector(state => selectBoundary(state, fieldId));

  const [hydrating, setHydrating] = useState(false);
  useEffect(() => {
    if (!fieldId || !farmId) {
      return;
    }
    let alive = true;
    setHydrating(true);
    repository
      .load(fieldId)
      .catch(() => null)
      .finally(() => {
        if (alive) {
          setHydrating(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [repository, fieldId, farmId]);

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

  return { saved, saving, deleting, hydrating, save, remove };
};
