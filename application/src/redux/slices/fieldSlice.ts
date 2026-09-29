import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Field } from '../../types/farm';
import { logout } from './authSlice';
import {
  fetchFarmFieldsThunk,
  refreshFarmFieldsThunk,
  createFieldThunk,
  updateFieldThunk,
  resetFieldThunk,
  deleteFieldThunk,
} from '../thunks/fieldThunks';

export interface FieldState {
  farmId: string | null;
  fields: Field[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  creating: boolean;
  resetting: boolean;
  deleting: boolean;
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
  resetting: false,
  deleting: false,
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
    fieldBoundarySaved(
      state,
      action: PayloadAction<{
        farmId: string;
        fieldId: string;
        areaAcres: number | null;
        hasBoundary: boolean;
      }>,
    ) {
      const { farmId, fieldId, areaAcres, hasBoundary } = action.payload;
      if (state.farmId !== farmId) {
        return;
      }
      state.fields = state.fields.map(f =>
        f.id === fieldId
          ? {
              ...f,
              areaAcres: areaAcres ?? f.areaAcres,
              hasBoundary,
              boundary: hasBoundary ? f.boundary : null,
            }
          : f,
      );
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
      .addCase(resetFieldThunk.pending, state => {
        state.resetting = true;
        state.error = null;
      })
      .addCase(resetFieldThunk.fulfilled, (state, action) => {
        state.resetting = false;
        const { farmId, field } = action.payload;
        if (field && state.farmId === farmId) {
          state.fields = state.fields.map(f => (f.id === field.id ? field : f));
        }
      })
      .addCase(resetFieldThunk.rejected, (state, action) => {
        state.resetting = false;
        state.error = action.payload?.message ?? 'Failed to reset field';
      })
      .addCase(deleteFieldThunk.pending, state => {
        state.deleting = true;
        state.error = null;
      })
      .addCase(deleteFieldThunk.fulfilled, (state, action) => {
        state.deleting = false;
        const { farmId, fieldId } = action.payload;
        if (state.farmId === farmId) {
          state.fields = state.fields.filter(f => f.id !== fieldId);
        }
      })
      .addCase(deleteFieldThunk.rejected, (state, action) => {
        state.deleting = false;
        state.error = action.payload?.message ?? 'Failed to delete field';
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
  fieldBoundarySaved,
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
export const selectFieldResetting = (s: HasField): boolean => s.field.resetting;
export const selectFieldDeleting = (s: HasField): boolean => s.field.deleting;
export const selectFieldUpdating = (s: HasField): boolean => s.field.updating;
export const selectFieldUpdateError = (s: HasField): string | null => s.field.updateError;
