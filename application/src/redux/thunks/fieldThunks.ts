import { createAsyncThunk } from '@reduxjs/toolkit';
import * as fieldApi from '../../api/FieldApi';
import type { CreateFieldInput, UpdateFieldInput } from '../../api/FieldApi';
import type { Field } from '../../types/farm';
import {
  handleApiError,
  isTimeoutError,
  StandardizedError,
} from '../../utils/handleApiError';
import { asOwnerUserId, isDatabaseReady } from '../../services/db';
import type { OwnerUserId } from '../../services/db/types';
import {
  cacheFieldList,
  fieldFromRow,
  readCachedFieldList,
  resolveFarmRow,
} from '../../services/sync/farmCache';
import { createFieldOffline } from '../../services/sync';
import { acresFromBoundary } from '../../maps/utils/fieldAcres';
import { refreshFarmDetailThunk } from './farmThunks';

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

const loadFarmFields = async (
  farmId: string,
  getState: () => unknown,
): Promise<Field[]> => {
  const owner = ownerFrom(getState);
  try {
    const fields = await fieldApi.getFarmFields(farmId);
    if (owner) {
      await cacheFieldList(owner, farmId, fields).catch(() => undefined);
    }
    return fields;
  } catch (error) {
    if (owner && handleApiError(error).kind === 'offline') {
      const cached = await readCachedFieldList(owner, farmId).catch(() => null);
      if (cached) {
        return cached;
      }
    }
    throw error;
  }
};

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

const backfilledFieldIds = new Set<string>();

const needsAcresBackfill = (field: Field): boolean =>
  !!field.areaFromOutline && field.areaAcres > 0 && !backfilledFieldIds.has(field.id);

export interface BackfillAcresArgs {
  farmId: string;
  fields: Field[];
}

export const backfillBoundaryAcresThunk = createAsyncThunk<
  number,
  BackfillAcresArgs,
  ThunkConfig
>(
  'field/backfillBoundaryAcres',
  async ({ farmId, fields }, { dispatch }) => {
    let stored = 0;
    for (const field of fields.filter(needsAcresBackfill)) {
      backfilledFieldIds.add(field.id);
      const saved = await fieldApi
        .updateFarmField(farmId, field.id, { areaAcres: field.areaAcres })
        .then(
          () => true,
          () => false,
        );
      if (saved) {
        stored += 1;
      }
    }
    if (stored > 0) {
      dispatch(refreshFarmDetailThunk(farmId));
    }
    return stored;
  },
  {
    condition: ({ fields }) => fields.some(needsAcresBackfill),
  },
);

export const fetchFarmFieldsThunk = createAsyncThunk<FieldsResult, string, ThunkConfig>(
  'field/fetchFarmFields',
  async (farmId, { getState, dispatch, rejectWithValue }) => {
    try {
      const fields = await loadFarmFields(farmId, getState);
      dispatch(backfillBoundaryAcresThunk({ farmId, fields }));
      return { farmId, fields };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const refreshFarmFieldsThunk = createAsyncThunk<FieldsResult, string, ThunkConfig>(
  'field/refreshFarmFields',
  async (farmId, { getState, dispatch, rejectWithValue }) => {
    try {
      const fields = await loadFarmFields(farmId, getState);
      dispatch(backfillBoundaryAcresThunk({ farmId, fields }));
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
>('field/createField', async ({ farmId, input }, { getState, rejectWithValue }) => {
  const owner = ownerFrom(getState);
  try {
    const field = await fieldApi.createFarmField(farmId, input);
    if (owner) {
      await cacheFieldList(owner, farmId, [field]).catch(() => undefined);
    }
    return { farmId, field };
  } catch (error) {
    const standardized = handleApiError(error);
    if (owner && standardized.kind === 'offline') {
      const farm = await resolveFarmRow(owner, farmId).catch(() => null);
      if (farm) {
        try {
          const row = await createFieldOffline(
            owner,
            farm.local_id,
            {
              name: input.name,
              area_acres: input.areaAcres ?? acresFromBoundary(input.boundary) ?? null,
              crop: input.crop ?? null,
              season: input.season ?? null,
              irrigation: input.irrigation ?? null,
              location: input.location ?? null,
              latitude: input.latitude ?? null,
              longitude: input.longitude ?? null,
              sowing_date: input.sowingDate ?? null,
              expected_harvest: input.expectedHarvest ?? null,
              status: input.status ?? 'healthy',
            },
            { outcomeUncertain: isTimeoutError(error) },
          );
          return { farmId, field: fieldFromRow(row, farmId) };
        } catch {
          return rejectWithValue(standardized);
        }
      }
    }
    return rejectWithValue(standardized);
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

export interface FieldScopeArgs {
  farmId: string;
  fieldId: string;
}

export const resetFieldThunk = createAsyncThunk<
  { farmId: string; field: Field | null },
  FieldScopeArgs,
  ThunkConfig
>('field/resetField', async ({ farmId, fieldId }, { rejectWithValue }) => {
  try {
    const field = await fieldApi.resetFarmField(farmId, fieldId);
    return { farmId, field };
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const deleteFieldThunk = createAsyncThunk<
  FieldScopeArgs,
  FieldScopeArgs,
  ThunkConfig
>('field/deleteField', async ({ farmId, fieldId }, { rejectWithValue }) => {
  try {
    await fieldApi.deleteFarmField(farmId, fieldId);
    return { farmId, fieldId };
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});
