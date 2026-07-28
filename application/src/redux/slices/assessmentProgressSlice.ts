import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { logout } from './authSlice';

export interface ResumePoint {
  categoryId: string;
  questionId: string;
}

export interface AssessmentProgressState {
  resumeByField: Record<string, ResumePoint>;
}

const initialState: AssessmentProgressState = {
  resumeByField: {},
};

const resumeKey = (programId: string, fieldId: string): string => `${programId}:${fieldId}`;

const assessmentProgressSlice = createSlice({
  name: 'assessmentProgress',
  initialState,
  reducers: {
    setResumePoint(
      state,
      action: PayloadAction<{
        programId: string;
        fieldId: string;
        categoryId: string;
        questionId: string;
      }>,
    ) {
      const { programId, fieldId, categoryId, questionId } = action.payload;
      state.resumeByField[resumeKey(programId, fieldId)] = { categoryId, questionId };
    },
    clearResumePoint(state, action: PayloadAction<{ programId: string; fieldId: string }>) {
      delete state.resumeByField[resumeKey(action.payload.programId, action.payload.fieldId)];
    },
  },
  extraReducers: builder => {
    builder.addCase(logout, () => initialState);
  },
});

export const { setResumePoint, clearResumePoint } = assessmentProgressSlice.actions;
export default assessmentProgressSlice.reducer;

interface HasAssessmentProgress {
  assessmentProgress: AssessmentProgressState;
}

export const selectResumePoint =
  (programId: string | undefined, fieldId: string | undefined) =>
  (s: HasAssessmentProgress): ResumePoint | null =>
    programId && fieldId
      ? s.assessmentProgress.resumeByField[resumeKey(programId, fieldId)] ?? null
      : null;
