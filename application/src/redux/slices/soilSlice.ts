import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import * as soilApi from '../../api/soilApi';
import type { SoilRecordResult } from '../../api/soilApi';
import type { SaveSoilInput, SoilRecord } from '../../types/fieldDetails';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';
import { asOwnerUserId, isDatabaseReady } from '../../services/db';
import type { OwnerUserId } from '../../services/db/types';
import {
  cacheFieldSoil,
  readCachedFieldSoil,
  resolveFieldRow,
  soilFromRow,
} from '../../services/sync/farmCache';
import { saveSoilOffline } from '../../services/sync';
import { getSoil } from '../../repositories/fieldSoilRepository';

type ThunkConfig = { rejectValue: StandardizedError };

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

export const fetchFieldSoilRecordThunk = createAsyncThunk<
  SoilRecordResult,
  string,
  ThunkConfig
>('soil/fetch', async (fieldId, { getState, rejectWithValue }) => {
  const owner = ownerFrom(getState);
  try {
    const result = await soilApi.getFieldSoilRecord(fieldId);
    if (owner) {
      await cacheFieldSoil(owner, fieldId, result.record, result.locked).catch(
        () => undefined,
      );
    }
    return result;
  } catch (error) {
    const standardized = handleApiError(error);
    if (owner && standardized.kind === 'offline') {
      const cached = await readCachedFieldSoil(owner, fieldId).catch(() => null);
      if (cached) {
        return cached;
      }
    }
    return rejectWithValue(standardized);
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
>('soil/save', async ({ fieldId, input }, { getState, rejectWithValue }) => {
  const owner = ownerFrom(getState);
  try {
    const result = await soilApi.saveFieldSoil(fieldId, input);
    if (owner) {
      await cacheFieldSoil(owner, fieldId, result.record, result.locked).catch(
        () => undefined,
      );
    }
    return result;
  } catch (error) {
    const standardized = handleApiError(error);
    if (owner && standardized.kind === 'offline') {
      const field = await resolveFieldRow(owner, fieldId).catch(() => null);
      if (field) {
        try {
          await saveSoilOffline(owner, field.local_id, input);
          const row = await getSoil(owner, field.local_id);
          if (row) {
            return { record: soilFromRow(row), locked: row.locked === 1 };
          }
        } catch {
          return rejectWithValue(standardized);
        }
      }
    }
    return rejectWithValue(standardized);
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
