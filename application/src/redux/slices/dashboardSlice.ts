import {
  createAsyncThunk,
  createSelector,
  createSlice,
  PayloadAction,
} from '@reduxjs/toolkit';
import * as dashboardApi from '../../api/dashboardApi';
import type { DashboardFarm, DashboardFarms, FarmDashboard } from '../../types/dashboard';
import { hasNextPage, mergePage, type PageMeta, type PageQuery } from '../../types/pagination';
import { createFarmThunk, deleteFarmThunk, resetFarmThunk } from '../thunks/farmThunks';
import { createFieldThunk, deleteFieldThunk, resetFieldThunk } from '../thunks/fieldThunks';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';
import { logout } from './authSlice';

type ThunkConfig = { rejectValue: StandardizedError };

export interface DashboardState {
  farms: DashboardFarm[];
  farmsMeta: PageMeta | null;
  defaultFarmId: string | null;
  selectedFarmId: string | null;
  farmsLoading: boolean;
  farmsLoadingMore: boolean;
  farmsError: string | null;
  farmsRequestId: string | null;

  dashboard: FarmDashboard | null;
  requestedFarmId: string | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  /** farmId:year of the in-flight request, used to dedupe identical fetches. */
  requestedKey: string | null;
  /** Year the loaded dashboard is scoped to; set from the response. */
  selectedYear: number | null;

  /**
   * Farms whose dashboard (regen health index) is known to be out of date because
   * an assessment answer was written for one of their fields. The home screen
   * refetches on focus when its selected farm is listed here; the entry is dropped
   * as soon as a dashboard fetch for that farm succeeds.
   */
  staleFarmIds: string[];
}

const initialState: DashboardState = {
  farms: [],
  farmsMeta: null,
  defaultFarmId: null,
  selectedFarmId: null,
  farmsLoading: true,
  farmsLoadingMore: false,
  farmsError: null,
  farmsRequestId: null,
  dashboard: null,
  requestedFarmId: null,
  dashboardLoading: false,
  dashboardError: null,
  requestedKey: null,
  selectedYear: null,
  staleFarmIds: [],
};

export const fetchDashboardFarmsThunk = createAsyncThunk<
  DashboardFarms,
  PageQuery | undefined,
  ThunkConfig
>('dashboard/fetchFarms', async (query, { rejectWithValue }) => {
  try {
    return await dashboardApi.getDashboardFarms(query);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export interface FarmDashboardArg {
  farmId: string;
  /** Omit for the backend default: the latest year that actually has data. */
  year?: number;
  trendYears?: number;
}

/** Identity of a dashboard request — a year change for the same farm is a
 *  different request and must not be deduped away. */
const dashboardKey = (arg: FarmDashboardArg): string =>
  `${arg.farmId}:${arg.year ?? 'default'}`;

export const fetchFarmDashboardThunk = createAsyncThunk<
  FarmDashboard,
  FarmDashboardArg,
  ThunkConfig
>(
  'dashboard/fetchFarm',
  async ({ farmId, year, trendYears }, { rejectWithValue }) => {
    try {
      return await dashboardApi.getFarmDashboard(farmId, { year, trendYears });
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    // Home and Reports both read this single dashboard slot and both react to a
    // farm change, so without this they fire the same request twice. An
    // in-flight fetch for the same farm+year wins; any other combination still
    // goes through so switching stays instant.
    condition: (arg, { getState }) => {
      const { dashboard } = getState() as { dashboard: DashboardState };
      return !(
        dashboard.dashboardLoading && dashboard.requestedKey === dashboardKey(arg)
      );
    },
  },
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setSelectedFarmId(state, action: PayloadAction<string>) {
      if (state.selectedFarmId !== action.payload) {
        // Years are per farm, so the next payload decides the year again.
        state.selectedYear = null;
      }
      state.selectedFarmId = action.payload;
    },
    clearDashboardError(state) {
      state.farmsError = null;
      state.dashboardError = null;
    },
    markDashboardStale(state, action: PayloadAction<string>) {
      if (!state.staleFarmIds.includes(action.payload)) {
        state.staleFarmIds.push(action.payload);
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchDashboardFarmsThunk.pending, (state, action) => {
        if ((action.meta.arg?.page ?? 1) > 1) {
          state.farmsLoadingMore = true;
        } else {
          state.farmsLoading = true;
        }
        state.farmsError = null;
        state.farmsRequestId = action.meta.requestId;
      })
      .addCase(fetchDashboardFarmsThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.farmsRequestId) {
          return;
        }
        state.farmsLoading = false;
        state.farmsLoadingMore = false;
        const { farms, defaultFarmId, meta } = action.payload;
        state.farms = mergePage(state.farms, farms, meta.page, f => f.id);
        state.farmsMeta = meta;
        state.defaultFarmId = defaultFarmId;

        // A selection may legitimately live on a page we have not fetched yet,
        // so it is only invalidated once the whole list has been seen.
        const listIsComplete = state.farms.length >= meta.total;
        const stillValid =
          state.selectedFarmId !== null &&
          (!listIsComplete || state.farms.some(f => f.id === state.selectedFarmId));
        if (!stillValid) {
          const next = defaultFarmId ?? state.farms[0]?.id ?? null;
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
        state.farmsLoadingMore = false;
        state.farmsError = action.payload?.message ?? 'Failed to load farms';
      })
      .addCase(fetchFarmDashboardThunk.pending, (state, action) => {
        state.dashboardLoading = true;
        state.dashboardError = null;
        state.requestedFarmId = action.meta.arg.farmId;
        state.requestedKey = dashboardKey(action.meta.arg);
        if (state.dashboard && state.dashboard.farm.id !== action.meta.arg.farmId) {
          state.dashboard = null;
        }
      })
      .addCase(fetchFarmDashboardThunk.fulfilled, (state, action) => {
        // Cleared even for a stale response: the data we just received for this
        // farm is newer than the write that flagged it.
        const { farmId } = action.meta.arg;
        state.staleFarmIds = state.staleFarmIds.filter(id => id !== farmId);
        if (dashboardKey(action.meta.arg) !== state.requestedKey) {
          return;
        }
        state.dashboardLoading = false;
        state.dashboard = action.payload;
        // The backend owns the default year, so the picker follows the payload
        // instead of the app guessing.
        state.selectedYear = action.payload.year;
      })
      .addCase(fetchFarmDashboardThunk.rejected, (state, action) => {
        if (dashboardKey(action.meta.arg) !== state.requestedKey) {
          return;
        }
        state.dashboardLoading = false;
        state.dashboardError = action.payload?.message ?? 'Failed to load dashboard';
      })
      // Home is a mounted tab, so its mount-time fetch does not re-run after a
      // farm is created elsewhere. Without this the farmer creates their first
      // farm and comes back to the "no farms yet" empty state.
      .addCase(createFarmThunk.fulfilled, (state, action) => {
        const farm = action.payload;
        if (state.farms.some(f => f.id === farm.id)) {
          return;
        }
        state.farms = [
          { id: farm.id, name: farm.name, fieldCount: farm.fieldsCount ?? 0 },
          ...state.farms,
        ];
        if (state.farmsMeta) {
          state.farmsMeta.total += 1;
        }
        // The farmer's very first farm becomes the selected one, which lets the
        // dashboard fetch start immediately instead of waiting for a refetch.
        if (state.selectedFarmId === null) {
          state.selectedFarmId = farm.id;
        }
      })
      // A new field changes the farm's fieldCount and its regen numbers.
      .addCase(createFieldThunk.fulfilled, (state, action) => {
        const { farmId } = action.payload;
        const farm = state.farms.find(f => f.id === farmId);
        if (farm) {
          farm.fieldCount += 1;
        }
        if (!state.staleFarmIds.includes(farmId)) {
          state.staleFarmIds.push(farmId);
        }
      })
      // The dashboard keeps its own farm list, so a farm deleted from the farms
      // tab has to be dropped here too or it lingers in the Home selector.
      .addCase(deleteFarmThunk.fulfilled, (state, action) => {
        const farmId = action.payload;
        state.farms = state.farms.filter(f => f.id !== farmId);
        state.staleFarmIds = state.staleFarmIds.filter(id => id !== farmId);
        if (state.farmsMeta && state.farmsMeta.total > 0) {
          state.farmsMeta.total -= 1;
        }
        if (state.defaultFarmId === farmId) {
          state.defaultFarmId = null;
        }
        if (state.selectedFarmId === farmId) {
          state.selectedFarmId = state.farms[0]?.id ?? null;
          state.dashboard = null;
          state.dashboardError = null;
          state.dashboardLoading = false;
          state.requestedFarmId = null;
        }
      })
      // Resetting a farm, or resetting/deleting one of its fields, changes the
      // numbers this dashboard shows, so it is flagged for a refetch on focus.
      .addCase(resetFarmThunk.fulfilled, (state, action) => {
        const farmId = action.payload.id;
        if (!state.staleFarmIds.includes(farmId)) {
          state.staleFarmIds.push(farmId);
        }
      })
      .addCase(deleteFieldThunk.fulfilled, (state, action) => {
        const { farmId } = action.payload;
        if (!state.staleFarmIds.includes(farmId)) {
          state.staleFarmIds.push(farmId);
        }
      })
      .addCase(resetFieldThunk.fulfilled, (state, action) => {
        const { farmId } = action.payload;
        if (!state.staleFarmIds.includes(farmId)) {
          state.staleFarmIds.push(farmId);
        }
      })
      .addCase(logout, () => initialState);
  },
});

export const { setSelectedFarmId, clearDashboardError, markDashboardStale } =
  dashboardSlice.actions;
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
export const selectDashboardFarmsLoadingMore = (s: HasDashboard): boolean =>
  s.dashboard.farmsLoadingMore;
export const selectDashboardFarmsHasMore = (s: HasDashboard): boolean =>
  hasNextPage(s.dashboard.farmsMeta);
export const selectDashboardFarmsPage = (s: HasDashboard): number =>
  s.dashboard.farmsMeta?.page ?? 1;
export const selectDashboardFarmsTotal = (s: HasDashboard): number =>
  s.dashboard.farmsMeta?.total ?? s.dashboard.farms.length;

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
export const selectDashboardYear = (s: HasDashboard): number | null =>
  s.dashboard.selectedYear;

export const selectStaleFarmIds = (s: HasDashboard): string[] => s.dashboard.staleFarmIds;

/**
 * True when the farm currently selected on the home screen has a pending
 * assessment write that its regen health index has not picked up yet.
 */
export const selectSelectedFarmIsStale = createSelector(
  [selectStaleFarmIds, selectSelectedFarmId],
  (staleIds, selectedId): boolean => selectedId !== null && staleIds.includes(selectedId),
);
