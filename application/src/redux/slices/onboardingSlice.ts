import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { signupThunk } from './authSlice';

export interface OnboardingState {
  enrollmentIdByEmail: Record<string, string>;
  dismissedByUserId: Record<string, boolean>;
  programInfoSeenByUserId: Record<string, boolean>;
}

const initialState: OnboardingState = {
  enrollmentIdByEmail: {},
  dismissedByUserId: {},
  programInfoSeenByUserId: {},
};

const emailKey = (email: string | null | undefined): string =>
  (email ?? '').trim().toLowerCase();

const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    rememberEnrollmentId(
      state,
      action: PayloadAction<{ email: string; enrollmentId: string }>,
    ) {
      const key = emailKey(action.payload.email);
      const id = action.payload.enrollmentId.trim();
      if (key && id) {
        state.enrollmentIdByEmail[key] = id;
      }
    },
    markOnboardingSeen(state, action: PayloadAction<string>) {
      if (action.payload) {
        state.dismissedByUserId[action.payload] = true;
      }
    },
    markProgramInfoSeen(state, action: PayloadAction<string>) {
      if (action.payload) {
        state.programInfoSeenByUserId[action.payload] = true;
      }
    },
  },
  extraReducers: builder => {
    builder.addCase(signupThunk.fulfilled, (state, action) => {
      const key = emailKey(action.meta.arg.email);
      const id = (action.meta.arg.enrollmentId ?? '').trim();
      if (key && id) {
        state.enrollmentIdByEmail[key] = id;
      }
    });
  },
});

export const { rememberEnrollmentId, markOnboardingSeen, markProgramInfoSeen } =
  onboardingSlice.actions;

interface HasOnboarding {
  onboarding: OnboardingState;
}

export const selectEnrollmentIdFor = (
  s: HasOnboarding,
  email: string | null | undefined,
): string | null => s.onboarding.enrollmentIdByEmail[emailKey(email)] ?? null;

export const selectRegisteredOnThisDevice = (
  s: HasOnboarding,
  email: string | null | undefined,
): boolean => Boolean(s.onboarding.enrollmentIdByEmail[emailKey(email)]);

export const selectOnboardingSeen = (
  s: HasOnboarding,
  userId: string | null | undefined,
): boolean => (userId ? s.onboarding.dismissedByUserId[userId] === true : false);

export const selectProgramInfoSeen = (
  s: HasOnboarding,
  userId: string | null | undefined,
): boolean => (userId ? s.onboarding.programInfoSeenByUserId[userId] === true : false);

export default onboardingSlice.reducer;
