import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import * as soilApi from '../../api/soilApi';
import type { SoilRecordResult } from '../../api/soilApi';
import type { SaveSoilInput, SoilRecord } from '../../types/fieldDetails';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';

type ThunkConfig = { rejectValue: StandardizedError };

export const fetchFieldSoilRecordThunk = createAsyncThunk<
  SoilRecordResult,
  string,
  ThunkConfig
>('soil/fetch', async (fieldId, { rejectWithValue }) => {
  try {
    return await soilApi.getFieldSoilRecord(fieldId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export interface SaveSoilArg {
  fieldId: string;
  input: SaveSoilInput;
}

export const saveFieldSoilThunk = createAsyncThunk<
  SoilRecordResult,
  SaveSoilArg,
  ThunkConfig
>('soil/save', async ({ fieldId, input }, { rejectWithValue }) => {
  try {
    return await soilApi.saveFieldSoil(fieldId, input);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

interface SoilState {
  fieldId: string | null;
  record: SoilRecord | null;
  locked: boolean;
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveError: string | null;
}

const initialState: SoilState = {
  fieldId: null,
  record: null,
  locked: true,
  loading: false,
  error: null,
  saving: false,
  saveError: null,
};

const soilSlice = createSlice({
  name: 'soil',
  initialState,
  reducers: {
    setSoilField(state, action: PayloadAction<string>) {
      if (state.fieldId !== action.payload) {
        state.fieldId = action.payload;
        state.record = null;
        state.error = null;
        state.saveError = null;
      }
    },
    clearSoil() {
      return initialState;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchFieldSoilRecordThunk.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFieldSoilRecordThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.record = action.payload.record;
        state.locked = action.payload.locked;
      })
      .addCase(fetchFieldSoilRecordThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load soil record.';
      })
      .addCase(saveFieldSoilThunk.pending, state => {
        state.saving = true;
        state.saveError = null;
      })
      .addCase(saveFieldSoilThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.record = action.payload.record;
        state.locked = action.payload.locked;
      })
      .addCase(saveFieldSoilThunk.rejected, (state, action) => {
        state.saving = false;
        state.saveError = action.payload?.message ?? 'Failed to save soil record.';
      });
  },
});

export const { setSoilField, clearSoil } = soilSlice.actions;
export default soilSlice.reducer;

interface HasSoil {
  soil: SoilState;
}

export const selectSoilFieldId = (s: HasSoil): string | null => s.soil.fieldId;
export const selectSoilRecord = (s: HasSoil): SoilRecord | null => s.soil.record;
export const selectSoilLocked = (s: HasSoil): boolean => s.soil.locked;
export const selectSoilLoading = (s: HasSoil): boolean => s.soil.loading;
export const selectSoilError = (s: HasSoil): string | null => s.soil.error;
export const selectSoilSaving = (s: HasSoil): boolean => s.soil.saving;
export const selectSoilSaveError = (s: HasSoil): string | null => s.soil.saveError;
