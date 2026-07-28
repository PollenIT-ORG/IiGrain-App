import { useCallback } from 'react';
import { useAppDispatch } from '../redux/hooks';
import { fetchAssessorFieldsThunk } from '../redux/thunks/assessorThunks';
import { useSyncedFetch } from './useSyncedFetch';
import { Tags } from '../redux/syncTags';

/** The overview is one blob shared by every assessor screen; refresh it hourly at most. */
const ASSESSOR_OVERVIEW_TTL_MS = 5 * 60 * 1000;

/**
 * Keeps the shared assessor `fieldsOverview` fresh.
 *
 * Five assessor screens read the same single cache slot. They used to fetch it
 * only when it was empty, which meant it was never refreshed once loaded — an
 * assignment change or a submitted assessment left every list stale until a
 * manual pull-to-refresh. Routing them all through one tag fixes both ends:
 * the socket invalidates on assignment/assessment changes, and because
 * `useSyncedFetch` is focus-gated, only the visible screen refetches instead of
 * all five racing for the same slot.
 */
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
