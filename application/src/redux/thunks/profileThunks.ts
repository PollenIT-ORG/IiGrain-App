import { createAsyncThunk } from '@reduxjs/toolkit';
import * as profileApi from '../../api/profileApi';
import type {
  ChangePasswordPayload,
  UpdateProfilePayload,
  UserProfile,
} from '../../api/profileApi';
import type { MediaFile } from '../../types/media';
import type { RootState } from '../store';
import { shouldHydrateProfile } from '../selectors/profileSelectors';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';

type ThunkConfig = { rejectValue: StandardizedError; state: RootState };

export interface FetchProfileOptions {
  force?: boolean;
}

export const fetchProfileThunk = createAsyncThunk<
  UserProfile,
  FetchProfileOptions | undefined,
  ThunkConfig
>(
  'user/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      return await profileApi.getMyProfile();
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (options, { getState }) =>
      shouldHydrateProfile(getState(), Boolean(options?.force)),
  },
);

export const updateProfileThunk = createAsyncThunk<
  UserProfile,
  UpdateProfilePayload,
  ThunkConfig
>('user/updateProfile', async (payload, { rejectWithValue }) => {
  try {
    return await profileApi.updateMyProfile(payload);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const uploadAvatarThunk = createAsyncThunk<UserProfile, MediaFile, ThunkConfig>(
  'user/uploadAvatar',
  async (file, { rejectWithValue }) => {
    try {
      return await profileApi.uploadMyAvatar(file);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const removeAvatarThunk = createAsyncThunk<UserProfile, void, ThunkConfig>(
  'user/removeAvatar',
  async (_, { rejectWithValue }) => {
    try {
      return await profileApi.removeMyAvatar();
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const changePasswordThunk = createAsyncThunk<
  void,
  ChangePasswordPayload,
  ThunkConfig
>('user/changePassword', async (payload, { rejectWithValue }) => {
  try {
    await profileApi.changePassword(payload);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});
