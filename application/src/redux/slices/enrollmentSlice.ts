import { createSlice } from '@reduxjs/toolkit';
import type {
  AvailableProgram,
  EnrollableField,
  EnrollmentResult,
} from '../../types/enrollment';
import { logout } from './authSlice';
import {
  fetchAvailableProgramsThunk,
  fetchEnrollableFieldsThunk,
  enrollSelfThunk,
} from '../thunks/enrollmentThunks';

export interface EnrollmentState {
  availablePrograms: AvailableProgram[];
  enrollableFields: EnrollableField[];
  lastResult: EnrollmentResult | null;
  loadingPrograms: boolean;
  loadingFields: boolean;
  enrolling: boolean;
  programsError: string | null;
  fieldsError: string | null;
}

const initialState: EnrollmentState = {
  availablePrograms: [],
  enrollableFields: [],
  lastResult: null,
  loadingPrograms: false,
  loadingFields: false,
  enrolling: false,
  programsError: null,
  fieldsError: null,
};

const enrollmentSlice = createSlice({
  name: 'enrollment',
  initialState,
  reducers: {
    clearEnrollmentError(state) {
      state.programsError = null;
      state.fieldsError = null;
    },
    resetEnrollment() {
      return initialState;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchAvailableProgramsThunk.pending, state => {
        state.loadingPrograms = true;
        state.programsError = null;
      })
      .addCase(fetchAvailableProgramsThunk.fulfilled, (state, action) => {
        state.loadingPrograms = false;
        state.availablePrograms = action.payload;
      })
      .addCase(fetchAvailableProgramsThunk.rejected, (state, action) => {
        state.loadingPrograms = false;
        state.programsError = action.payload?.message ?? 'Failed to load programs';
      })
      .addCase(fetchEnrollableFieldsThunk.pending, state => {
        state.loadingFields = true;
        state.fieldsError = null;
      })
      .addCase(fetchEnrollableFieldsThunk.fulfilled, (state, action) => {
        state.loadingFields = false;
        state.enrollableFields = action.payload;
      })
      .addCase(fetchEnrollableFieldsThunk.rejected, (state, action) => {
        state.loadingFields = false;
        state.fieldsError = action.payload?.message ?? 'Failed to load fields';
      })
      .addCase(enrollSelfThunk.pending, state => {
        state.enrolling = true;
      })
      .addCase(enrollSelfThunk.fulfilled, (state, action) => {
        state.enrolling = false;
        state.lastResult = action.payload;
        state.availablePrograms = state.availablePrograms.filter(
          p => p.id !== action.payload.programId,
        );
      })
      .addCase(enrollSelfThunk.rejected, state => {
        state.enrolling = false;
      })
      .addCase(logout, () => initialState);
  },
});

export const { clearEnrollmentError, resetEnrollment } = enrollmentSlice.actions;
export default enrollmentSlice.reducer;

export { fetchAvailableProgramsThunk, fetchEnrollableFieldsThunk, enrollSelfThunk };

interface HasEnrollment {
  enrollment: EnrollmentState;
}

const EMPTY_PROGRAMS: AvailableProgram[] = [];
const EMPTY_FIELDS: EnrollableField[] = [];

export const selectAvailablePrograms = (s: HasEnrollment): AvailableProgram[] =>
  s.enrollment.availablePrograms ?? EMPTY_PROGRAMS;
export const selectEnrollableFields = (s: HasEnrollment): EnrollableField[] =>
  s.enrollment.enrollableFields ?? EMPTY_FIELDS;
export const selectEnrollmentLastResult = (s: HasEnrollment): EnrollmentResult | null =>
  s.enrollment.lastResult;
export const selectEnrollmentProgramsLoading = (s: HasEnrollment): boolean =>
  s.enrollment.loadingPrograms;
export const selectEnrollmentFieldsLoading = (s: HasEnrollment): boolean =>
  s.enrollment.loadingFields;
export const selectEnrolling = (s: HasEnrollment): boolean => s.enrollment.enrolling;
export const selectProgramsError = (s: HasEnrollment): string | null => s.enrollment.programsError;
export const selectFieldsError = (s: HasEnrollment): string | null => s.enrollment.fieldsError;
