import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as authApi from '../../api/authApi';
import * as profileApi from '../../api/profileApi';
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  VerifyOtpPayload,
} from '../../api/authApi';
import { tokenStorage } from '../../services/tokenStorage';
import { closeSocket } from '../../services/socket';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';

export type AuthStatus = 'idle' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  bootstrapped: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  status: 'idle',
  user: null,
  bootstrapped: false,
  loading: false,
  error: null,
};

export interface LoginRejected extends StandardizedError {
  requiresVerification?: boolean;
  email?: string;
}

export interface SignupResult {
  email: string;
  verificationRequired: boolean;
  code?: string;
}

type ThunkConfig = { rejectValue: StandardizedError };

export const bootstrapThunk = createAsyncThunk<AuthUser | null>(
  'auth/bootstrap',
  async () => {
    const token = await tokenStorage.get();
    if (!token) {
      return null;
    }
    try {
      return await authApi.me();
    } catch {
      await tokenStorage.clear();
      return null;
    }
  },
);

export const signupThunk = createAsyncThunk<SignupResult, RegisterPayload, ThunkConfig>(
  'auth/signup',
  async (payload, { rejectWithValue }) => {
    try {
      const { verificationRequired, code } = await authApi.register(payload);
      return { email: payload.email, verificationRequired, code };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const loginThunk = createAsyncThunk<
  AuthUser,
  LoginPayload,
  { rejectValue: LoginRejected }
>('auth/login', async (payload, { rejectWithValue }) => {
  try {
    const data = await authApi.login(payload);
    await tokenStorage.save(data.token, data.refreshToken);
    return data.user ?? (await authApi.me());
  } catch (error) {
    if (authApi.isUnverifiedEmailError(error)) {
      try {
        await authApi.requestOtp(payload.email);
      } catch {
        // the screen can offer a manual resend
      }
      return rejectWithValue({
        ...handleApiError(error),
        requiresVerification: true,
        email: payload.email,
      });
    }
    return rejectWithValue(handleApiError(error));
  }
});

export const verifyOtpThunk = createAsyncThunk<AuthUser, VerifyOtpPayload, ThunkConfig>(
  'auth/verifyOtp',
  async (payload, { rejectWithValue }) => {
    try {
      const data = await authApi.verifyOtp(payload);
      await tokenStorage.save(data.token, data.refreshToken);
      return data.user ?? (await authApi.me());
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const verifyEmailForSignupThunk = createAsyncThunk<void, VerifyOtpPayload, ThunkConfig>(
  'auth/verifyEmailForSignup',
  async (payload, { rejectWithValue }) => {
    try {
      await authApi.verifyOtp(payload);
      await tokenStorage.clear();
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const requestOtpThunk = createAsyncThunk<
  authApi.RequestOtpData,
  string,
  ThunkConfig
>('auth/requestOtp', async (email, { rejectWithValue }) => {
  try {
    return await authApi.requestOtp(email);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const forgotPasswordThunk = createAsyncThunk<
  authApi.RequestOtpData,
  string,
  ThunkConfig
>('auth/forgotPassword', async (email, { rejectWithValue }) => {
  try {
    return await authApi.forgotPassword(email);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const resetPasswordThunk = createAsyncThunk<void, ResetPasswordPayload, ThunkConfig>(
  'auth/resetPassword',
  async (payload, { rejectWithValue }) => {
    try {
      await authApi.resetPassword(payload);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const logoutThunk = createAsyncThunk('auth/logout', async (_, { dispatch }) => {
  const refreshToken = await tokenStorage.getRefresh();
  await tokenStorage.clear();
  closeSocket();
  dispatch(authSlice.actions.logout());

  if (refreshToken) {
    try {
      await authApi.logout(refreshToken);
    } catch {
      // token is already wiped locally and expires server-side anyway
    }
  }
});

export const deleteAccountThunk = createAsyncThunk<void, void, ThunkConfig>(
  'auth/deleteAccount',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      await profileApi.deleteMyAccount();
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
    await tokenStorage.clear();
    closeSocket();
    dispatch(authSlice.actions.logout());
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      state.status = action.payload ? 'authenticated' : 'unauthenticated';
    },
    clearError(state) {
      state.error = null;
    },
    logout(state) {
      state.status = 'unauthenticated';
      state.user = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(bootstrapThunk.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = action.payload ? 'authenticated' : 'unauthenticated';
        state.bootstrapped = true;
      })
      .addCase(bootstrapThunk.rejected, state => {
        state.status = 'unauthenticated';
        state.user = null;
        state.bootstrapped = true;
      })
      .addCase(loginThunk.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.status = 'authenticated';
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Login failed';
      })
      .addCase(verifyOtpThunk.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOtpThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.status = 'authenticated';
      })
      .addCase(verifyOtpThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Verification failed';
      })
      .addCase(verifyEmailForSignupThunk.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyEmailForSignupThunk.fulfilled, state => {
        state.loading = false;
      })
      .addCase(verifyEmailForSignupThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Verification failed';
      })
      .addCase(signupThunk.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signupThunk.fulfilled, state => {
        state.loading = false;
      })
      .addCase(signupThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Registration failed';
      });
  },
});

export const { setUser, clearError, logout } = authSlice.actions;
export default authSlice.reducer;

interface HasAuth {
  auth: AuthState;
}
export const selectAuthStatus = (s: HasAuth): AuthStatus => s.auth.status;
export const selectIsAuthenticated = (s: HasAuth): boolean => s.auth.status === 'authenticated';
export const selectAuthUser = (s: HasAuth): AuthUser | null => s.auth.user;
export const selectBootstrapped = (s: HasAuth): boolean => s.auth.bootstrapped;
export const selectAuthLoading = (s: HasAuth): boolean => s.auth.loading;
export const selectAuthError = (s: HasAuth): string | null => s.auth.error;
