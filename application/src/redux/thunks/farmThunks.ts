import { createAsyncThunk } from '@reduxjs/toolkit';
import * as farmApi from '../../api/FarmApi';
import * as fieldApi from '../../api/FieldApi';
import type { CreateFarmInput, PagedFarms, UpdateFarmInput } from '../../api/FarmApi';
import type { Farm } from '../../types/farm';
import type { PageQuery } from '../../types/pagination';
import {
  handleApiError,
  isTimeoutError,
  StandardizedError,
} from '../../utils/handleApiError';
import { asOwnerUserId, isDatabaseReady } from '../../services/db';
import type { OwnerUserId } from '../../services/db/types';
import {
  cacheFarmList,
  farmFromRow,
  readCachedFarm,
  readCachedFarmList,
} from '../../services/sync/farmCache';
import { createFarmOffline } from '../../services/sync';

type ThunkConfig = { rejectValue: StandardizedError };

interface AuthStateSlice {
  auth?: { user?: { id?: string } | null } | null;
}

const ownerFrom = (getState: () => unknown): OwnerUserId | null => {
  if (!isDatabaseReady()) {
    return null;
  }
  const userId = (getState() as AuthStateSlice).auth?.user?.id;
  return userId ? asOwnerUserId(userId) : null;
};

const loadFarms = async (
  query: FarmListArgs,
  getState: () => unknown,
): Promise<PagedFarms> => {
  const owner = ownerFrom(getState);
  try {
    const page = await farmApi.getMyFarms(query);
    if (owner) {
      await cacheFarmList(owner, page.farms).catch(() => undefined);
    }
    return page;
  } catch (error) {
    if (owner && handleApiError(error).kind === 'offline') {
      const cached = await readCachedFarmList(owner, query).catch(() => null);
      if (cached) {
        return cached;
      }
    }
    throw error;
  }
};

export interface UpdateFarmArgs {
  farmId: string;
  input: UpdateFarmInput;
}

export type FarmListArgs = PageQuery | undefined;

export const fetchFarmsThunk = createAsyncThunk<PagedFarms, FarmListArgs, ThunkConfig>(
  'farm/fetchFarms',
  async (query, { getState, rejectWithValue }) => {
    try {
      return await loadFarms(query, getState);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const refreshFarmsThunk = createAsyncThunk<PagedFarms, FarmListArgs, ThunkConfig>(
  'farm/refreshFarms',
  async (query, { getState, rejectWithValue }) => {
    try {
      return await loadFarms({ ...query, page: 1 }, getState);
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

const loadFarmDetail = async (
  farmId: string,
  getState: () => unknown,
): Promise<Farm> => {
  const owner = ownerFrom(getState);
  try {
    const farm = await farmApi.getFarmDetails(farmId);
    if (owner) {
      await cacheFarmList(owner, [farm]).catch(() => undefined);
    }
    return farm;
  } catch (error) {
    if (owner && handleApiError(error).kind === 'offline') {
      const cached = await readCachedFarm(owner, farmId).catch(() => null);
      if (cached) {
        return cached;
      }
    }
    throw error;
  }
};

export const fetchFarmDetailThunk = createAsyncThunk<Farm, string, ThunkConfig>(
  'farm/fetchFarmDetail',
  async (farmId, { getState, rejectWithValue }) => {
    try {
      return await loadFarmDetail(farmId, getState);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const refreshFarmDetailThunk = createAsyncThunk<Farm, string, ThunkConfig>(
  'farm/refreshFarmDetail',
  async (farmId, { getState, rejectWithValue }) => {
    try {
      return await loadFarmDetail(farmId, getState);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const createFarmThunk = createAsyncThunk<Farm, CreateFarmInput, ThunkConfig>(
  'farm/createFarm',
  async (input, { getState, rejectWithValue }) => {
    const owner = ownerFrom(getState);
    try {
      const created = await farmApi.createMyFarm(input);
      if (owner) {
        await cacheFarmList(owner, [created]).catch(() => undefined);
      }
      return created;
    } catch (error) {
      const standardized = handleApiError(error);
      if (owner && standardized.kind === 'offline') {
        try {
          const row = await createFarmOffline(
            owner,
            {
              name: input.name,
              business_entity: input.businessEntity ?? null,
              area_acres: input.areaAcres ?? null,
              location: input.location ?? null,
              latitude: input.latitude ?? null,
              longitude: input.longitude ?? null,
              status: 'active',
            },
            { outcomeUncertain: isTimeoutError(error) },
          );
          return farmFromRow(row);
        } catch {
          return rejectWithValue(standardized);
        }
      }
      return rejectWithValue(standardized);
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
