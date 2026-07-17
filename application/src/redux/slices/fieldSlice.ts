import { createSlice } from '@reduxjs/toolkit';
import type { Field } from '../../types/farm';
import { logout } from './authSlice';
import {
  fetchFarmFieldsThunk,
  refreshFarmFieldsThunk,
  createFieldThunk,
  updateFieldThunk,
} from '../thunks/fieldThunks';

export interface FieldState {
  farmId: string | null;
  fields: Field[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  creating: boolean;
  createError: string | null;
  updating: boolean;
  updateError: string | null;
}

const initialState: FieldState = {
  farmId: null,
  fields: [],
  loading: false,
  refreshing: false,
  error: null,
  creating: false,
  createError: null,
  updating: false,
  updateError: null,
};

const fieldSlice = createSlice({
  name: 'field',
  initialState,
  reducers: {
    clearFieldError(state) {
      state.error = null;
    },
    clearFields(state) {
      state.farmId = null;
      state.fields = [];
      state.error = null;
    },
    clearFieldCreateError(state) {
      state.createError = null;
    },
    clearFieldUpdateError(state) {
      state.updateError = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchFarmFieldsThunk.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        if (state.farmId !== action.meta.arg) {
          state.fields = [];
          state.farmId = action.meta.arg;
        }
      })
      .addCase(fetchFarmFieldsThunk.fulfilled, (state, action) => {
        if (action.meta.arg !== state.farmId) return;
        state.loading = false;
        state.farmId = action.payload.farmId;
        state.fields = action.payload.fields;
      })
      .addCase(fetchFarmFieldsThunk.rejected, (state, action) => {
        if (action.meta.arg !== state.farmId) return;
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load fields';
      })
      .addCase(refreshFarmFieldsThunk.pending, state => {
        state.refreshing = true;
        state.error = null;
      })
      .addCase(refreshFarmFieldsThunk.fulfilled, (state, action) => {
        if (action.meta.arg !== state.farmId) return;
        state.refreshing = false;
        state.farmId = action.payload.farmId;
        state.fields = action.payload.fields;
      })
      .addCase(refreshFarmFieldsThunk.rejected, (state, action) => {
        if (action.meta.arg !== state.farmId) return;
        state.refreshing = false;
        state.error = action.payload?.message ?? 'Failed to refresh fields';
      })
      .addCase(createFieldThunk.pending, state => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createFieldThunk.fulfilled, (state, action) => {
        state.creating = false;
        if (state.farmId === action.payload.farmId) {
          state.fields = [action.payload.field, ...state.fields];
        }
      })
      .addCase(createFieldThunk.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload?.message ?? 'Failed to create field';
      })
      .addCase(updateFieldThunk.pending, state => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateFieldThunk.fulfilled, (state, action) => {
        state.updating = false;
        if (state.farmId === action.payload.farmId) {
          const updated = action.payload.field;
          state.fields = state.fields.map(f => (f.id === updated.id ? updated : f));
        }
      })
      .addCase(updateFieldThunk.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload?.message ?? 'Failed to update field';
      })
      .addCase(logout, () => initialState);
  },
});

export const {
  clearFieldError,
  clearFields,
  clearFieldCreateError,
  clearFieldUpdateError,
} = fieldSlice.actions;
export default fieldSlice.reducer;

export {
  fetchFarmFieldsThunk,
  refreshFarmFieldsThunk,
  createFieldThunk,
  updateFieldThunk,
};

interface HasField {
  field: FieldState;
}

export const selectFields = (s: HasField): Field[] => s.field.fields;
export const selectFieldsFarmId = (s: HasField): string | null => s.field.farmId;
export const selectFieldsLoading = (s: HasField): boolean => s.field.loading;
export const selectFieldsRefreshing = (s: HasField): boolean => s.field.refreshing;
export const selectFieldsError = (s: HasField): string | null => s.field.error;
export const selectFieldCreating = (s: HasField): boolean => s.field.creating;
export const selectFieldCreateError = (s: HasField): string | null => s.field.createError;
export const selectFieldUpdating = (s: HasField): boolean => s.field.updating;
export const selectFieldUpdateError = (s: HasField): string | null => s.field.updateError;
