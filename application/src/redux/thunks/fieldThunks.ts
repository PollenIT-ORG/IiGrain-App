import { createAsyncThunk } from '@reduxjs/toolkit';
import * as fieldApi from '../../api/FieldApi';
import type { CreateFieldInput, UpdateFieldInput } from '../../api/FieldApi';
import type { Field } from '../../types/farm';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';

type ThunkConfig = { rejectValue: StandardizedError };

export interface FieldsResult {
  farmId: string;
  fields: Field[];
}

export interface CreatedFieldResult {
  farmId: string;
  field: Field;
}

export interface CreateFieldArgs {
  farmId: string;
  input: CreateFieldInput;
}

export interface UpdateFieldArgs {
  farmId: string;
  fieldId: string;
  input: UpdateFieldInput;
}

export const fetchFarmFieldsThunk = createAsyncThunk<FieldsResult, string, ThunkConfig>(
  'field/fetchFarmFields',
  async (farmId, { rejectWithValue }) => {
    try {
      const fields = await fieldApi.getFarmFields(farmId);
      return { farmId, fields };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const refreshFarmFieldsThunk = createAsyncThunk<FieldsResult, string, ThunkConfig>(
  'field/refreshFarmFields',
  async (farmId, { rejectWithValue }) => {
    try {
      const fields = await fieldApi.getFarmFields(farmId);
      return { farmId, fields };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const createFieldThunk = createAsyncThunk<
  CreatedFieldResult,
  CreateFieldArgs,
  ThunkConfig
>('field/createField', async ({ farmId, input }, { rejectWithValue }) => {
  try {
    const field = await fieldApi.createFarmField(farmId, input);
    return { farmId, field };
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const updateFieldThunk = createAsyncThunk<
  CreatedFieldResult,
  UpdateFieldArgs,
  ThunkConfig
>('field/updateField', async ({ farmId, fieldId, input }, { rejectWithValue }) => {
  try {
    const field = await fieldApi.updateFarmField(farmId, fieldId, input);
    return { farmId, field };
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});
