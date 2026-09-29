import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';
import type { FieldBoundary } from '../../maps/boundary/types';
import { logout } from './authSlice';

export interface BoundaryState {
  byFieldId: Record<string, FieldBoundary>;
  pointsSeeded: Record<string, boolean>;
  drawTutorialSeen: boolean;
}

const initialState: BoundaryState = {
  byFieldId: {},
  pointsSeeded: {},
  drawTutorialSeen: false,
};

const boundarySlice = createSlice({
  name: 'boundary',
  initialState,
  reducers: {
    upsertBoundary(state, action: PayloadAction<FieldBoundary>) {
      state.byFieldId[action.payload.fieldId] = action.payload as Draft<FieldBoundary>;
    },
    removeBoundary(state, action: PayloadAction<string>) {
      delete state.byFieldId[action.payload];
    },
    markFieldPointsSeeded(state, action: PayloadAction<string>) {
      state.pointsSeeded[action.payload] = true;
    },
    markDrawTutorialSeen(state) {
      state.drawTutorialSeen = true;
    },
  },
  extraReducers: builder => {
    builder.addCase(logout, () => initialState);
  },
});

export const {
  upsertBoundary,
  removeBoundary,
  markFieldPointsSeeded,
  markDrawTutorialSeen,
} = boundarySlice.actions;

interface HasBoundary {
  boundary: BoundaryState;
}

export const selectBoundary = (s: HasBoundary, fieldId: string): FieldBoundary | null =>
  s.boundary.byFieldId[fieldId] ?? null;

export const selectHasBoundary = (s: HasBoundary, fieldId: string): boolean =>
  s.boundary.byFieldId[fieldId] !== undefined;

export const selectHasAnyBoundary = (s: HasBoundary): boolean =>
  Object.keys(s.boundary.byFieldId).length > 0;

export const fieldPointsScopeKey = (fieldId: string, module: string): string =>
  `points:${fieldId}:${module}`;

export const selectFieldPointsSeeded = (s: HasBoundary, scopeKey: string): boolean =>
  s.boundary.pointsSeeded[scopeKey] === true;

export const selectDrawTutorialSeen = (s: HasBoundary): boolean =>
  s.boundary.drawTutorialSeen === true;

export default boundarySlice.reducer;
