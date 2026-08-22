import { useCallback } from 'react';
import { useAppDispatch } from '../redux/hooks';
import { fetchAssessorFieldsThunk } from '../redux/thunks/assessorThunks';
import { useSyncedFetch } from './useSyncedFetch';
import { Tags } from '../redux/syncTags';

const ASSESSOR_OVERVIEW_TTL_MS = 5 * 60 * 1000;

export const useAssessorOverviewSync = (hasOverview: boolean): void => {
  const dispatch = useAppDispatch();
  const run = useCallback(() => {
    dispatch(fetchAssessorFieldsThunk());
  }, [dispatch]);

  useSyncedFetch({
    tags: [Tags.assessorOverview],
    run,
    hasData: hasOverview,
    ttlMs: ASSESSOR_OVERVIEW_TTL_MS,
  });
};
