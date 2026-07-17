import { createAsyncThunk } from '@reduxjs/toolkit';
import * as profileApi from '../../api/profileApi';
import type {
  ChangePasswordPayload,
  UpdateProfilePayload,
  UserProfile,
} from '../../api/profileApi';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';

type ThunkConfig = { rejectValue: StandardizedError };

export const fetchProfileThunk = createAsyncThunk<UserProfile, void, ThunkConfig>(
  'user/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      return await profileApi.getMyProfile();
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
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
