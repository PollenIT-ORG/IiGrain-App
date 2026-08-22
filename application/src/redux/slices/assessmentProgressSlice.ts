import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { logout } from './authSlice';

export interface ResumePoint {
  categoryId: string;
  questionId: string;
}

export type ResumeRole = 'farmer' | 'assessor';

export interface AssessmentProgressState {
  resumeByField: Record<string, ResumePoint>;
}

const initialState: AssessmentProgressState = {
  resumeByField: {},
};

const resumeKey = (programId: string, fieldId: string, role?: ResumeRole): string =>
  role === 'assessor'
    ? `assessor:${programId}:${fieldId}`
    : `${programId}:${fieldId}`;

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
        role?: ResumeRole;
      }>,
    ) {
      const { programId, fieldId, categoryId, questionId, role } = action.payload;
      state.resumeByField[resumeKey(programId, fieldId, role)] = { categoryId, questionId };
    },
    clearResumePoint(
      state,
      action: PayloadAction<{ programId: string; fieldId: string; role?: ResumeRole }>,
    ) {
      delete state.resumeByField[
        resumeKey(action.payload.programId, action.payload.fieldId, action.payload.role)
      ];
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
  (programId: string | undefined, fieldId: string | undefined, role?: ResumeRole) =>
  (s: HasAssessmentProgress): ResumePoint | null =>
    programId && fieldId
      ? s.assessmentProgress.resumeByField[resumeKey(programId, fieldId, role)] ?? null
      : null;
