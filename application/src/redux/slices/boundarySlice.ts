/**
 * src/redux/slices/boundarySlice.ts — the committed field boundaries.
 *
 * Phase D storage: this slice holds every SAVED FieldBoundary, keyed by fieldId,
 * and is persisted via redux-persist (see store.ts whitelist). The in-progress
 * DRAFT never lives here — that is ephemeral screen state in `useBoundaryDraft`.
 *
 * There is no loading/error zoo: the Phase-D repository is synchronous
 * (local-only). When the API repository lands (Phase E), per-field saving/error
 * state is added here alongside a sync thunk. See
 * docs/maps/FarmBoundary/ARCHITECTURE.md §4.
 */

import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';
import type { FieldBoundary } from '../../maps/boundary/types';
import { logout } from './authSlice';

export interface BoundaryState {
  /** Saved boundaries by fieldId. */
  byFieldId: Record<string, FieldBoundary>;
}

const initialState: BoundaryState = {
  byFieldId: {},
};

const boundarySlice = createSlice({
  name: 'boundary',
  initialState,
  reducers: {
    /** Insert or replace a field's boundary (the repository writes through here).
     *  FieldBoundary is a deeply-readonly domain type; it is only ever REPLACED
     *  wholesale here (never mutated in place), so casting to Immer's Draft is
     *  safe and avoids weakening the domain type everywhere it is read. */
    upsertBoundary(state, action: PayloadAction<FieldBoundary>) {
      state.byFieldId[action.payload.fieldId] = action.payload as Draft<FieldBoundary>;
    },
    /** Remove a field's boundary. */
    removeBoundary(state, action: PayloadAction<string>) {
      delete state.byFieldId[action.payload];
    },
  },
  extraReducers: builder => {
    // A boundary is farmer-owned data; clear it on logout like every other slice.
    builder.addCase(logout, () => initialState);
  },
});

export const { upsertBoundary, removeBoundary } = boundarySlice.actions;

// ── Selectors ────────────────────────────────────────────────────────────────

interface HasBoundary {
  boundary: BoundaryState;
}

/** The saved boundary for a field, or null. */
export const selectBoundary = (s: HasBoundary, fieldId: string): FieldBoundary | null =>
  s.boundary.byFieldId[fieldId] ?? null;

/** Whether a field has a saved boundary — for the FieldDetails "Draw / Edit"
 *  button label and the Overview preview. */
export const selectHasBoundary = (s: HasBoundary, fieldId: string): boolean =>
  s.boundary.byFieldId[fieldId] !== undefined;

export default boundarySlice.reducer;
