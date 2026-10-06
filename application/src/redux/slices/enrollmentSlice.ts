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
  unenrollFieldThunk,
} from '../thunks/enrollmentThunks';

export interface EnrollmentState {
  availablePrograms: AvailableProgram[];
  enrollableFields: EnrollableField[];
  programsLoaded: boolean;
  fieldsLoaded: boolean;
  lastResult: EnrollmentResult | null;
  loadingPrograms: boolean;
  loadingFields: boolean;
  enrolling: boolean;
  unenrollingFieldId: string | null;
  programsError: string | null;
  fieldsError: string | null;
}

const initialState: EnrollmentState = {
  availablePrograms: [],
  enrollableFields: [],
  programsLoaded: false,
  fieldsLoaded: false,
  lastResult: null,
  loadingPrograms: false,
  loadingFields: false,
  enrolling: false,
  unenrollingFieldId: null,
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
        state.programsLoaded = true;
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
        state.fieldsLoaded = true;
      })
      .addCase(fetchEnrollableFieldsThunk.rejected, (state, action) => {
        state.loadingFields = false;
        state.fieldsError = action.payload?.message ?? 'Failed to load fields';
      })
      .addCase(enrollSelfThunk.pending, state => {
        state.enrolling = true;
      })
      .addCase(unenrollFieldThunk.pending, (state, action) => {
        state.unenrollingFieldId = action.meta.arg.fieldId;
        state.programsError = null;
      })
      .addCase(unenrollFieldThunk.fulfilled, (state, action) => {
        state.unenrollingFieldId = null;
        const { programId, fieldId, enrollmentRemoved } = action.payload;
        const program = state.availablePrograms.find(p => p.id === programId);
        if (!program) {
          return;
        }
        program.fields = program.fields.map(f =>
          f.id === fieldId ? { ...f, enrolled: false } : f,
        );
        if (enrollmentRemoved) {
          program.alreadyEnrolled = false;
          if (program.enrolledCount > 0) {
            program.enrolledCount -= 1;
          }
        }
      })
      .addCase(unenrollFieldThunk.rejected, (state, action) => {
        state.unenrollingFieldId = null;
        state.programsError = action.payload?.message ?? 'Failed to unenroll the field';
      })
      .addCase(enrollSelfThunk.fulfilled, (state, action) => {
        state.enrolling = false;
        state.lastResult = action.payload;
        const enrolledIds = new Set(action.meta.arg.input.fieldIds);
        const program = state.availablePrograms.find(
          p => p.id === action.meta.arg.programId,
        );
        if (program) {
          const wasEnrolled = program.alreadyEnrolled;
          program.alreadyEnrolled = true;
          program.fields = program.fields.map(f =>
            enrolledIds.has(f.id) ? { ...f, enrolled: true } : f,
          );
          if (!wasEnrolled) {
            program.enrolledCount += 1;
          }
        }
        state.enrollableFields = state.enrollableFields.filter(f => !enrolledIds.has(f.id));
      })
      .addCase(enrollSelfThunk.rejected, state => {
        state.enrolling = false;
      })
      .addCase(logout, () => initialState);
  },
});

export const { clearEnrollmentError, resetEnrollment } = enrollmentSlice.actions;
export default enrollmentSlice.reducer;

export {
  fetchAvailableProgramsThunk,
  fetchEnrollableFieldsThunk,
  enrollSelfThunk,
  unenrollFieldThunk,
};

interface HasEnrollment {
  enrollment: EnrollmentState;
}

const EMPTY_PROGRAMS: AvailableProgram[] = [];
const EMPTY_FIELDS: EnrollableField[] = [];

export const selectAvailablePrograms = (s: HasEnrollment): AvailableProgram[] =>
  s.enrollment.availablePrograms ?? EMPTY_PROGRAMS;
export const selectEnrollmentProgramName =
  (programId: string) =>
  (s: HasEnrollment): string =>
    s.enrollment.availablePrograms?.find(program => program.id === programId)?.name.trim() ?? '';
export const selectEnrollableFields = (s: HasEnrollment): EnrollableField[] =>
  s.enrollment.enrollableFields ?? EMPTY_FIELDS;
export const selectProgramsLoaded = (s: HasEnrollment): boolean => s.enrollment.programsLoaded;
export const selectEnrollableFieldsLoaded = (s: HasEnrollment): boolean =>
  s.enrollment.fieldsLoaded;
export const selectEnrollmentLastResult = (s: HasEnrollment): EnrollmentResult | null =>
  s.enrollment.lastResult;
export const selectEnrollmentProgramsLoading = (s: HasEnrollment): boolean =>
  s.enrollment.loadingPrograms;
export const selectEnrollmentFieldsLoading = (s: HasEnrollment): boolean =>
  s.enrollment.loadingFields;
export const selectUnenrollingFieldId = (s: HasEnrollment): string | null =>
  s.enrollment.unenrollingFieldId;
export const selectEnrolling = (s: HasEnrollment): boolean => s.enrollment.enrolling;
export const selectProgramsError = (s: HasEnrollment): string | null => s.enrollment.programsError;
export const selectFieldsError = (s: HasEnrollment): string | null => s.enrollment.fieldsError;
