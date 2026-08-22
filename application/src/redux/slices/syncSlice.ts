import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { logout } from './authSlice';
import { Tags, tagsForSync } from '../syncTags';

export interface SyncState {
  tags: Record<string, number>;
  epoch: number;
  connected: boolean;
}

const initialState: SyncState = {
  tags: {},
  epoch: 0,
  connected: false,
};

interface FulfilledAction {
  type: string;
  meta?: { arg?: unknown };
}

const isFulfilledWrite = (action: unknown): action is FulfilledAction => {
  const type = (action as { type?: unknown } | null)?.type;
  return typeof type === 'string' && type.endsWith('/fulfilled');
};

const writeKey = (type: string): string => type.slice(0, -'/fulfilled'.length);

type WriteArg = {
  fieldId?: unknown;
  farmId?: unknown;
  programId?: unknown;
  id?: unknown;
  module?: unknown;
};

const argOf = (action: FulfilledAction): WriteArg => {
  const arg = action.meta?.arg;
  return arg && typeof arg === 'object' ? (arg as WriteArg) : {};
};

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const FARM_SHAPE_TAGS = [
  Tags.farms,
  Tags.dashboard,
  Tags.enrollableFields,
  Tags.programs,
];

const ENROLMENT_TAGS = [
  Tags.programs,
  Tags.enrollableFields,
  Tags.myAssessments,
  Tags.assessmentHistory,
  Tags.farms,
  Tags.dashboard,
];

const assessmentWrite = (arg: WriteArg): string[] =>
  tagsForSync({
    resource: 'assessment',
    action: 'updated',
    programId: str(arg.programId) ?? undefined,
    fieldId: str(arg.fieldId) ?? undefined,
  });

const WRITE_INVALIDATIONS: Record<string, (arg: WriteArg) => string[]> = {
  'assessment/saveAnswer': assessmentWrite,
  'assessment/submit': assessmentWrite,
  'assessment/discard': assessmentWrite,
  'assessor/saveAnswer': assessmentWrite,
  'assessor/submit': assessmentWrite,

  'enrollment/enrollSelf': arg => withMonitoringPrograms(ENROLMENT_TAGS, arg),
  'enrollment/unenrollField': arg => withMonitoringPrograms(ENROLMENT_TAGS, arg),

  'farm/createFarm': () => FARM_SHAPE_TAGS,
  'farm/updateFarm': () => FARM_SHAPE_TAGS,
  'farm/deleteFarm': () => FARM_SHAPE_TAGS,
  'farm/resetFarm': () => FARM_SHAPE_TAGS,

  'field/createField': arg => withFarm(FARM_SHAPE_TAGS, arg),
  'field/updateField': arg => withFarm(FARM_SHAPE_TAGS, arg),
  'field/deleteField': arg => withFarm(FARM_SHAPE_TAGS, arg),
  'field/resetField': arg => withFarm(FARM_SHAPE_TAGS, arg),

  'soil/save': arg => {
    const fieldId = str(arg.fieldId);
    return fieldId ? [Tags.soil(fieldId), Tags.field(fieldId)] : [];
  },

  'fieldDetails/uploadDocument': arg => withField([], arg),
  'fieldDetails/deleteDocument': arg => withField([], arg),

  'monitoring/createRecord': monitoringWrite,
  'monitoring/seedFieldPoints': monitoringWrite,
  'monitoring/updateRecord': monitoringWrite,
  'monitoring/deleteRecord': monitoringWrite,
  'monitoring/uploadDocument': monitoringWrite,
  'monitoring/deleteDocument': monitoringWrite,
};

const withMonitoringPrograms = (base: string[], arg: WriteArg): string[] => {
  const farmId = str(arg.farmId);
  return farmId ? [...base, Tags.monitoringPrograms(farmId)] : base;
};

function monitoringWrite(arg: WriteArg): string[] {
  const programId = str(arg.programId);
  const fieldId = str(arg.fieldId);
  if (!programId || !fieldId) {
    return [];
  }
  const module = str(arg.module);
  const tags = [Tags.monitoring(programId, fieldId)];
  if (module) {
    tags.push(Tags.monitoringModule(programId, fieldId, module));
  }
  return tags;
}

const withFarm = (base: string[], arg: WriteArg): string[] => {
  const farmId = str(arg.farmId);
  return farmId ? [...base, Tags.fields(farmId), Tags.farm(farmId)] : base;
};

const withField = (base: string[], arg: WriteArg): string[] => {
  const fieldId = str(arg.fieldId);
  return fieldId ? [...base, Tags.field(fieldId)] : base;
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    invalidateTags(state, action: PayloadAction<readonly string[]>) {
      for (const tag of action.payload) {
        state.tags[tag] = (state.tags[tag] ?? 0) + 1;
      }
    },
    bumpSyncEpoch(state) {
      state.epoch += 1;
    },
    setSocketConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(logout, () => initialState)
      .addMatcher(isFulfilledWrite, (state, action) => {
        const tags = WRITE_INVALIDATIONS[writeKey(action.type)]?.(argOf(action));
        if (!tags) {
          return;
        }
        for (const tag of tags) {
          state.tags[tag] = (state.tags[tag] ?? 0) + 1;
        }
      });
  },
});

export const { invalidateTags, bumpSyncEpoch, setSocketConnected } = syncSlice.actions;
export default syncSlice.reducer;

interface HasSync {
  sync: SyncState;
}

export const selectSocketConnected = (s: HasSync): boolean => s.sync.connected;

export const selectTagStamp = (s: HasSync, tags: readonly string[]): number => {
  let stamp = s.sync.epoch;
  for (const tag of tags) {
    stamp += s.sync.tags[tag] ?? 0;
  }
  return stamp;
};
