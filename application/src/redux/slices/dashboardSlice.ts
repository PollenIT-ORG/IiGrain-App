import {
  createAsyncThunk,
  createSelector,
  createSlice,
  PayloadAction,
} from '@reduxjs/toolkit';
import * as dashboardApi from '../../api/dashboardApi';
import type { DashboardFarm, DashboardFarms, FarmDashboard } from '../../types/dashboard';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';
import { logout } from './authSlice';

type ThunkConfig = { rejectValue: StandardizedError };

export interface DashboardState {
  farms: DashboardFarm[];
  defaultFarmId: string | null;
  selectedFarmId: string | null;
  farmsLoading: boolean;
  farmsError: string | null;
  farmsRequestId: string | null;

  dashboard: FarmDashboard | null;
  requestedFarmId: string | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
}

const initialState: DashboardState = {
  farms: [],
  defaultFarmId: null,
  selectedFarmId: null,
  farmsLoading: true,
  farmsError: null,
  farmsRequestId: null,
  dashboard: null,
  requestedFarmId: null,
  dashboardLoading: false,
  dashboardError: null,
};

export const fetchDashboardFarmsThunk = createAsyncThunk<DashboardFarms, void, ThunkConfig>(
  'dashboard/fetchFarms',
  async (_, { rejectWithValue }) => {
    try {
      return await dashboardApi.getDashboardFarms();
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const fetchFarmDashboardThunk = createAsyncThunk<FarmDashboard, string, ThunkConfig>(
  'dashboard/fetchFarm',
  async (farmId, { rejectWithValue }) => {
    try {
      return await dashboardApi.getFarmDashboard(farmId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setSelectedFarmId(state, action: PayloadAction<string>) {
      state.selectedFarmId = action.payload;
    },
    clearDashboardError(state) {
      state.farmsError = null;
      state.dashboardError = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchDashboardFarmsThunk.pending, (state, action) => {
        state.farmsLoading = true;
        state.farmsError = null;
        state.farmsRequestId = action.meta.requestId;
      })
      .addCase(fetchDashboardFarmsThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.farmsRequestId) {
          return;
        }
        state.farmsLoading = false;
        state.farms = action.payload.farms;
        state.defaultFarmId = action.payload.defaultFarmId;
        const stillValid =
          state.selectedFarmId !== null &&
          action.payload.farms.some(f => f.id === state.selectedFarmId);
        if (!stillValid) {
          const next = action.payload.defaultFarmId ?? action.payload.farms[0]?.id ?? null;
          state.selectedFarmId = next;
          if (next === null) {
            state.dashboard = null;
            state.dashboardError = null;
            state.dashboardLoading = false;
            state.requestedFarmId = null;
          }
        }
      })
      .addCase(fetchDashboardFarmsThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.farmsRequestId) {
          return;
        }
        state.farmsLoading = false;
        state.farmsError = action.payload?.message ?? 'Failed to load farms';
      })
      .addCase(fetchFarmDashboardThunk.pending, (state, action) => {
        state.dashboardLoading = true;
        state.dashboardError = null;
        state.requestedFarmId = action.meta.arg;
        if (state.dashboard && state.dashboard.farm.id !== action.meta.arg) {
          state.dashboard = null;
        }
      })
      .addCase(fetchFarmDashboardThunk.fulfilled, (state, action) => {
        if (action.meta.arg !== state.requestedFarmId) {
          return;
        }
        state.dashboardLoading = false;
        state.dashboard = action.payload;
      })
      .addCase(fetchFarmDashboardThunk.rejected, (state, action) => {
        if (action.meta.arg !== state.requestedFarmId) {
          return;
        }
        state.dashboardLoading = false;
        state.dashboardError = action.payload?.message ?? 'Failed to load dashboard';
      })
      .addCase(logout, () => initialState);
  },
});

export const { setSelectedFarmId, clearDashboardError } = dashboardSlice.actions;
export default dashboardSlice.reducer;

interface HasDashboard {
  dashboard: DashboardState;
}

const EMPTY_FARMS: DashboardFarm[] = [];

export const selectDashboardFarms = (s: HasDashboard): DashboardFarm[] =>
  s.dashboard.farms.length ? s.dashboard.farms : EMPTY_FARMS;
export const selectSelectedFarmId = (s: HasDashboard): string | null =>
  s.dashboard.selectedFarmId;
export const selectDashboardDefaultFarmId = (s: HasDashboard): string | null =>
  s.dashboard.defaultFarmId;
export const selectDashboardFarmsLoading = (s: HasDashboard): boolean =>
  s.dashboard.farmsLoading;
export const selectDashboardFarmsError = (s: HasDashboard): string | null =>
  s.dashboard.farmsError;

export const selectSelectedDashboardFarm = createSelector(
  [selectDashboardFarms, selectSelectedFarmId],
  (farms, id): DashboardFarm | null => farms.find(f => f.id === id) ?? null,
);

export const selectFarmDashboard = (s: HasDashboard): FarmDashboard | null =>
  s.dashboard.dashboard;
export const selectDashboardLoading = (s: HasDashboard): boolean =>
  s.dashboard.dashboardLoading;
export const selectDashboardError = (s: HasDashboard): string | null =>
  s.dashboard.dashboardError;
