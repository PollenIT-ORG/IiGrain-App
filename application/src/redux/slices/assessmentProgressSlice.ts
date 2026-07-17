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

const assessmentProgressSlice = createSlice({
  name: 'assessmentProgress',
  initialState,
  reducers: {
    setResumePoint(
      state,
      action: PayloadAction<{ fieldId: string; categoryId: string; questionId: string }>,
    ) {
      const { fieldId, categoryId, questionId } = action.payload;
      state.resumeByField[fieldId] = { categoryId, questionId };
    },
    clearResumePoint(state, action: PayloadAction<string>) {
      delete state.resumeByField[action.payload];
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
  (fieldId: string | undefined) =>
  (s: HasAssessmentProgress): ResumePoint | null =>
    fieldId ? s.assessmentProgress.resumeByField[fieldId] ?? null : null;
