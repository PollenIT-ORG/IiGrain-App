import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { logout } from './authSlice';
import type {
  ModuleKey,
  ModuleSummary,
  MonitoringContext,
  MonitoringDocument,
  MonitoringProgram,
  MonitoringRecord,
} from '../../types/monitoring';
import {
  fetchFarmProgramsThunk,
  fetchModulesThunk,
  fetchModuleRecordsThunk,
  fetchModuleRecordThunk,
  createRecordThunk,
  seedFieldPointsThunk,
  updateRecordThunk,
  deleteRecordThunk,
  fetchDocumentsThunk,
  uploadDocumentThunk,
  deleteDocumentThunk,
} from '../thunks/monitoringThunks';


const scopeOf = (programId: string, fieldId: string): string => `${programId}:${fieldId}`;

const moduleBucket = (module: string): string => `mod:${module}`;

const recordBucket = (module: string, recordId: string): string =>
  `rec:${module}:${recordId}`;

export const documentBucketKey = (module: string, recordId?: string | null): string =>
  recordId ? recordBucket(module, recordId) : moduleBucket(module);

const singleKey = (module: string, recordId: string): string => `${module}:${recordId}`;

type RecordMap = Partial<Record<ModuleKey, MonitoringRecord[]>>;
type FlagMap = Partial<Record<ModuleKey, boolean>>;
type ErrorMap = Partial<Record<ModuleKey, string | null>>;

export interface MonitoringState {
  programsByFarm: Record<string, MonitoringProgram[]>;
  programsFarmId: string | null;
  programsLoading: boolean;
  programsError: string | null;
  programByField: Record<string, string>;

  scope: string | null;
  context: MonitoringContext | null;

  modules: ModuleSummary[] | null;
  modulesLoading: boolean;
  modulesError: string | null;

  records: RecordMap;
  recordsLoading: FlagMap;
  recordsError: ErrorMap;
  singles: Record<string, MonitoringRecord>;

  documents: Record<string, MonitoringDocument[]>;
  documentsLoading: Record<string, boolean>;
  documentsError: Record<string, string | null>;

  saving: boolean;
  deletingRecordId: string | null;
  uploadingBucket: string | null;
  deletingDocumentId: string | null;
}

const initialState: MonitoringState = {
  programsByFarm: {},
  programsFarmId: null,
  programsLoading: false,
  programsError: null,
  programByField: {},

  scope: null,
  context: null,

  modules: null,
  modulesLoading: false,
  modulesError: null,

  records: {},
  recordsLoading: {},
  recordsError: {},
  singles: {},

  documents: {},
  documentsLoading: {},
  documentsError: {},

  saving: false,
  deletingRecordId: null,
  uploadingBucket: null,
  deletingDocumentId: null,
};

const resetScope = (state: MonitoringState, scope: string | null): void => {
  state.scope = scope;
  state.context = null;
  state.modules = null;
  state.modulesLoading = false;
  state.modulesError = null;
  state.records = {};
  state.recordsLoading = {};
  state.recordsError = {};
  state.singles = {};
  state.documents = {};
  state.documentsLoading = {};
  state.documentsError = {};
  state.saving = false;
  state.deletingRecordId = null;
  state.uploadingBucket = null;
  state.deletingDocumentId = null;
};

const inScope = (state: MonitoringState, arg: { programId: string; fieldId: string }): boolean =>
  state.scope === scopeOf(arg.programId, arg.fieldId);

const adjustSummary = (
  state: MonitoringState,
  module: ModuleKey,
  totalDelta: number,
  completedDelta: number,
  documentsDelta = 0,
): void => {
  if (!state.modules) {
    return;
  }
  const entry = state.modules.find(m => m.module === module);
  if (!entry) {
    return;
  }
  entry.total = Math.max(0, entry.total + totalDelta);
  entry.completed = Math.max(0, Math.min(entry.total, entry.completed + completedDelta));
  entry.documents = Math.max(0, entry.documents + documentsDelta);
};

const bumpRecordDocumentCount = (
  state: MonitoringState,
  module: ModuleKey,
  recordId: string,
  delta: number,
): void => {
  const record = state.records[module]?.find(r => r.id === recordId);
  if (record) {
    record.documentCount = Math.max(0, record.documentCount + delta);
  }
  const single = state.singles[singleKey(module, recordId)];
  if (single) {
    single.documentCount = Math.max(0, single.documentCount + delta);
  }
};

const monitoringSlice = createSlice({
  name: 'monitoring',
  initialState,
  reducers: {
    setMonitoringScope(
      state,
      action: PayloadAction<{ programId: string; fieldId: string }>,
    ) {
      const next = scopeOf(action.payload.programId, action.payload.fieldId);
      if (state.scope !== next) {
        resetScope(state, next);
      }
    },
    selectFieldProgram(
      state,
      action: PayloadAction<{ fieldId: string; programId: string }>,
    ) {
      state.programByField[action.payload.fieldId] = action.payload.programId;
    },
    invalidateModuleRecords(state, action: PayloadAction<ModuleKey>) {
      delete state.records[action.payload];
      delete state.recordsError[action.payload];
    },
    clearMonitoring: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchFarmProgramsThunk.pending, (state, action) => {
        state.programsLoading = true;
        state.programsFarmId = action.meta.arg.farmId;
        state.programsError = null;
      })
      .addCase(fetchFarmProgramsThunk.fulfilled, (state, action) => {
        state.programsLoading = false;
        state.programsByFarm[action.meta.arg.farmId] = action.payload;
      })
      .addCase(fetchFarmProgramsThunk.rejected, (state, action) => {
        state.programsLoading = false;
        state.programsError = action.payload?.message ?? 'Failed to load programs';
      })

      .addCase(fetchModulesThunk.pending, (state, action) => {
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        state.modulesLoading = true;
        state.modulesError = null;
      })
      .addCase(fetchModulesThunk.fulfilled, (state, action) => {
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        state.modulesLoading = false;
        state.modules = action.payload.modules;
        state.context = action.payload.context;
      })
      .addCase(fetchModulesThunk.rejected, (state, action) => {
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        state.modulesLoading = false;
        state.modulesError = action.payload?.message ?? 'Failed to load modules';
      })

      .addCase(fetchModuleRecordsThunk.pending, (state, action) => {
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        state.recordsLoading[action.meta.arg.module] = true;
        state.recordsError[action.meta.arg.module] = null;
      })
      .addCase(fetchModuleRecordsThunk.fulfilled, (state, action) => {
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        const { module } = action.meta.arg;
        state.recordsLoading[module] = false;
        state.records[module] = action.payload.records;
        state.context = action.payload.context;
      })
      .addCase(fetchModuleRecordsThunk.rejected, (state, action) => {
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        const { module } = action.meta.arg;
        state.recordsLoading[module] = false;
        state.recordsError[module] = action.payload?.message ?? 'Failed to load records';
      })

      .addCase(fetchModuleRecordThunk.fulfilled, (state, action) => {
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        const { module, recordId } = action.meta.arg;
        const list = state.records[module];
        const index = list?.findIndex(r => r.id === action.payload.id) ?? -1;
        const counted =
          list && index >= 0
            ? { ...action.payload, documentCount: list[index].documentCount }
            : action.payload;

        if (list && index >= 0) {
          list[index] = counted;
        }
        state.singles[singleKey(module, recordId)] = counted;
      })

      .addCase(createRecordThunk.pending, state => {
        state.saving = true;
      })
      .addCase(createRecordThunk.fulfilled, (state, action) => {
        state.saving = false;
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        const { module } = action.meta.arg;
        const list = state.records[module];
        if (list) {
          list.unshift(action.payload);
        }
        state.singles[singleKey(module, action.payload.id)] = action.payload;
        adjustSummary(state, module, 1, action.payload.status === 'completed' ? 1 : 0);
      })
      .addCase(createRecordThunk.rejected, state => {
        state.saving = false;
      })

      .addCase(seedFieldPointsThunk.fulfilled, (state, action) => {
        if (!inScope(state, action.meta.arg) || action.payload.created.length === 0) {
          return;
        }
        const { module } = action.meta.arg;
        const list = state.records[module];
        if (list) {
          list.unshift(...[...action.payload.created].reverse());
        }
        for (const record of action.payload.created) {
          state.singles[singleKey(module, record.id)] = record;
        }
        adjustSummary(state, module, action.payload.created.length, 0);
      })

      .addCase(updateRecordThunk.pending, state => {
        state.saving = true;
      })
      .addCase(updateRecordThunk.fulfilled, (state, action) => {
        state.saving = false;
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        const { module, recordId } = action.meta.arg;
        const list = state.records[module];
        const index = list?.findIndex(r => r.id === recordId) ?? -1;
        if (list && index >= 0) {
          const before = list[index];
          list[index] = { ...action.payload, documentCount: before.documentCount };
          const wasDone = before.status === 'completed';
          const isDone = action.payload.status === 'completed';
          if (wasDone !== isDone) {
            adjustSummary(state, module, 0, isDone ? 1 : -1);
          }
        }
        const key = singleKey(module, recordId);
        if (state.singles[key]) {
          state.singles[key] = {
            ...action.payload,
            documentCount: state.singles[key].documentCount,
          };
        }
      })
      .addCase(updateRecordThunk.rejected, state => {
        state.saving = false;
      })

      .addCase(deleteRecordThunk.pending, (state, action) => {
        state.deletingRecordId = action.meta.arg.recordId;
      })
      .addCase(deleteRecordThunk.fulfilled, (state, action) => {
        state.deletingRecordId = null;
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        const { module, recordId } = action.meta.arg;
        const list = state.records[module];
        const removed = list?.find(r => r.id === recordId);
        if (list) {
          state.records[module] = list.filter(r => r.id !== recordId);
        }
        if (removed) {
          adjustSummary(
            state,
            module,
            -1,
            removed.status === 'completed' ? -1 : 0,
            -removed.documentCount,
          );
        }
        delete state.singles[singleKey(module, recordId)];
        delete state.documents[recordBucket(module, recordId)];
        const bucket = state.documents[moduleBucket(module)];
        if (bucket) {
          state.documents[moduleBucket(module)] = bucket.filter(
            d => d.recordId !== recordId,
          );
        }
      })
      .addCase(deleteRecordThunk.rejected, state => {
        state.deletingRecordId = null;
      })

      .addCase(fetchDocumentsThunk.pending, (state, action) => {
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        const key = documentBucketKey(
          action.meta.arg.module ?? 'other',
          action.meta.arg.recordId,
        );
        state.documentsLoading[key] = true;
        state.documentsError[key] = null;
      })
      .addCase(fetchDocumentsThunk.fulfilled, (state, action) => {
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        const key = documentBucketKey(
          action.meta.arg.module ?? 'other',
          action.meta.arg.recordId,
        );
        state.documentsLoading[key] = false;
        state.documents[key] = action.payload;
      })
      .addCase(fetchDocumentsThunk.rejected, (state, action) => {
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        const key = documentBucketKey(
          action.meta.arg.module ?? 'other',
          action.meta.arg.recordId,
        );
        state.documentsLoading[key] = false;
        state.documentsError[key] = action.payload?.message ?? 'Failed to load files';
      })

      .addCase(uploadDocumentThunk.pending, (state, action) => {
        state.uploadingBucket = documentBucketKey(
          action.meta.arg.module,
          action.meta.arg.recordId,
        );
      })
      .addCase(uploadDocumentThunk.fulfilled, (state, action) => {
        state.uploadingBucket = null;
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        const { module, recordId } = action.meta.arg;
        const key = documentBucketKey(module, recordId);
        state.documents[key] = [action.payload, ...(state.documents[key] ?? [])];

        if (recordId) {
          const modKey = moduleBucket(module);
          if (state.documents[modKey]) {
            state.documents[modKey] = [action.payload, ...state.documents[modKey]];
          }
          bumpRecordDocumentCount(state, module as ModuleKey, recordId, 1);
        }
        adjustSummary(state, module as ModuleKey, 0, 0, 1);
      })
      .addCase(uploadDocumentThunk.rejected, state => {
        state.uploadingBucket = null;
      })

      .addCase(deleteDocumentThunk.pending, (state, action) => {
        state.deletingDocumentId = action.meta.arg.documentId;
      })
      .addCase(deleteDocumentThunk.fulfilled, (state, action) => {
        state.deletingDocumentId = null;
        if (!inScope(state, action.meta.arg)) {
          return;
        }
        const { documentId, module, recordId } = action.meta.arg;
        for (const key of Object.keys(state.documents)) {
          state.documents[key] = state.documents[key].filter(d => d.id !== documentId);
        }
        if (recordId) {
          bumpRecordDocumentCount(state, module as ModuleKey, recordId, -1);
        }
        adjustSummary(state, module as ModuleKey, 0, 0, -1);
      })
      .addCase(deleteDocumentThunk.rejected, state => {
        state.deletingDocumentId = null;
      })

      .addCase(logout, () => initialState);
  },
});

export const {
  setMonitoringScope,
  selectFieldProgram,
  invalidateModuleRecords,
  clearMonitoring,
} = monitoringSlice.actions;

export default monitoringSlice.reducer;

export {
  fetchFarmProgramsThunk,
  fetchModulesThunk,
  fetchModuleRecordsThunk,
  fetchModuleRecordThunk,
  createRecordThunk,
  seedFieldPointsThunk,
  updateRecordThunk,
  deleteRecordThunk,
  fetchDocumentsThunk,
  uploadDocumentThunk,
  deleteDocumentThunk,
};


interface HasMonitoring {
  monitoring: MonitoringState;
}

const EMPTY_PROGRAMS: MonitoringProgram[] = [];
const EMPTY_DOCUMENTS: MonitoringDocument[] = [];

export const selectMonitoringScope = (s: HasMonitoring): string | null => s.monitoring.scope;

export const selectMonitoringContext = (s: HasMonitoring): MonitoringContext | null =>
  s.monitoring.context;

export const selectFarmPrograms = (
  s: HasMonitoring,
  farmId: string,
): MonitoringProgram[] => s.monitoring.programsByFarm[farmId] ?? EMPTY_PROGRAMS;

export const selectFarmProgramsLoaded = (s: HasMonitoring, farmId: string): boolean =>
  s.monitoring.programsByFarm[farmId] !== undefined;

export const selectProgramsLoading = (s: HasMonitoring): boolean =>
  s.monitoring.programsLoading;

export const selectProgramsError = (s: HasMonitoring): string | null =>
  s.monitoring.programsError;

export const selectChosenProgramId = (s: HasMonitoring, fieldId: string): string | undefined =>
  s.monitoring.programByField[fieldId];

export const selectModules = (s: HasMonitoring): ModuleSummary[] | null =>
  s.monitoring.modules;

export const selectModulesLoading = (s: HasMonitoring): boolean =>
  s.monitoring.modulesLoading;

export const selectModulesError = (s: HasMonitoring): string | null =>
  s.monitoring.modulesError;

export const selectModuleRecords = (
  s: HasMonitoring,
  module: ModuleKey,
): MonitoringRecord[] | undefined => s.monitoring.records[module];

export const selectModuleRecordsLoading = (s: HasMonitoring, module: ModuleKey): boolean =>
  s.monitoring.recordsLoading[module] ?? false;

export const selectModuleRecordsError = (
  s: HasMonitoring,
  module: ModuleKey,
): string | null => s.monitoring.recordsError[module] ?? null;

export const selectRecordById = (
  s: HasMonitoring,
  module: ModuleKey,
  recordId: string,
): MonitoringRecord | undefined =>
  s.monitoring.records[module]?.find(r => r.id === recordId) ??
  s.monitoring.singles[singleKey(module, recordId)];

export const selectDocuments = (s: HasMonitoring, key: string): MonitoringDocument[] =>
  s.monitoring.documents[key] ?? EMPTY_DOCUMENTS;

export const selectDocumentsLoaded = (s: HasMonitoring, key: string): boolean =>
  s.monitoring.documents[key] !== undefined;

export const selectDocumentsLoading = (s: HasMonitoring, key: string): boolean =>
  s.monitoring.documentsLoading[key] ?? false;

export const selectDocumentsError = (s: HasMonitoring, key: string): string | null =>
  s.monitoring.documentsError[key] ?? null;

export const selectMonitoringSaving = (s: HasMonitoring): boolean => s.monitoring.saving;

export const selectDeletingRecordId = (s: HasMonitoring): string | null =>
  s.monitoring.deletingRecordId;

export const selectUploadingBucket = (s: HasMonitoring): string | null =>
  s.monitoring.uploadingBucket;

export const selectDeletingDocumentId = (s: HasMonitoring): string | null =>
  s.monitoring.deletingDocumentId;
