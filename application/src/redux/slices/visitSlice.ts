import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import * as visitApi from '../../api/visitApi';
import { logout } from './authSlice';
import { handleApiError, type StandardizedError } from '../../utils/handleApiError';
import type { Visit, VisitOutcome } from '../../types/visit';

export interface TrailPoint {
  latitude: number;
  longitude: number;
}

export interface VisitState {
  activeVisit: Visit | null;
  starting: boolean;
  ending: boolean;
  incomingVisit: Visit | null;
  loading: boolean;
  error: string | null;
  assessorVisitChecked: boolean;
  trail: TrailPoint[];
  trailVisitId: string | null;
}

const initialState: VisitState = {
  activeVisit: null,
  starting: false,
  ending: false,
  incomingVisit: null,
  loading: false,
  error: null,
  assessorVisitChecked: false,
  trail: [],
  trailVisitId: null,
};

type ThunkConfig = { rejectValue: StandardizedError };

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'expired']);

const isTerminal = (status: string): boolean => TERMINAL_STATUSES.has(status);

const TRAIL_MAX_POINTS = 500;
const TRAIL_MIN_MOVE_M = 15;

const EARTH_R = 6378137;
const toRad = (d: number): number => (d * Math.PI) / 180;

const metersBetween = (a: TrailPoint, b: TrailPoint): number => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const appendTrailPoint = (
  state: VisitState,
  visitId: string,
  lat: number | null | undefined,
  lng: number | null | undefined,
): void => {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return;
  }

  if (state.trailVisitId !== visitId) {
    state.trailVisitId = visitId;
    state.trail = [];
  }

  const next: TrailPoint = { latitude: lat, longitude: lng };
  const last = state.trail[state.trail.length - 1];
  if (last && metersBetween(last, next) < TRAIL_MIN_MOVE_M) {
    return;
  }

  state.trail.push(next);
  if (state.trail.length > TRAIL_MAX_POINTS) {
    state.trail.splice(0, state.trail.length - TRAIL_MAX_POINTS);
  }
};

const merge = (prev: Visit, next: Visit): Visit => ({
  ...next,
  assessorLat: next.assessorLat ?? prev.assessorLat,
  assessorLng: next.assessorLng ?? prev.assessorLng,
  destLat: next.destLat ?? prev.destLat,
  destLng: next.destLng ?? prev.destLng,
  assessorName: next.assessorName || prev.assessorName,
  farmerName: next.farmerName || prev.farmerName,
  farmName: next.farmName ?? prev.farmName,
  fieldId: next.fieldId ?? prev.fieldId,
  fieldName: next.fieldName ?? prev.fieldName,
  fieldBoundary: next.fieldBoundary?.length ? next.fieldBoundary : prev.fieldBoundary,
});

export const startVisitThunk = createAsyncThunk<Visit, visitApi.StartVisitInput, ThunkConfig>(
  'visit/start',
  async (input, { rejectWithValue }) => {
    try {
      return await visitApi.startVisit(input);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export interface ArriveVisitArg {
  visitId: string;
  position?: visitApi.PositionReport | null;
}

export const arriveVisitThunk = createAsyncThunk<Visit | null, ArriveVisitArg, ThunkConfig>(
  'visit/arrive',
  async ({ visitId, position }, { rejectWithValue }) => {
    try {
      return await visitApi.markVisitArrived(visitId, position);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const fetchVisitTrackThunk = createAsyncThunk<
  { visitId: string; points: TrailPoint[] },
  string
>('visit/track', async visitId => ({
  visitId,
  points: await visitApi.getVisitTrack(visitId),
}));

export const endVisitThunk = createAsyncThunk<
  Visit | null,
  { visitId: string; outcome: VisitOutcome },
  ThunkConfig
>('visit/end', async ({ visitId, outcome }, { rejectWithValue }) => {
  try {
    return await visitApi.endVisit(visitId, outcome);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchMyAssessorVisitThunk = createAsyncThunk<Visit | null, void>(
  'visit/mineAssessor',
  async () => visitApi.getMyAssessorVisit(),
);

export const fetchMyFarmerVisitThunk = createAsyncThunk<Visit | null, void>(
  'visit/mineFarmer',
  async () => visitApi.getMyFarmerVisit(),
);

const visitSlice = createSlice({
  name: 'visit',
  initialState,
  reducers: {
    applyVisitUpdate(state, action: PayloadAction<Visit>) {
      const v = action.payload;

      if (isTerminal(v.status)) {
        if (state.activeVisit?.id === v.id) {
          state.activeVisit = null;
        }
        if (state.incomingVisit?.id === v.id) {
          state.incomingVisit = null;
        }
        state.trail = [];
        return;
      }

      if (state.activeVisit && state.activeVisit.id === v.id) {
        state.activeVisit = merge(state.activeVisit, v);
      }
      if (state.incomingVisit && state.incomingVisit.id === v.id) {
        state.incomingVisit = merge(state.incomingVisit, v);
      }

      appendTrailPoint(state, v.id, v.assessorLat, v.assessorLng);
    },
    setIncomingVisit(state, action: PayloadAction<Visit | null>) {
      const v = action.payload;
      state.incomingVisit = v;
      if (!v) {
        if (!state.activeVisit) {
          state.trail = [];
          state.trailVisitId = null;
        }
        return;
      }
      appendTrailPoint(state, v.id, v.assessorLat, v.assessorLng);
    },
    setActiveVisit(state, action: PayloadAction<Visit | null>) {
      const v = action.payload;
      state.activeVisit = v;
      if (!v) {
        if (!state.incomingVisit) {
          state.trail = [];
          state.trailVisitId = null;
        }
        return;
      }
      appendTrailPoint(state, v.id, v.assessorLat, v.assessorLng);
    },
    setAssessorPosition(state, action: PayloadAction<{ lat: number; lng: number }>) {
      if (state.activeVisit) {
        state.activeVisit = {
          ...state.activeVisit,
          assessorLat: action.payload.lat,
          assessorLng: action.payload.lng,
        };
        appendTrailPoint(
          state,
          state.activeVisit.id,
          action.payload.lat,
          action.payload.lng,
        );
      }
    },
    clearVisits(state) {
      state.activeVisit = null;
      state.incomingVisit = null;
      state.error = null;
      state.trail = [];
      state.trailVisitId = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(startVisitThunk.pending, state => {
        state.starting = true;
        state.error = null;
      })
      .addCase(startVisitThunk.fulfilled, (state, action) => {
        state.starting = false;
        state.activeVisit = action.payload;
        state.assessorVisitChecked = true;
      })
      .addCase(startVisitThunk.rejected, (state, action) => {
        state.starting = false;
        state.error = action.payload?.message ?? 'Could not start the visit';
      })

      .addCase(arriveVisitThunk.fulfilled, (state, action) => {
        if (action.payload) {
          state.activeVisit = action.payload;
        } else if (state.activeVisit) {
          state.activeVisit = { ...state.activeVisit, status: 'arrived' };
        }
      })

      .addCase(fetchVisitTrackThunk.fulfilled, (state, action) => {
        const { visitId, points } = action.payload;
        if (points.length === 0) {
          return;
        }
        if (state.trailVisitId !== null && state.trailVisitId !== visitId) {
          return;
        }
        if (state.trail.length > points.length) {
          return;
        }
        state.trailVisitId = visitId;
        state.trail = points.slice(-TRAIL_MAX_POINTS);
      })

      .addCase(endVisitThunk.pending, state => {
        state.ending = true;
      })
      .addCase(endVisitThunk.fulfilled, state => {
        state.ending = false;
        state.activeVisit = null;
        state.trail = [];
        state.trailVisitId = null;
      })
      .addCase(endVisitThunk.rejected, (state, action) => {
        state.ending = false;
        state.error = action.payload?.message ?? 'Could not end the visit';
      })

      .addCase(fetchMyAssessorVisitThunk.fulfilled, (state, action) => {
        state.activeVisit = action.payload;
        state.assessorVisitChecked = true;
      })
      .addCase(fetchMyAssessorVisitThunk.rejected, state => {
        state.loading = false;
        state.assessorVisitChecked = true;
      })
      .addCase(fetchMyFarmerVisitThunk.pending, state => {
        state.loading = true;
      })
      .addCase(fetchMyFarmerVisitThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.incomingVisit = action.payload;
      })
      .addCase(fetchMyFarmerVisitThunk.rejected, state => {
        state.loading = false;
      })

      .addCase(logout, () => initialState);
  },
});

export const {
  applyVisitUpdate,
  setIncomingVisit,
  setActiveVisit,
  setAssessorPosition,
  clearVisits,
} = visitSlice.actions;
export default visitSlice.reducer;

interface HasVisit {
  visit: VisitState;
}
export const selectActiveVisit = (s: HasVisit): Visit | null => s.visit.activeVisit;
export const selectAssessorVisitChecked = (s: HasVisit): boolean =>
  s.visit.assessorVisitChecked;
export const selectIncomingVisit = (s: HasVisit): Visit | null => s.visit.incomingVisit;
export const selectVisitTrail = (s: HasVisit): TrailPoint[] => s.visit.trail;
export const selectVisitStarting = (s: HasVisit): boolean => s.visit.starting;
export const selectVisitEnding = (s: HasVisit): boolean => s.visit.ending;
