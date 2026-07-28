import { createSlice } from '@reduxjs/toolkit';
import type { Farm } from '../../types/farm';
import { hasNextPage, mergePage, type PageMeta } from '../../types/pagination';
import { logout } from './authSlice';
import {
  fetchFarmsThunk,
  refreshFarmsThunk,
  fetchFarmDetailThunk,
  refreshFarmDetailThunk,
  fetchFarmFieldCountsThunk,
  createFarmThunk,
  updateFarmThunk,
  resetFarmThunk,
  deleteFarmThunk,
} from '../thunks/farmThunks';
import {
  fetchFarmFieldsThunk,
  refreshFarmFieldsThunk,
  createFieldThunk,
  deleteFieldThunk,
} from '../thunks/fieldThunks';

export interface FarmState {
  farms: Farm[];
  farmsMeta: PageMeta | null;
  farmsSearch: string;
  fieldCounts: Record<string, number>;
  selectedFarm: Farm | null;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  detailLoading: boolean;
  detailError: string | null;
  creating: boolean;
  createError: string | null;
  updating: boolean;
  updateError: string | null;
  resetting: boolean;
  deleting: boolean;
}

const initialState: FarmState = {
  farms: [],
  farmsMeta: null,
  farmsSearch: '',
  fieldCounts: {},
  selectedFarm: null,
  loading: false,
  loadingMore: false,
  refreshing: false,
  error: null,
  detailLoading: false,
  detailError: null,
  creating: false,
  createError: null,
  updating: false,
  updateError: null,
  resetting: false,
  deleting: false,
};

const argSearch = (arg: { search?: string } | undefined): string =>
  arg?.search?.trim() ?? '';

const farmSlice = createSlice({
  name: 'farm',
  initialState,
  reducers: {
    clearFarmError(state) {
      state.error = null;
    },
    clearFarmDetailError(state) {
      state.detailError = null;
    },
    clearSelectedFarm(state) {
      state.selectedFarm = null;
      state.detailError = null;
    },
    clearFarmCreateError(state) {
      state.createError = null;
    },
    clearFarmUpdateError(state) {
      state.updateError = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchFarmsThunk.pending, (state, action) => {
        const isMore = (action.meta.arg?.page ?? 1) > 1;
        state.farmsSearch = argSearch(action.meta.arg);
        if (isMore) {
          state.loadingMore = true;
        } else {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchFarmsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        if (argSearch(action.meta.arg) !== state.farmsSearch) {
          return;
        }
        const { farms, meta } = action.payload;
        state.farms = mergePage(state.farms, farms, meta.page, f => f.id);
        state.farmsMeta = meta;
      })
      .addCase(fetchFarmsThunk.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload?.message ?? 'Failed to load farms';
      })
      .addCase(refreshFarmsThunk.pending, (state, action) => {
        state.refreshing = true;
        state.farmsSearch = argSearch(action.meta.arg);
        state.error = null;
      })
      .addCase(refreshFarmsThunk.fulfilled, (state, action) => {
        state.refreshing = false;
        if (argSearch(action.meta.arg) !== state.farmsSearch) {
          return;
        }
        state.farms = action.payload.farms;
        state.farmsMeta = action.payload.meta;
      })
      .addCase(refreshFarmsThunk.rejected, (state, action) => {
        state.refreshing = false;
        state.error = action.payload?.message ?? 'Failed to refresh farms';
      })
      .addCase(fetchFarmFieldCountsThunk.fulfilled, (state, action) => {
        const { counts, overwrite } = action.payload;
        for (const [id, count] of Object.entries(counts)) {
          if (overwrite || state.fieldCounts[id] === undefined) {
            state.fieldCounts[id] = count;
          }
        }
      })
      .addCase(fetchFarmFieldsThunk.fulfilled, (state, action) => {
        state.fieldCounts[action.payload.farmId] = action.payload.fields.length;
      })
      .addCase(refreshFarmFieldsThunk.fulfilled, (state, action) => {
        state.fieldCounts[action.payload.farmId] = action.payload.fields.length;
      })
      .addCase(createFieldThunk.fulfilled, (state, action) => {
        const { farmId } = action.payload;
        if (state.fieldCounts[farmId] !== undefined) {
          state.fieldCounts[farmId] += 1;
        }
      })
      .addCase(fetchFarmDetailThunk.pending, state => {
        state.detailLoading = true;
        state.detailError = null;
        state.selectedFarm = null;
      })
      .addCase(fetchFarmDetailThunk.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.selectedFarm = action.payload;
      })
      .addCase(fetchFarmDetailThunk.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload?.message ?? 'Failed to load farm details';
      })
      .addCase(refreshFarmDetailThunk.fulfilled, (state, action) => {
        if (state.selectedFarm?.id === action.payload.id) {
          state.selectedFarm = action.payload;
        }
      })
      .addCase(createFarmThunk.pending, state => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createFarmThunk.fulfilled, (state, action) => {
        state.creating = false;
        state.farms = [action.payload, ...state.farms];
        if (state.farmsMeta) {
          state.farmsMeta.total += 1;
        }
      })
      .addCase(createFarmThunk.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload?.message ?? 'Failed to create farm';
      })
      .addCase(updateFarmThunk.pending, state => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateFarmThunk.fulfilled, (state, action) => {
        state.updating = false;
        const updated = action.payload;
        state.farms = state.farms.map(f => (f.id === updated.id ? updated : f));
        if (state.selectedFarm?.id === updated.id) {
          state.selectedFarm = updated;
        }
      })
      .addCase(updateFarmThunk.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload?.message ?? 'Failed to update farm';
      })
      .addCase(resetFarmThunk.pending, state => {
        state.resetting = true;
        state.error = null;
      })
      .addCase(resetFarmThunk.fulfilled, (state, action) => {
        state.resetting = false;
        const reset = action.payload;
        state.farms = state.farms.map(f => (f.id === reset.id ? reset : f));
        if (state.selectedFarm?.id === reset.id) {
          state.selectedFarm = reset;
        }
      })
      .addCase(resetFarmThunk.rejected, (state, action) => {
        state.resetting = false;
        state.error = action.payload?.message ?? 'Failed to reset farm';
      })
      .addCase(deleteFarmThunk.pending, state => {
        state.deleting = true;
        state.error = null;
      })
      .addCase(deleteFarmThunk.fulfilled, (state, action) => {
        state.deleting = false;
        const farmId = action.payload;
        state.farms = state.farms.filter(f => f.id !== farmId);
        delete state.fieldCounts[farmId];
        if (state.selectedFarm?.id === farmId) {
          state.selectedFarm = null;
        }
        if (state.farmsMeta && state.farmsMeta.total > 0) {
          state.farmsMeta.total -= 1;
        }
      })
      .addCase(deleteFarmThunk.rejected, (state, action) => {
        state.deleting = false;
        state.error = action.payload?.message ?? 'Failed to delete farm';
      })
      .addCase(deleteFieldThunk.fulfilled, (state, action) => {
        const { farmId } = action.payload;
        const current = state.fieldCounts[farmId];
        if (current !== undefined && current > 0) {
          state.fieldCounts[farmId] = current - 1;
        }
      })
      .addCase(logout, () => initialState);
  },
});

export const {
  clearFarmError,
  clearFarmDetailError,
  clearSelectedFarm,
  clearFarmCreateError,
  clearFarmUpdateError,
} = farmSlice.actions;
export default farmSlice.reducer;

export {
  fetchFarmsThunk,
  refreshFarmsThunk,
  fetchFarmDetailThunk,
  refreshFarmDetailThunk,
  fetchFarmFieldCountsThunk,
  createFarmThunk,
  updateFarmThunk,
  resetFarmThunk,
  deleteFarmThunk,
};

interface HasFarm {
  farm: FarmState;
}

export const selectFarms = (s: HasFarm): Farm[] => s.farm.farms;
export const selectFarmsMeta = (s: HasFarm): PageMeta | null => s.farm.farmsMeta;
export const selectFarmsSearch = (s: HasFarm): string => s.farm.farmsSearch;
export const selectFarmsLoadingMore = (s: HasFarm): boolean => s.farm.loadingMore;
export const selectFarmsHasMore = (s: HasFarm): boolean => hasNextPage(s.farm.farmsMeta);
export const selectFarmsTotal = (s: HasFarm): number =>
  s.farm.farmsMeta?.total ?? s.farm.farms.length;
export const selectFarmFieldCounts = (s: HasFarm): Record<string, number> =>
  s.farm.fieldCounts;
export const selectSelectedFarm = (s: HasFarm): Farm | null => s.farm.selectedFarm;
export const selectFarmsLoading = (s: HasFarm): boolean => s.farm.loading;
export const selectFarmsRefreshing = (s: HasFarm): boolean => s.farm.refreshing;
export const selectFarmsError = (s: HasFarm): string | null => s.farm.error;
export const selectFarmDetailLoading = (s: HasFarm): boolean => s.farm.detailLoading;
export const selectFarmDetailError = (s: HasFarm): string | null => s.farm.detailError;
export const selectFarmCreating = (s: HasFarm): boolean => s.farm.creating;
export const selectFarmCreateError = (s: HasFarm): string | null => s.farm.createError;
export const selectFarmUpdating = (s: HasFarm): boolean => s.farm.updating;
export const selectFarmUpdateError = (s: HasFarm): string | null => s.farm.updateError;
export const selectFarmResetting = (s: HasFarm): boolean => s.farm.resetting;
export const selectFarmDeleting = (s: HasFarm): boolean => s.farm.deleting;
