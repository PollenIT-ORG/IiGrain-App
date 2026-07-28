import { createAsyncThunk } from '@reduxjs/toolkit';
import * as farmApi from '../../api/FarmApi';
import * as fieldApi from '../../api/FieldApi';
import type { CreateFarmInput, PagedFarms, UpdateFarmInput } from '../../api/FarmApi';
import type { Farm } from '../../types/farm';
import type { PageQuery } from '../../types/pagination';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';

type ThunkConfig = { rejectValue: StandardizedError };

export interface UpdateFarmArgs {
  farmId: string;
  input: UpdateFarmInput;
}

export type FarmListArgs = PageQuery | undefined;

export const fetchFarmsThunk = createAsyncThunk<PagedFarms, FarmListArgs, ThunkConfig>(
  'farm/fetchFarms',
  async (query, { rejectWithValue }) => {
    try {
      return await farmApi.getMyFarms(query);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const refreshFarmsThunk = createAsyncThunk<PagedFarms, FarmListArgs, ThunkConfig>(
  'farm/refreshFarms',
  async (query, { rejectWithValue }) => {
    try {
      return await farmApi.getMyFarms({ ...query, page: 1 });
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export interface FieldCountsArgs {
  farmIds: string[];
  overwrite?: boolean;
}

export interface FieldCountsResult {
  counts: Record<string, number>;
  overwrite: boolean;
}

export const fetchFarmFieldCountsThunk = createAsyncThunk<
  FieldCountsResult,
  FieldCountsArgs,
  ThunkConfig
>('farm/fetchFieldCounts', async ({ farmIds, overwrite = false }, { rejectWithValue }) => {
  try {
    const entries = await Promise.all(
      farmIds.map(async (id): Promise<readonly [string, number] | null> => {
        try {
          const fields = await fieldApi.getFarmFields(id);
          return [id, fields.length] as const;
        } catch {
          return null;
        }
      }),
    );
    return {
      counts: Object.fromEntries(entries.filter(Boolean) as (readonly [string, number])[]),
      overwrite,
    };
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchFarmDetailThunk = createAsyncThunk<Farm, string, ThunkConfig>(
  'farm/fetchFarmDetail',
  async (farmId, { rejectWithValue }) => {
    try {
      return await farmApi.getFarmDetails(farmId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const refreshFarmDetailThunk = createAsyncThunk<Farm, string, ThunkConfig>(
  'farm/refreshFarmDetail',
  async (farmId, { rejectWithValue }) => {
    try {
      return await farmApi.getFarmDetails(farmId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const createFarmThunk = createAsyncThunk<Farm, CreateFarmInput, ThunkConfig>(
  'farm/createFarm',
  async (input, { rejectWithValue }) => {
    try {
      return await farmApi.createMyFarm(input);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const updateFarmThunk = createAsyncThunk<Farm, UpdateFarmArgs, ThunkConfig>(
  'farm/updateFarm',
  async ({ farmId, input }, { rejectWithValue }) => {
    try {
      return await farmApi.updateMyFarm(farmId, input);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const resetFarmThunk = createAsyncThunk<Farm, string, ThunkConfig>(
  'farm/resetFarm',
  async (farmId, { rejectWithValue }) => {
    try {
      return await farmApi.resetMyFarm(farmId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const deleteFarmThunk = createAsyncThunk<string, string, ThunkConfig>(
  'farm/deleteFarm',
  async (farmId, { rejectWithValue }) => {
    try {
      await farmApi.deleteMyFarm(farmId);
      return farmId;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);
