import { createAsyncThunk } from '@reduxjs/toolkit';
import * as enrollmentApi from '../../api/enrollmentApi';
import type {
  AvailableProgram,
  EnrollableField,
  EnrollmentResult,
  EnrollSelfInput,
} from '../../types/enrollment';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';

type ThunkConfig = { rejectValue: StandardizedError };

export interface EnrollSelfArg {
  programId: string;
  input: EnrollSelfInput;
}

export const fetchAvailableProgramsThunk = createAsyncThunk<AvailableProgram[], void, ThunkConfig>(
  'enrollment/fetchAvailablePrograms',
  async (_, { rejectWithValue }) => {
    try {
      return await enrollmentApi.getAvailablePrograms();
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const fetchEnrollableFieldsThunk = createAsyncThunk<EnrollableField[], void, ThunkConfig>(
  'enrollment/fetchEnrollableFields',
  async (_, { rejectWithValue }) => {
    try {
      return await enrollmentApi.getEnrollableFields();
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const enrollSelfThunk = createAsyncThunk<EnrollmentResult, EnrollSelfArg, ThunkConfig>(
  'enrollment/enrollSelf',
  async ({ programId, input }, { rejectWithValue }) => {
    try {
      return await enrollmentApi.enrollSelf(programId, input);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (_arg, { getState }) =>
      !(getState() as { enrollment: { enrolling: boolean } }).enrollment.enrolling,
  },
);
