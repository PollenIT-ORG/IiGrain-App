import { createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../../api/fieldMonitoringApi';
import { extractFieldErrors } from '../../api/fieldMonitoringApi';
import { handleApiError, type StandardizedError } from '../../utils/handleApiError';
import type {
  DocumentKind,
  DocumentModule,
  ModuleKey,
  MonitoringDocument,
  MonitoringFieldErrors,
  MonitoringProgram,
  MonitoringRecord,
  RecordPatch,
  RecordPayload,
  UploadFile,
} from '../../types/monitoring';

export interface MonitoringError extends StandardizedError {
  fieldErrors: MonitoringFieldErrors;
}

type ThunkConfig = { rejectValue: MonitoringError };

const toError = (error: unknown): MonitoringError => ({
  ...handleApiError(error),
  fieldErrors: extractFieldErrors(error),
});


export interface FarmProgramsArg {
  farmId: string;
}

export const fetchFarmProgramsThunk = createAsyncThunk<
  MonitoringProgram[],
  FarmProgramsArg,
  ThunkConfig
>('monitoring/farmPrograms', async ({ farmId }, { rejectWithValue }) => {
  try {
    return await api.getFarmPrograms(farmId);
  } catch (error) {
    return rejectWithValue(toError(error));
  }
});


export interface ScopeArg {
  programId: string;
  fieldId: string;
}

export const fetchModulesThunk = createAsyncThunk<
  api.ModulesResult,
  ScopeArg,
  ThunkConfig
>('monitoring/modules', async ({ programId, fieldId }, { rejectWithValue }) => {
  try {
    return await api.getModules(programId, fieldId);
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
>('monitoring/records', async ({ programId, fieldId, module }, { rejectWithValue }) => {
  try {
    return await api.getRecords(programId, fieldId, module);
  } catch (error) {
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
>('monitoring/record', async ({ programId, fieldId, module, recordId }, { rejectWithValue }) => {
  try {
    return await api.getRecord(programId, fieldId, module, recordId);
  } catch (error) {
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
>('monitoring/createRecord', async ({ programId, fieldId, module, payload }, { rejectWithValue }) => {
  try {
    return await api.createRecord(programId, fieldId, module, payload);
  } catch (error) {
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
  async ({ programId, fieldId, module, recordId, patch }, { rejectWithValue }) => {
    try {
      return await api.updateRecord(programId, fieldId, module, recordId, patch);
    } catch (error) {
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
>('monitoring/seedFieldPoints', async ({ programId, fieldId, module, points }, { rejectWithValue }) => {
  try {
    const { records } = await api.getRecords(programId, fieldId, module);

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
          await api.createRecord(programId, fieldId, module, {
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
  async ({ programId, fieldId, module, recordId }, { rejectWithValue }) => {
    try {
      return await api.deleteRecord(programId, fieldId, module, recordId);
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
>('monitoring/documents', async ({ programId, fieldId, module, recordId }, { rejectWithValue }) => {
  try {
    return await api.getDocuments(programId, fieldId, { module, recordId });
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
>('monitoring/deleteDocument', async ({ programId, fieldId, documentId }, { rejectWithValue }) => {
  try {
    return await api.deleteDocument(programId, fieldId, documentId);
  } catch (error) {
    return rejectWithValue(toError(error));
  }
});
