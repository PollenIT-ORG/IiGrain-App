import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { signupThunk } from './authSlice';

export interface OnboardingState {
  enrollmentIdByEmail: Record<string, string>;
  registeredByEmail: Record<string, boolean>;
  dismissedByUserId: Record<string, boolean>;
}

const initialState: OnboardingState = {
  enrollmentIdByEmail: {},
  registeredByEmail: {},
  dismissedByUserId: {},
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
  },
  extraReducers: builder => {
    builder.addCase(signupThunk.fulfilled, (state, action) => {
      const key = emailKey(action.payload.email || action.meta.arg.email);
      if (!key) {
        return;
      }
      state.registeredByEmail[key] = true;
      const id = (action.meta.arg.enrollmentId ?? '').trim();
      if (id) {
        state.enrollmentIdByEmail[key] = id;
      }
    });
  },
});

export const { rememberEnrollmentId, markOnboardingSeen } = onboardingSlice.actions;

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
): boolean => {
  const key = emailKey(email);
  if (!key) {
    return false;
  }
  return (
    s.onboarding.registeredByEmail?.[key] === true ||
    Boolean(s.onboarding.enrollmentIdByEmail[key])
  );
};

export const selectOnboardingSeen = (
  s: HasOnboarding,
  userId: string | null | undefined,
): boolean => (userId ? s.onboarding.dismissedByUserId[userId] === true : false);

export default onboardingSlice.reducer;
