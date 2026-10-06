import {
  createAsyncThunk,
  createSelector,
  createSlice,
  PayloadAction,
} from '@reduxjs/toolkit';
import * as dashboardApi from '../../api/dashboardApi';
import type { DashboardProgram, DashboardPrograms, ProgramDashboard } from '../../types/dashboard';
import { hasNextPage, mergePage, type PageMeta, type PageQuery } from '../../types/pagination';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';
import { logout } from './authSlice';
import { asOwnerUserId, isDatabaseReady } from '../../services/db';
import type { OwnerUserId } from '../../services/db/types';
import {
  PROGRAMS_SCOPE,
  readSnapshot,
  saveSnapshot,
} from '../../services/sync/dashboardCache';

type ThunkConfig = { rejectValue: StandardizedError };

type DashboardThunkConfig = ThunkConfig & {
  fulfilledMeta: { capturedAt: string | null };
};

export interface DashboardState {
  programs: DashboardProgram[];
  programsMeta: PageMeta | null;
  defaultProgramId: string | null;
  selectedProgramId: string | null;
  programsLoading: boolean;
  programsLoadingMore: boolean;
  programsError: string | null;
  programsRequestId: string | null;

  dashboard: ProgramDashboard | null;
  requestedProgramId: string | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  requestedKey: string | null;
  selectedYear: number | null;

  dashboardCapturedAt: string | null;
}

const initialState: DashboardState = {
  programs: [],
  programsMeta: null,
  defaultProgramId: null,
  selectedProgramId: null,
  programsLoading: true,
  programsLoadingMore: false,
  programsError: null,
  programsRequestId: null,
  dashboard: null,
  requestedProgramId: null,
  dashboardLoading: false,
  dashboardError: null,
  requestedKey: null,
  selectedYear: null,
  dashboardCapturedAt: null,
};

interface AuthStateSlice {
  auth?: { user?: { id?: string } | null } | null;
}

const ownerFrom = (getState: () => unknown): OwnerUserId | null => {
  if (!isDatabaseReady()) {
    return null;
  }
  const userId = (getState() as AuthStateSlice).auth?.user?.id;
  return userId ? asOwnerUserId(userId) : null;
};

export const fetchDashboardProgramsThunk = createAsyncThunk<
  DashboardPrograms,
  PageQuery | undefined,
  ThunkConfig
>('dashboard/fetchPrograms', async (query, { getState, rejectWithValue }) => {
  const owner = ownerFrom(getState);
  try {
    const result = await dashboardApi.getDashboardPrograms(query);
    if (owner) {
      await saveSnapshot(owner, PROGRAMS_SCOPE, result).catch(() => undefined);
    }
    return result;
  } catch (error) {
    const standardized = handleApiError(error);
    if (owner && standardized.kind === 'offline') {
      const cached = await readSnapshot<DashboardPrograms>(owner, PROGRAMS_SCOPE).catch(
        () => null,
      );
      if (cached) {
        return cached.payload;
      }
    }
    return rejectWithValue(standardized);
  }
});

export interface ProgramDashboardArg {
  programId: string;
  year?: number;
  trendYears?: number;
}

const dashboardKey = (arg: ProgramDashboardArg): string =>
  `${arg.programId}:${arg.year ?? 'default'}`;

export const fetchProgramDashboardThunk = createAsyncThunk<
  ProgramDashboard,
  ProgramDashboardArg,
  DashboardThunkConfig
>(
  'dashboard/fetchProgram',
  async (
    { programId, year, trendYears },
    { getState, rejectWithValue, fulfillWithValue },
  ) => {
    const owner = ownerFrom(getState);
    try {
      const result = await dashboardApi.getProgramDashboard(programId, { year, trendYears });
      if (owner) {
        await saveSnapshot(owner, programId, result, result.year).catch(() => undefined);
        await saveSnapshot(owner, programId, result, null).catch(() => undefined);
      }
      return fulfillWithValue(result, { capturedAt: null });
    } catch (error) {
      const standardized = handleApiError(error);
      if (owner && standardized.kind === 'offline') {
        const cached = await readSnapshot<ProgramDashboard>(owner, programId, year).catch(
          () => null,
        );
        if (cached) {
          return fulfillWithValue(cached.payload, { capturedAt: cached.capturedAt });
        }
      }
      return rejectWithValue(standardized);
    }
  },
  {
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
    setSelectedProgramId(state, action: PayloadAction<string>) {
      if (state.selectedProgramId !== action.payload) {
        state.selectedYear = null;
      }
      state.selectedProgramId = action.payload;
    },
    clearDashboardError(state) {
      state.programsError = null;
      state.dashboardError = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchDashboardProgramsThunk.pending, (state, action) => {
        if ((action.meta.arg?.page ?? 1) > 1) {
          state.programsLoadingMore = true;
        } else {
          state.programsLoading = true;
        }
        state.programsError = null;
        state.programsRequestId = action.meta.requestId;
      })
      .addCase(fetchDashboardProgramsThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.programsRequestId) {
          return;
        }
        state.programsLoading = false;
        state.programsLoadingMore = false;
        const { programs, defaultProgramId, meta } = action.payload;
        if (meta.page <= 1 && state.programs.length > programs.length) {
          const incomingIds = new Set(programs.map(p => p.id));
          const extra = state.programs.filter(p => !incomingIds.has(p.id));
          state.programs = [...programs, ...extra];
        } else {
          state.programs = mergePage(state.programs, programs, meta.page, p => p.id);
        }
        state.programsMeta = meta;
        state.defaultProgramId = defaultProgramId;

        const listIsComplete = state.programs.length >= meta.total;
        const stillValid =
          state.selectedProgramId !== null &&
          (!listIsComplete || state.programs.some(p => p.id === state.selectedProgramId));
        if (!stillValid) {
          const next = defaultProgramId ?? state.programs[0]?.id ?? null;
          state.selectedProgramId = next;
          if (next === null) {
            state.dashboard = null;
            state.dashboardError = null;
            state.dashboardLoading = false;
            state.requestedProgramId = null;
          }
        }
      })
      .addCase(fetchDashboardProgramsThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.programsRequestId) {
          return;
        }
        state.programsLoading = false;
        state.programsLoadingMore = false;
        state.programsError = action.payload?.message ?? 'Failed to load programs';
      })
      .addCase(fetchProgramDashboardThunk.pending, (state, action) => {
        state.dashboardLoading = true;
        state.dashboardError = null;
        state.requestedProgramId = action.meta.arg.programId;
        state.requestedKey = dashboardKey(action.meta.arg);
        if (state.dashboard && state.dashboard.program.id !== action.meta.arg.programId) {
          state.dashboard = null;
        }
      })
      .addCase(fetchProgramDashboardThunk.fulfilled, (state, action) => {
        if (dashboardKey(action.meta.arg) !== state.requestedKey) {
          return;
        }
        state.dashboardLoading = false;
        state.dashboard = action.payload;
        state.selectedYear = action.payload.year;
        state.dashboardCapturedAt = action.meta.capturedAt ?? null;
      })
      .addCase(fetchProgramDashboardThunk.rejected, (state, action) => {
        if (dashboardKey(action.meta.arg) !== state.requestedKey) {
          return;
        }
        state.dashboardLoading = false;
        state.dashboardError = action.payload?.message ?? 'Failed to load dashboard';
      })
      .addCase(logout, () => initialState);
  },
});

export const { setSelectedProgramId, clearDashboardError } = dashboardSlice.actions;
export default dashboardSlice.reducer;

interface HasDashboard {
  dashboard: DashboardState;
}

const EMPTY_PROGRAMS: DashboardProgram[] = [];

export const selectDashboardPrograms = (s: HasDashboard): DashboardProgram[] =>
  s.dashboard.programs.length ? s.dashboard.programs : EMPTY_PROGRAMS;
export const selectSelectedProgramId = (s: HasDashboard): string | null =>
  s.dashboard.selectedProgramId;
export const selectDashboardDefaultProgramId = (s: HasDashboard): string | null =>
  s.dashboard.defaultProgramId;
export const selectDashboardProgramsLoading = (s: HasDashboard): boolean =>
  s.dashboard.programsLoading;
export const selectDashboardProgramsError = (s: HasDashboard): string | null =>
  s.dashboard.programsError;
export const selectDashboardProgramsLoadingMore = (s: HasDashboard): boolean =>
  s.dashboard.programsLoadingMore;
export const selectDashboardProgramsHasMore = (s: HasDashboard): boolean =>
  hasNextPage(s.dashboard.programsMeta);
export const selectDashboardProgramsPage = (s: HasDashboard): number =>
  s.dashboard.programsMeta?.page ?? 1;
export const selectDashboardProgramsLoaded = (s: HasDashboard): boolean =>
  s.dashboard.programsMeta !== null;
export const selectDashboardProgramsTotal = (s: HasDashboard): number =>
  s.dashboard.programsMeta?.total ?? s.dashboard.programs.length;

export const selectSelectedDashboardProgram = createSelector(
  [selectDashboardPrograms, selectSelectedProgramId],
  (programs, id): DashboardProgram | null => programs.find(p => p.id === id) ?? null,
);

export const selectProgramDashboard = (s: HasDashboard): ProgramDashboard | null =>
  s.dashboard.dashboard;

export const selectDashboardProgramName =
  (programId: string) =>
  (s: HasDashboard): string => {
    const listed = s.dashboard.programs.find(p => p.id === programId)?.name.trim();
    if (listed) {
      return listed;
    }
    const open = s.dashboard.dashboard?.program;
    return open?.id === programId ? open.name.trim() : '';
  };
export const selectDashboardLoading = (s: HasDashboard): boolean =>
  s.dashboard.dashboardLoading;
export const selectDashboardError = (s: HasDashboard): string | null =>
  s.dashboard.dashboardError;
export const selectDashboardYear = (s: HasDashboard): number | null =>
  s.dashboard.selectedYear;
export const selectDashboardCapturedAt = (s: HasDashboard): string | null =>
  s.dashboard.dashboardCapturedAt;
