import { createSlice } from '@reduxjs/toolkit';
import type { Farm } from '../../types/farm';
import { logout } from './authSlice';
import {
  fetchFarmsThunk,
  refreshFarmsThunk,
  fetchFarmDetailThunk,
  fetchFarmFieldCountsThunk,
  createFarmThunk,
  updateFarmThunk,
} from '../thunks/farmThunks';
import {
  fetchFarmFieldsThunk,
  refreshFarmFieldsThunk,
  createFieldThunk,
} from '../thunks/fieldThunks';

export interface FarmState {
  farms: Farm[];
  fieldCounts: Record<string, number>;
  selectedFarm: Farm | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  detailLoading: boolean;
  detailError: string | null;
  creating: boolean;
  createError: string | null;
  updating: boolean;
  updateError: string | null;
}

const initialState: FarmState = {
  farms: [],
  fieldCounts: {},
  selectedFarm: null,
  loading: false,
  refreshing: false,
  error: null,
  detailLoading: false,
  detailError: null,
  creating: false,
  createError: null,
  updating: false,
  updateError: null,
};

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
      .addCase(fetchFarmsThunk.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFarmsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.farms = action.payload;
      })
      .addCase(fetchFarmsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load farms';
      })
      .addCase(refreshFarmsThunk.pending, state => {
        state.refreshing = true;
        state.error = null;
      })
      .addCase(refreshFarmsThunk.fulfilled, (state, action) => {
        state.refreshing = false;
        state.farms = action.payload;
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
      .addCase(createFarmThunk.pending, state => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createFarmThunk.fulfilled, (state, action) => {
        state.creating = false;
        state.farms = [action.payload, ...state.farms];
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
  fetchFarmFieldCountsThunk,
  createFarmThunk,
  updateFarmThunk,
};

interface HasFarm {
  farm: FarmState;
}

export const selectFarms = (s: HasFarm): Farm[] => s.farm.farms;
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
