import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { logout } from './authSlice';
import { Tags } from '../syncTags';

/**
 * The invalidation registry.
 *
 * Every cache tag has a version counter. Screens read the sum of the versions of
 * the tags they depend on (their "stamp") and refetch only when that sum moves.
 * The socket bumps tags when the server reports a change, so data stays live
 * without any screen polling on mount/focus.
 *
 * `epoch` is a global bump added to every stamp. It exists for reconnects:
 * `sync` events are fire-and-forget, so a device that was offline may have
 * missed some. Bumping the epoch on RE-connect invalidates everything at once,
 * which is the catch-up refetch the backend guide asks for.
 */
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

/** Thunk args are plain objects or a bare id string; read ids defensively. */
type WriteArg = { fieldId?: unknown; farmId?: unknown; id?: unknown };

const argOf = (action: FulfilledAction): WriteArg => {
  const arg = action.meta?.arg;
  return arg && typeof arg === 'object' ? (arg as WriteArg) : {};
};

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const FARM_SHAPE_TAGS = [Tags.farms, Tags.dashboard, Tags.enrollableFields];

const ENROLMENT_TAGS = [
  Tags.programs,
  Tags.enrollableFields,
  Tags.myAssessments,
  Tags.assessmentHistory,
  Tags.farms,
  Tags.dashboard,
];

const WRITE_INVALIDATIONS: Record<string, (arg: WriteArg) => string[]> = {
  'enrollment/enrollSelf': () => ENROLMENT_TAGS,
  'enrollment/unenrollField': () => ENROLMENT_TAGS,

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
};

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
    /** Catch-up after a reconnect: invalidate every cache at once. */
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
      // Local writes invalidate the same tags the socket would, so the user's
      // own device updates instantly and still behaves correctly when the
      // socket is down. Matched by action type so no thunk has to be imported
      // here (and no import cycle is possible).
      //
      // Assessment writes are deliberately absent: they already propagate
      // through `answerVersion` and `staleFarmIds`, and adding them here would
      // just double-fetch on the hottest path in the app.
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

/**
 * The stamp for a set of tags: the epoch plus each tag's version. Returns a
 * plain number so `useSelector` never sees a new reference and re-renders.
 */
export const selectTagStamp = (s: HasSync, tags: readonly string[]): number => {
  let stamp = s.sync.epoch;
  for (const tag of tags) {
    stamp += s.sync.tags[tag] ?? 0;
  }
  return stamp;
};
