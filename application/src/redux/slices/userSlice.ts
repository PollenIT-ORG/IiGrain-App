import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import type { UserProfile } from '../../api/profileApi';
import { logout, loginThunk, verifyOtpThunk } from './authSlice';
import {
  changePasswordThunk,
  fetchProfileThunk,
  removeAvatarThunk,
  updateProfileThunk,
  uploadAvatarThunk,
} from '../thunks/profileThunks';

export interface UserState {
  profile: UserProfile | null;
  loading: boolean;
  updating: boolean;
  avatarUpdating: boolean;
  changingPassword: boolean;
  lastFetchedAt: number | null;
  error: string | null;
}

const initialState: UserState = {
  profile: null,
  loading: false,
  updating: false,
  avatarUpdating: false,
  changingPassword: false,
  lastFetchedAt: null,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearProfile(state) {
      state.profile = null;
      state.error = null;
    },
    clearUserError(state) {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchProfileThunk.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfileThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
        state.lastFetchedAt = Date.now();
      })
      .addCase(fetchProfileThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load profile';
      })
      .addCase(updateProfileThunk.pending, state => {
        state.updating = true;
        state.error = null;
      })
      .addCase(updateProfileThunk.fulfilled, (state, action) => {
        state.updating = false;
        state.profile = action.payload;
        state.lastFetchedAt = Date.now();
      })
      .addCase(updateProfileThunk.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload?.message ?? 'Failed to update profile';
      })
      .addCase(uploadAvatarThunk.pending, state => {
        state.avatarUpdating = true;
        state.error = null;
      })
      .addCase(uploadAvatarThunk.fulfilled, (state, action) => {
        state.avatarUpdating = false;
        state.profile = action.payload;
        state.lastFetchedAt = Date.now();
      })
      .addCase(uploadAvatarThunk.rejected, (state, action) => {
        state.avatarUpdating = false;
        state.error = action.payload?.message ?? 'Failed to update profile photo';
      })
      .addCase(removeAvatarThunk.pending, state => {
        state.avatarUpdating = true;
        state.error = null;
      })
      .addCase(removeAvatarThunk.fulfilled, (state, action) => {
        state.avatarUpdating = false;
        state.profile = action.payload;
        state.lastFetchedAt = Date.now();
      })
      .addCase(removeAvatarThunk.rejected, (state, action) => {
        state.avatarUpdating = false;
        state.error = action.payload?.message ?? 'Failed to remove profile photo';
      })
      .addCase(changePasswordThunk.pending, state => {
        state.changingPassword = true;
        state.error = null;
      })
      .addCase(changePasswordThunk.fulfilled, state => {
        state.changingPassword = false;
      })
      .addCase(changePasswordThunk.rejected, (state, action) => {
        state.changingPassword = false;
        state.error = action.payload?.message ?? 'Failed to change password';
      })
      .addCase(logout, state => {
        state.profile = null;
        state.loading = false;
        state.updating = false;
        state.avatarUpdating = false;
        state.changingPassword = false;
        state.lastFetchedAt = null;
        state.error = null;
      })
      .addMatcher(
        isAnyOf(loginThunk.fulfilled, verifyOtpThunk.fulfilled),
        (state, action) => {
          if (state.profile && state.profile.id !== action.payload.id) {
            state.profile = null;
            state.lastFetchedAt = null;
          }
          state.error = null;
        },
      );
  },
});

export const { clearProfile, clearUserError } = userSlice.actions;
export default userSlice.reducer;

export {
  fetchProfileThunk,
  updateProfileThunk,
  uploadAvatarThunk,
  removeAvatarThunk,
  changePasswordThunk,
};

interface HasUser {
  user: UserState;
}
export const selectProfile = (s: HasUser): UserProfile | null => s.user.profile;
export const selectProfileLoading = (s: HasUser): boolean => s.user.loading;
export const selectProfileUpdating = (s: HasUser): boolean => s.user.updating;
export const selectAvatarUpdating = (s: HasUser): boolean => s.user.avatarUpdating;
export const selectChangingPassword = (s: HasUser): boolean => s.user.changingPassword;
export const selectProfileError = (s: HasUser): string | null => s.user.error;
export const selectProfileLastFetchedAt = (s: HasUser): number | null =>
  s.user.lastFetchedAt;
