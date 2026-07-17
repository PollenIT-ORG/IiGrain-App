import { createSlice } from '@reduxjs/toolkit';
import type { UserProfile } from '../../api/profileApi';
import { logout } from './authSlice';
import {
  changePasswordThunk,
  fetchProfileThunk,
  updateProfileThunk,
} from '../thunks/profileThunks';

export interface UserState {
  profile: UserProfile | null;
  loading: boolean;
  updating: boolean;
  changingPassword: boolean;
  error: string | null;
}

const initialState: UserState = {
  profile: null,
  loading: false,
  updating: false,
  changingPassword: false,
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
      })
      .addCase(updateProfileThunk.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload?.message ?? 'Failed to update profile';
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
        state.changingPassword = false;
        state.error = null;
      });
  },
});

export const { clearProfile, clearUserError } = userSlice.actions;
export default userSlice.reducer;

export { fetchProfileThunk, updateProfileThunk, changePasswordThunk };

interface HasUser {
  user: UserState;
}
export const selectProfile = (s: HasUser): UserProfile | null => s.user.profile;
export const selectProfileLoading = (s: HasUser): boolean => s.user.loading;
export const selectProfileUpdating = (s: HasUser): boolean => s.user.updating;
export const selectChangingPassword = (s: HasUser): boolean => s.user.changingPassword;
export const selectProfileError = (s: HasUser): string | null => s.user.error;
