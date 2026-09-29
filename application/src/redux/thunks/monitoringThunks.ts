import { createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../../api/fieldMonitoringApi';
import { extractFieldErrors } from '../../api/fieldMonitoringApi';
import { takesFieldPoints } from '../../config/monitoringModules';
import {
  handleApiError,
  isTimeoutError,
  type StandardizedError,
} from '../../utils/handleApiError';
import type {
  DocumentKind,
  DocumentModule,
  ModuleKey,
  MonitoringContext,
  MonitoringDocument,
  MonitoringFieldErrors,
  MonitoringRecord,
  RecordPatch,
  RecordPayload,
  UploadFile,
} from '../../types/monitoring';

export interface MonitoringError extends StandardizedError {
  fieldErrors: MonitoringFieldErrors;
}

import { asOwnerUserId, isDatabaseReady } from '../../services/db';
import type { OwnerUserId } from '../../services/db/types';
import {
  cacheMonitoringRecords,
  readCachedMonitoringRecord,
  readCachedMonitoringRecords,
  recordFromRow,
} from '../../services/sync/monitoringCache';
import {
  createMonitoringOffline,
  updateMonitoringOffline,
} from '../../services/sync';
import { resolveFieldRow } from '../../services/sync/farmCache';
import { throughOfflineSnapshot } from '../../services/sync/offlineSnapshot';
import { monitoringRepository } from '../../repositories';

type ThunkConfig = { rejectValue: MonitoringError };

const toError = (error: unknown): MonitoringError => ({
  ...handleApiError(error),
  fieldErrors: extractFieldErrors(error),
});

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

const isOffline = (error: unknown): boolean =>
  handleApiError(error).kind === 'offline';

const recordValues = (
  payload: RecordPayload | RecordPatch,
): Record<string, string | number | null> => {
  const values: Record<string, string | number | null> = {};
  if (payload.status !== undefined) {
    values.status = payload.status;
  }
  if (payload.notes !== undefined) {
    values.notes = payload.notes ?? null;
  }
  if (payload.values !== undefined) {
    values.values_json = JSON.stringify(payload.values ?? {});
  }
  return values;
};


export interface ScopeArg {
  fieldId: string;
}

export const fetchModulesThunk = createAsyncThunk<
  api.ModulesResult,
  ScopeArg,
  ThunkConfig
>('monitoring/modules', async ({ fieldId }, { getState, rejectWithValue }) => {
  try {
    return await throughOfflineSnapshot(ownerFrom(getState), `monitoring:${fieldId}:modules`, () =>
      api.getModules(fieldId),
    );
  } catch (error) {
    return rejectWithValue(toError(error));
  }
});

export interface ModuleArg extends ScopeArg {
  module: ModuleKey;
}

export const fetchModuleRecordsThunk = createAsyncThunk<
  api.RecordsResult,
  ModuleArg,
  ThunkConfig
>('monitoring/records', async ({ fieldId, module }, { getState, rejectWithValue }) => {
  const owner = ownerFrom(getState);
  try {
    const result = await api.getRecords(fieldId, module);
    if (owner) {
      await cacheMonitoringRecords(owner, fieldId, module, result.records).catch(
        () => undefined,
      );
    }
    return result;
  } catch (error) {
    if (owner && isOffline(error)) {
      const cached = await readCachedMonitoringRecords(owner, fieldId, module).catch(
        () => null,
      );
      if (cached) {
        const state = getState() as { monitoring?: { context?: MonitoringContext } };
        const context = state.monitoring?.context;
        if (context) {
          return { context, records: cached };
        }
      }
    }
    return rejectWithValue(toError(error));
  }
});

export interface RecordArg extends ModuleArg {
  recordId: string;
}

export const fetchModuleRecordThunk = createAsyncThunk<
  MonitoringRecord,
  RecordArg,
  ThunkConfig
>('monitoring/record', async ({ fieldId, module, recordId }, { getState, rejectWithValue }) => {
  const owner = ownerFrom(getState);
  try {
    const record = await api.getRecord(fieldId, module, recordId);
    if (owner) {
      await cacheMonitoringRecords(owner, fieldId, module, [record]).catch(
        () => undefined,
      );
    }
    return record;
  } catch (error) {
    if (owner && isOffline(error)) {
      const cached = await readCachedMonitoringRecord(owner, recordId).catch(() => null);
      if (cached) {
        return cached;
      }
    }
    return rejectWithValue(toError(error));
  }
});

export interface CreateRecordArg extends ModuleArg {
  payload: RecordPayload;
}

export const createRecordThunk = createAsyncThunk<
  MonitoringRecord,
  CreateRecordArg,
  ThunkConfig
>('monitoring/createRecord', async ({ fieldId, module, payload }, { getState, rejectWithValue }) => {
  const owner = ownerFrom(getState);
  try {
    const record = await api.createRecord(fieldId, module, payload);
    if (owner) {
      await cacheMonitoringRecords(owner, fieldId, module, [record]).catch(
        () => undefined,
      );
    }
    return record;
  } catch (error) {
    if (owner && isOffline(error)) {
      const field = await resolveFieldRow(owner, fieldId).catch(() => null);
      if (field) {
        try {
          const row = await createMonitoringOffline(
            owner,
            field.local_id,
            module,
            recordValues(payload),
            { outcomeUncertain: isTimeoutError(error) },
          );
          return recordFromRow(row);
        } catch {
          return rejectWithValue(toError(error));
        }
      }
    }
    return rejectWithValue(toError(error));
  }
});

export interface UpdateRecordArg extends RecordArg {
  patch: RecordPatch;
}

export const updateRecordThunk = createAsyncThunk<
  MonitoringRecord,
  UpdateRecordArg,
  ThunkConfig
>(
  'monitoring/updateRecord',
  async ({ fieldId, module, recordId, patch }, { getState, rejectWithValue }) => {
    const owner = ownerFrom(getState);
    try {
      const record = await api.updateRecord(fieldId, module, recordId, patch);
      if (owner) {
        await cacheMonitoringRecords(owner, fieldId, module, [record]).catch(
          () => undefined,
        );
      }
      return record;
    } catch (error) {
      if (owner && isOffline(error)) {
        const existing =
          (await monitoringRepository.getByServerId(owner, recordId).catch(() => null)) ??
          (await monitoringRepository.getByLocalId(owner, recordId).catch(() => null));
        if (existing) {
          try {
            const row = await updateMonitoringOffline(
              owner,
              existing.local_id,
              recordValues(patch),
            );
            if (row) {
              return recordFromRow(row);
            }
          } catch {
            return rejectWithValue(toError(error));
          }
        }
      }
      return rejectWithValue(toError(error));
    }
  },
);

export interface FieldPoint {
  label: string;
  latitude: number;
  longitude: number;
}

export interface SeedFieldPointsArg extends ScopeArg {
  module: ModuleKey;
  points: FieldPoint[];
}

export interface SeedFieldPointsResult {
  created: MonitoringRecord[];
  complete: boolean;
}

const coordKey = (latitude: number, longitude: number): string =>
  `${latitude.toFixed(6)},${longitude.toFixed(6)}`;



export const seedFieldPointsThunk = createAsyncThunk<
  SeedFieldPointsResult,
  SeedFieldPointsArg,
  ThunkConfig
>('monitoring/seedFieldPoints', async ({ fieldId, module, points }, { rejectWithValue }) => {
  if (!takesFieldPoints(module)) {
    return { created: [], complete: true };
  }
  try {
    const { records } = await api.getRecords(fieldId, module);

    const taken = new Set<string>();
    for (const record of records) {
      const latitude = Number(record.values.latitude);
      const longitude = Number(record.values.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        taken.add(coordKey(latitude, longitude));
      }
    }

    const missing = points.filter(p => !taken.has(coordKey(p.latitude, p.longitude)));
    const created: MonitoringRecord[] = [];
    let complete = true;

    for (const point of missing) {
      try {
        created.push(
          await api.createRecord(fieldId, module, {
            status: 'in_progress',
            notes: null,
            values: {
              point_label: point.label,
              latitude: point.latitude,
              longitude: point.longitude,
            },
          }),
        );
      } catch {
        complete = false;
      }
    }

    return { created, complete };
  } catch (error) {
    return rejectWithValue(toError(error));
  }
});

export const deleteRecordThunk = createAsyncThunk<string, RecordArg, ThunkConfig>(
  'monitoring/deleteRecord',
  async ({ fieldId, module, recordId }, { rejectWithValue }) => {
    try {
      return await api.deleteRecord(fieldId, module, recordId);
    } catch (error) {
      return rejectWithValue(toError(error));
    }
  },
);


export interface DocumentsArg extends ScopeArg {
  module?: DocumentModule;
  recordId?: string;
}

export const fetchDocumentsThunk = createAsyncThunk<
  MonitoringDocument[],
  DocumentsArg,
  ThunkConfig
>('monitoring/documents', async ({ fieldId, module, recordId }, { getState, rejectWithValue }) => {
  try {
    return await throughOfflineSnapshot(
      ownerFrom(getState),
      `monitoring:${fieldId}:documents:${module ?? 'all'}:${recordId ?? 'none'}`,
      () => api.getDocuments(fieldId, { module, recordId }),
    );
  } catch (error) {
    return rejectWithValue(toError(error));
  }
});

export interface UploadDocumentArg extends ScopeArg {
  module: DocumentModule;
  recordId?: string | null;
  kind?: DocumentKind;
  file: UploadFile;
}

export const uploadDocumentThunk = createAsyncThunk<
  MonitoringDocument,
  UploadDocumentArg,
  ThunkConfig
>('monitoring/uploadDocument', async (arg, { rejectWithValue }) => {
  try {
    return await api.uploadDocument(arg);
  } catch (error) {
    return rejectWithValue(toError(error));
  }
});

export interface DeleteDocumentArg extends ScopeArg {
  documentId: string;
  module: DocumentModule;
  recordId?: string | null;
}

export const deleteDocumentThunk = createAsyncThunk<
  string,
  DeleteDocumentArg,
  ThunkConfig
>('monitoring/deleteDocument', async ({ fieldId, documentId }, { rejectWithValue }) => {
  try {
    return await api.deleteDocument(fieldId, documentId);
  } catch (error) {
    return rejectWithValue(toError(error));
  }
});
