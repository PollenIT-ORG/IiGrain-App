import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import * as visitApi from '../../api/visitApi';
import { logout } from './authSlice';
import { handleApiError, type StandardizedError } from '../../utils/handleApiError';
import type { Visit, VisitOutcome } from '../../types/visit';

export interface VisitState {
  activeVisit: Visit | null;
  starting: boolean;
  ending: boolean;
  incomingVisit: Visit | null;
  loading: boolean;
  error: string | null;
}

const initialState: VisitState = {
  activeVisit: null,
  starting: false,
  ending: false,
  incomingVisit: null,
  loading: false,
  error: null,
};

type ThunkConfig = { rejectValue: StandardizedError };

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

export const arriveVisitThunk = createAsyncThunk<Visit | null, string, ThunkConfig>(
  'visit/arrive',
  async (visitId, { rejectWithValue }) => {
    try {
      return await visitApi.markVisitArrived(visitId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

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
      if (state.activeVisit && state.activeVisit.id === v.id) {
        state.activeVisit = merge(state.activeVisit, v);
      }
      if (state.incomingVisit && state.incomingVisit.id === v.id) {
        state.incomingVisit = merge(state.incomingVisit, v);
      }
    },
    setIncomingVisit(state, action: PayloadAction<Visit | null>) {
      state.incomingVisit = action.payload;
    },
    setActiveVisit(state, action: PayloadAction<Visit | null>) {
      state.activeVisit = action.payload;
    },
    setAssessorPosition(state, action: PayloadAction<{ lat: number; lng: number }>) {
      if (state.activeVisit) {
        state.activeVisit = {
          ...state.activeVisit,
          assessorLat: action.payload.lat,
          assessorLng: action.payload.lng,
        };
      }
    },
    clearVisits(state) {
      state.activeVisit = null;
      state.incomingVisit = null;
      state.error = null;
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

      .addCase(endVisitThunk.pending, state => {
        state.ending = true;
      })
      .addCase(endVisitThunk.fulfilled, state => {
        state.ending = false;
        state.activeVisit = null;
      })
      .addCase(endVisitThunk.rejected, (state, action) => {
        state.ending = false;
        state.error = action.payload?.message ?? 'Could not end the visit';
      })

      .addCase(fetchMyAssessorVisitThunk.fulfilled, (state, action) => {
        state.activeVisit = action.payload;
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
export const selectIncomingVisit = (s: HasVisit): Visit | null => s.visit.incomingVisit;
export const selectVisitStarting = (s: HasVisit): boolean => s.visit.starting;
export const selectVisitEnding = (s: HasVisit): boolean => s.visit.ending;
