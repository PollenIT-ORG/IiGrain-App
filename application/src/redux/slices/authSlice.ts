import { createAsyncThunk, createSlice, isAnyOf, PayloadAction } from '@reduxjs/toolkit';
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
import {
  isAccountInactiveError,
  isPasswordChangeRequiredError,
} from '../../utils/sessionGuards';
import {
  fetchProfileThunk,
  removeAvatarThunk,
  updateProfileThunk,
  uploadAvatarThunk,
} from '../thunks/profileThunks';

export type AuthStatus = 'idle' | 'authenticated' | 'unauthenticated';

export interface AccountNotice {
  message: string;
  email: string | null;
}

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  bootstrapped: boolean;
  loading: boolean;
  error: string | null;
  accountNotice: AccountNotice | null;
}

const initialState: AuthState = {
  status: 'idle',
  user: null,
  bootstrapped: false,
  loading: false,
  error: null,
  accountNotice: null,
};

export interface LoginRejected extends StandardizedError {
  requiresVerification?: boolean;
  accountInactive?: boolean;
  passwordChangeRequired?: boolean;
  email?: string;
}

type LoginThunkConfig = { rejectValue: LoginRejected };

const rejectionFor = (error: unknown, email: string): LoginRejected => {
  const standardized = handleApiError(error);
  if (isPasswordChangeRequiredError(error)) {
    return { ...standardized, passwordChangeRequired: true, email };
  }
  if (isAccountInactiveError(error)) {
    return { ...standardized, accountInactive: true, email };
  }
  return standardized;
};

export interface SignupResult {
  email: string;
  verificationRequired: boolean;
  code?: string;
}

type ThunkConfig = { rejectValue: StandardizedError };

interface PersistedUserSlice {
  user?: { profile?: AuthUser | null };
}

export const bootstrapThunk = createAsyncThunk<AuthUser | null>(
  'auth/bootstrap',
  async (_, { dispatch, getState }) => {
    const token = await tokenStorage.get();
    if (!token) {
      return null;
    }
    const savedUser = (getState() as PersistedUserSlice).user?.profile ?? null;
    if (savedUser?.id) {
      dispatch(revalidateSessionThunk());
      return savedUser;
    }
    try {
      return await authApi.me();
    } catch (error) {
      if (handleApiError(error).kind !== 'offline') {
        await tokenStorage.clear();
      }
      return null;
    }
  },
);

export const revalidateSessionThunk = createAsyncThunk(
  'auth/revalidateSession',
  async (_, { dispatch, getState }) => {
    try {
      const user = await authApi.me();
      if ((getState() as { auth: AuthState }).auth.status !== 'unauthenticated') {
        dispatch(authSlice.actions.setUser(user));
      }
    } catch (error) {
      if (handleApiError(error).kind === 'notFound') {
        dispatch(logoutThunk());
      }
    }
  },
);

export const signupThunk = createAsyncThunk<SignupResult, RegisterPayload, ThunkConfig>(
  'auth/signup',
  async (payload, { rejectWithValue }) => {
    try {
      const data = await authApi.register(payload);
      return {
        email: data.email ?? payload.email ?? '',
        verificationRequired: data.verificationRequired,
        code: data.code,
      };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const loginThunk = createAsyncThunk<AuthUser, LoginPayload, LoginThunkConfig>(
  'auth/login',
  async (payload, { rejectWithValue }) => {
    try {
      const data = await authApi.login(payload);
      await tokenStorage.save(data.token, data.refreshToken);
      return data.user ?? (await authApi.me());
    } catch (error) {
      if (isPasswordChangeRequiredError(error) || isAccountInactiveError(error)) {
        return rejectWithValue(rejectionFor(error, payload.email));
      }
      if (authApi.isUnverifiedEmailError(error)) {
        try {
          await authApi.requestOtp(payload.email);
        } catch {
        }
        return rejectWithValue({
          ...handleApiError(error),
          requiresVerification: true,
          email: payload.email,
        });
      }
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const verifyOtpThunk = createAsyncThunk<
  AuthUser,
  VerifyOtpPayload,
  LoginThunkConfig
>('auth/verifyOtp', async (payload, { rejectWithValue }) => {
  try {
    const data = await authApi.verifyOtp(payload);
    await tokenStorage.save(data.token, data.refreshToken);
    return data.user ?? (await authApi.me());
  } catch (error) {
    return rejectWithValue(rejectionFor(error, payload.email));
  }
});

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
  LoginThunkConfig
>('auth/requestOtp', async (email, { rejectWithValue }) => {
  try {
    return await authApi.requestOtp(email);
  } catch (error) {
    return rejectWithValue(rejectionFor(error, email));
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

export const verifyResetCodeThunk = createAsyncThunk<void, VerifyOtpPayload, ThunkConfig>(
  'auth/verifyResetCode',
  async (payload, { rejectWithValue }) => {
    try {
      await authApi.verifyResetCode(payload);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

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
    showAccountNotice(state, action: PayloadAction<AccountNotice>) {
      state.accountNotice = action.payload;
      state.error = null;
    },
    clearAccountNotice(state) {
      state.accountNotice = null;
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
        const refreshed = state.user && state.user.id === action.payload?.id;
        state.user = refreshed ? state.user : action.payload;
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
        state.accountNotice = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.status = 'authenticated';
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        if (action.payload?.passwordChangeRequired) {
          state.error = null;
          state.accountNotice = null;
          return;
        }
        if (action.payload?.accountInactive) {
          state.error = null;
          state.accountNotice = {
            message: action.payload.message,
            email: action.payload.email ?? null,
          };
          return;
        }
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
        if (action.payload?.passwordChangeRequired) {
          state.error = null;
          return;
        }
        state.error = action.payload?.message ?? 'Verification failed';
      })
      .addCase(verifyResetCodeThunk.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyResetCodeThunk.fulfilled, state => {
        state.loading = false;
      })
      .addCase(verifyResetCodeThunk.rejected, (state, action) => {
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
      })
      .addMatcher(
        isAnyOf(
          fetchProfileThunk.fulfilled,
          updateProfileThunk.fulfilled,
          uploadAvatarThunk.fulfilled,
          removeAvatarThunk.fulfilled,
        ),
        (state, action) => {
          if (!state.user) {
            return;
          }
          if (state.user.id && action.payload.id && state.user.id !== action.payload.id) {
            return;
          }
          const profile = action.payload;
          state.user = {
            ...state.user,
            id: profile.id,
            fullName: profile.fullName,
            email: profile.email,
            phone: profile.phone,
            role: profile.role,
            emailVerified: profile.emailVerified,
            avatarUrl: profile.avatarUrl ?? null,
          };
        },
      );
  },
});




export const { setUser, clearError, showAccountNotice, clearAccountNotice, logout } =
  authSlice.actions;
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
export const selectAccountNotice = (s: HasAuth): AccountNotice | null =>
  s.auth.accountNotice;
