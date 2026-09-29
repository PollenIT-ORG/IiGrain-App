jest.mock('../src/redux/slices/authSlice', () => {
  const { createAsyncThunk } = jest.requireActual('@reduxjs/toolkit');
  return { signupThunk: createAsyncThunk('auth/signup', async () => ({})) };
});

import reducer, {
  selectRegisteredOnThisDevice,
} from '../src/redux/slices/onboardingSlice';
import { signupThunk } from '../src/redux/slices/authSlice';

const signedUp = (argEmail: string, resultEmail: string) =>
  signupThunk.fulfilled(
    { email: resultEmail, verificationRequired: true },
    'req',
    { fullName: 'Asha', email: argEmail, phone: '', password: 'x', enrollmentId: 'ID-1' },
  );

describe('onboarding registration marker', () => {
  it('registers the server email when the form email was locked by the Enrollment ID', () => {
    const state = reducer(undefined, signedUp('', 'Asha@Farm.com'));
    expect(selectRegisteredOnThisDevice({ onboarding: state }, 'asha@farm.com')).toBe(true);
  });

  it('falls back to the typed email when the server returns none', () => {
    const state = reducer(undefined, signedUp('typed@farm.com', ''));
    expect(selectRegisteredOnThisDevice({ onboarding: state }, 'typed@farm.com')).toBe(true);
  });
});
