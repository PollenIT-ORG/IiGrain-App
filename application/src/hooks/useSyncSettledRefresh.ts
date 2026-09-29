import { useEffect } from 'react';
import { useAppDispatch, useAppStore } from '../redux/hooks';
import { bumpSyncEpoch } from '../redux/slices/syncSlice';
import { refreshFarmFieldsThunk, selectFieldsFarmId } from '../redux/slices/fieldSlice';
import { refreshFarmDetailThunk, selectSelectedFarm } from '../redux/slices/farmSlice';
import { isDatabaseReady } from '../services/db';
import { getSyncSubsystem, subscribeToSyncQueue, syncQueue } from '../services/sync';

export const useSyncSettledRefresh = (): void => {
  const dispatch = useAppDispatch();
  const store = useAppStore();

  useEffect(() => {
    let alive = true;
    let outstanding: number | null = null;

    const refreshWhenSettled = async (): Promise<void> => {
      if (!isDatabaseReady()) {
        return;
      }
      const owner = getSyncSubsystem().owner();
      if (!owner) {
        outstanding = null;
        return;
      }
      const pending = await syncQueue.countPending(owner).catch(() => null);
      if (!alive || pending === null) {
        return;
      }
      const settled = outstanding !== null && pending < outstanding;
      outstanding = pending;
      if (!settled) {
        return;
      }
      const state = store.getState();
      dispatch(bumpSyncEpoch());
      const fieldsFarmId = selectFieldsFarmId(state);
      if (fieldsFarmId) {
        dispatch(refreshFarmFieldsThunk(fieldsFarmId));
      }
      const farm = selectSelectedFarm(state);
      if (farm) {
        dispatch(refreshFarmDetailThunk(farm.id));
      }
    };

    refreshWhenSettled().catch(() => undefined);
    const unsubscribe = subscribeToSyncQueue(() => {
      refreshWhenSettled().catch(() => undefined);
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [dispatch, store]);
};
