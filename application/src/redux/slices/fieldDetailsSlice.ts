import { createSlice } from '@reduxjs/toolkit';
import type { ActivityEntry } from '../../types/farm';
import type { FieldDocument, FieldOverview, FieldSoil } from '../../types/fieldDetails';
import { logout } from './authSlice';
import {
  fetchFieldOverviewThunk,
  fetchFieldActivityThunk,
  fetchFieldSoilThunk,
  fetchFieldDocumentsThunk,
  uploadFieldDocumentThunk,
  deleteFieldDocumentThunk,
} from '../thunks/fieldDetailsThunks';
import { enrollSelfThunk } from '../thunks/enrollmentThunks';

export type FieldTabKey = 'overview' | 'activity' | 'soil' | 'documents';

type TabFlags = Record<FieldTabKey, boolean>;
type TabErrors = Record<FieldTabKey, string | null>;

export interface FieldDetailsState {
  fieldId: string | null;
  overview: FieldOverview | null;
  activity: ActivityEntry[] | null;
  soil: FieldSoil | null;
  documents: FieldDocument[] | null;
  loading: TabFlags;
  error: TabErrors;
  uploadingDoc: boolean;
  deletingDocId: string | null;
}

const NO_FLAGS: TabFlags = { overview: false, activity: false, soil: false, documents: false };
const NO_ERRORS: TabErrors = { overview: null, activity: null, soil: null, documents: null };

const initialState: FieldDetailsState = {
  fieldId: null,
  overview: null,
  activity: null,
  soil: null,
  documents: null,
  loading: { ...NO_FLAGS },
  error: { ...NO_ERRORS },
  uploadingDoc: false,
  deletingDocId: null,
};

const resetBuckets = (state: FieldDetailsState, fieldId: string): void => {
  state.fieldId = fieldId;
  state.overview = null;
  state.activity = null;
  state.soil = null;
  state.documents = null;
  state.loading = { ...NO_FLAGS };
  state.error = { ...NO_ERRORS };
  state.uploadingDoc = false;
  state.deletingDocId = null;
};

const fieldDetailsSlice = createSlice({
  name: 'fieldDetails',
  initialState,
  reducers: {
    setActiveField(state, action: { payload: string }) {
      if (state.fieldId !== action.payload) {
        resetBuckets(state, action.payload);
      }
    },
    clearFieldDetails: () => initialState,
    /** Enrolling a field unlocks its soil nutrients server-side. Dropping the
     *  cached soil makes the soil tab refetch, so `locked` reflects reality
     *  without the user having to leave and come back. */
    invalidateFieldSoil(state) {
      state.soil = null;
      state.error.soil = null;
    },
  },
  extraReducers: builder => {
    builder
      // Enrolling unlocks the soil nutrients for the enrolled fields, so the
      // cached soil tab (and its `locked` flag) is dropped and refetched.
      .addCase(enrollSelfThunk.fulfilled, state => {
        state.soil = null;
        state.error.soil = null;
      })
      .addCase(fetchFieldOverviewThunk.pending, state => {
        state.loading.overview = true;
        state.error.overview = null;
      })
      .addCase(fetchFieldOverviewThunk.fulfilled, (state, action) => {
        if (action.meta.arg !== state.fieldId) return;
        state.loading.overview = false;
        state.overview = action.payload;
      })
      .addCase(fetchFieldOverviewThunk.rejected, (state, action) => {
        if (action.meta.arg !== state.fieldId) return;
        state.loading.overview = false;
        state.error.overview = action.payload?.message ?? 'Failed to load overview';
      })
      .addCase(fetchFieldActivityThunk.pending, state => {
        state.loading.activity = true;
        state.error.activity = null;
      })
      .addCase(fetchFieldActivityThunk.fulfilled, (state, action) => {
        if (action.meta.arg !== state.fieldId) return;
        state.loading.activity = false;
        state.activity = action.payload;
      })
      .addCase(fetchFieldActivityThunk.rejected, (state, action) => {
        if (action.meta.arg !== state.fieldId) return;
        state.loading.activity = false;
        state.error.activity = action.payload?.message ?? 'Failed to load history';
      })
      .addCase(fetchFieldSoilThunk.pending, state => {
        state.loading.soil = true;
        state.error.soil = null;
      })
      .addCase(fetchFieldSoilThunk.fulfilled, (state, action) => {
        if (action.meta.arg !== state.fieldId) return;
        state.loading.soil = false;
        state.soil = action.payload;
      })
      .addCase(fetchFieldSoilThunk.rejected, (state, action) => {
        if (action.meta.arg !== state.fieldId) return;
        state.loading.soil = false;
        state.error.soil = action.payload?.message ?? 'Failed to load soil data';
      })
      .addCase(fetchFieldDocumentsThunk.pending, state => {
        state.loading.documents = true;
        state.error.documents = null;
      })
      .addCase(fetchFieldDocumentsThunk.fulfilled, (state, action) => {
        if (action.meta.arg !== state.fieldId) return;
        state.loading.documents = false;
        state.documents = action.payload;
      })
      .addCase(fetchFieldDocumentsThunk.rejected, (state, action) => {
        if (action.meta.arg !== state.fieldId) return;
        state.loading.documents = false;
        state.error.documents = action.payload?.message ?? 'Failed to load documents';
      })
      .addCase(uploadFieldDocumentThunk.pending, state => {
        state.uploadingDoc = true;
        state.error.documents = null;
      })
      .addCase(uploadFieldDocumentThunk.fulfilled, (state, action) => {
        if (action.meta.arg.fieldId !== state.fieldId) return;
        state.uploadingDoc = false;
        state.documents = [action.payload, ...(state.documents ?? [])];
      })
      .addCase(uploadFieldDocumentThunk.rejected, (state, action) => {
        if (action.meta.arg.fieldId !== state.fieldId) return;
        state.uploadingDoc = false;
        state.error.documents = action.payload?.message ?? 'Failed to upload document';
      })
      .addCase(deleteFieldDocumentThunk.pending, (state, action) => {
        state.deletingDocId = action.meta.arg.documentId;
        state.error.documents = null;
      })
      .addCase(deleteFieldDocumentThunk.fulfilled, (state, action) => {
        if (action.meta.arg.fieldId !== state.fieldId) return;
        state.deletingDocId = null;
        if (state.documents) {
          state.documents = state.documents.filter(d => d.id !== action.payload);
        }
      })
      .addCase(deleteFieldDocumentThunk.rejected, (state, action) => {
        if (action.meta.arg.fieldId !== state.fieldId) return;
        state.deletingDocId = null;
        state.error.documents = action.payload?.message ?? 'Failed to delete document';
      })
      .addCase(logout, () => initialState);
  },
});

export const { setActiveField, clearFieldDetails, invalidateFieldSoil } = fieldDetailsSlice.actions;
export default fieldDetailsSlice.reducer;

export {
  fetchFieldOverviewThunk,
  fetchFieldActivityThunk,
  fetchFieldSoilThunk,
  fetchFieldDocumentsThunk,
  uploadFieldDocumentThunk,
  deleteFieldDocumentThunk,
};

interface HasFieldDetails {
  fieldDetails: FieldDetailsState;
}

export const selectFieldDetailsFieldId = (s: HasFieldDetails): string | null =>
  s.fieldDetails.fieldId;
export const selectFieldOverview = (s: HasFieldDetails): FieldOverview | null =>
  s.fieldDetails.overview;
export const selectFieldActivity = (s: HasFieldDetails): ActivityEntry[] | null =>
  s.fieldDetails.activity;
export const selectFieldSoil = (s: HasFieldDetails): FieldSoil | null =>
  s.fieldDetails.soil;
export const selectFieldDocuments = (s: HasFieldDetails): FieldDocument[] | null =>
  s.fieldDetails.documents;
export const selectFieldTabLoading = (s: HasFieldDetails): TabFlags =>
  s.fieldDetails.loading;
export const selectFieldTabError = (s: HasFieldDetails): TabErrors =>
  s.fieldDetails.error;
export const selectUploadingDoc = (s: HasFieldDetails): boolean =>
  s.fieldDetails.uploadingDoc;
export const selectDeletingDocId = (s: HasFieldDetails): string | null =>
  s.fieldDetails.deletingDocId;
