import { useCallback, useMemo, useReducer } from 'react';
import type { LatLng } from '../../types';
import { polygonAreaSqMeters, polygonPerimeterMeters } from '../../utils/geo';
import { boundaryReducer } from '../engine/boundaryReducer';
import { emptyDraft } from '../engine/boundaryActions';
import { crossingVertexIds, validateRing } from '../engine/boundaryValidation';
import { edgeMidpoints, toRing } from '../engine/boundaryGeometry';
import { MIN_VERTICES } from '../engine/boundaryConfig';
import type {
  BoundaryRejection,
  BoundaryValidation,
  BoundaryVertex,
  DraftBoundary,
  EdgeMidpoint,
} from '../types';

export interface UseBoundaryDraft {
  readonly draft: DraftBoundary;
  readonly vertices: readonly BoundaryVertex[];
  readonly ring: readonly LatLng[];
  readonly midpoints: readonly EdgeMidpoint[];
  readonly closed: boolean;
  readonly selectedId: string | null;
  readonly selectedIndex: number;
  readonly selectedVertex: BoundaryVertex | null;
  readonly vertexCount: number;
  readonly areaSqM: number;
  readonly perimeterM: number;
  readonly validation: BoundaryValidation;
  readonly crossingIds: ReadonlySet<string>;
  readonly rejection: BoundaryRejection | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly canClose: boolean;
  readonly canDelete: boolean;
  readonly canSave: boolean;

  readonly addVertex: (point: LatLng) => void;
  readonly moveVertex: (id: string, point: LatLng, commitKey?: string) => void;
  readonly insertVertex: (edgeIndex: number, point: LatLng) => void;
  readonly deleteVertex: (id: string) => void;
  readonly close: () => void;
  readonly select: (id: string | null) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly reset: () => void;
  readonly load: (ring: readonly LatLng[]) => void;
  readonly clearRejection: () => void;
}

export const useBoundaryDraft = (
  initial: DraftBoundary = emptyDraft,
): UseBoundaryDraft => {
  const [draft, dispatch] = useReducer(boundaryReducer, initial);

  const ring = useMemo(() => toRing(draft.vertices), [draft.vertices]);
  const midpoints = useMemo(() => edgeMidpoints(draft.vertices), [draft.vertices]);
  const validation = useMemo(() => validateRing(ring), [ring]);

  const areaSqM = useMemo(
    () => (ring.length >= MIN_VERTICES && validation.isSimple ? polygonAreaSqMeters(ring) : 0),
    [ring, validation.isSimple],
  );

  const perimeterM = useMemo(
    () => polygonPerimeterMeters(ring, ring.length >= MIN_VERTICES),
    [ring],
  );

  const crossingIds = useMemo(
    () => crossingVertexIds(draft.vertices, validation.selfIntersections),
    [draft.vertices, validation.selfIntersections],
  );

  const selectedIndex = useMemo(
    () =>
      draft.selectedId === null
        ? -1
        : draft.vertices.findIndex(v => v.id === draft.selectedId),
    [draft.vertices, draft.selectedId],
  );

  const addVertex = useCallback(
    (point: LatLng) => dispatch({ type: 'ADD_VERTEX', point }),
    [],
  );
  const moveVertex = useCallback(
    (id: string, point: LatLng, commitKey?: string) =>
      dispatch({ type: 'MOVE_VERTEX', id, point, commitKey }),
    [],
  );
  const insertVertex = useCallback(
    (edgeIndex: number, point: LatLng) =>
      dispatch({ type: 'INSERT_VERTEX', edgeIndex, point }),
    [],
  );
  const deleteVertex = useCallback(
    (id: string) => dispatch({ type: 'DELETE_VERTEX', id }),
    [],
  );
  const close = useCallback(() => dispatch({ type: 'CLOSE' }), []);
  const select = useCallback((id: string | null) => dispatch({ type: 'SELECT', id }), []);
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const load = useCallback(
    (next: readonly LatLng[]) => dispatch({ type: 'LOAD', ring: next }),
    [],
  );
  const clearRejection = useCallback(() => dispatch({ type: 'CLEAR_REJECTION' }), []);

  return {
    draft,
    vertices: draft.vertices,
    ring,
    midpoints,
    closed: draft.closed,
    selectedId: draft.selectedId,
    selectedIndex,
    selectedVertex: selectedIndex >= 0 ? draft.vertices[selectedIndex] : null,
    vertexCount: draft.vertices.length,
    areaSqM,
    perimeterM,
    validation,
    crossingIds,
    rejection: draft.rejection,
    canUndo: draft.past.length > 0,
    canRedo: draft.future.length > 0,
    canClose: !draft.closed && draft.vertices.length >= MIN_VERTICES,
    canDelete: draft.vertices.length > MIN_VERTICES,
    canSave: validation.isValid,
    addVertex,
    moveVertex,
    insertVertex,
    deleteVertex,
    close,
    select,
    undo,
    redo,
    reset,
    load,
    clearRejection,
  };
};
