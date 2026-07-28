/**
 * src/maps/boundary/hooks/useBoundaryDraft.ts — the engine as React state.
 *
 * A thin `useReducer` wrapper over the pure `boundaryReducer`, exposing bound
 * action dispatchers and memoised selectors (area, validation, canUndo…).
 * Components consume THIS, never the reducer directly, so the pure core stays
 * free of React.
 */

import { useCallback, useMemo, useReducer } from 'react';
import type { LatLng } from '../../types';
import { polygonAreaSqMeters } from '../../utils/geo';
import { boundaryReducer } from '../engine/boundaryReducer';
import { emptyDraft } from '../engine/boundaryActions';
import { validateRing } from '../engine/boundaryValidation';
import { MIN_VERTICES } from '../engine/boundaryConfig';
import type { BoundaryValidation, DraftBoundary } from '../types';

export interface UseBoundaryDraft {
  readonly draft: DraftBoundary;
  readonly ring: readonly LatLng[];
  readonly closed: boolean;
  readonly selected: number | null;
  readonly vertexCount: number;
  /** Live area in m² (0 until the ring is a valid simple polygon). */
  readonly areaSqM: number;
  readonly validation: BoundaryValidation;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly canClose: boolean;
  readonly canSave: boolean;

  // ── Actions (each geometry op is one undo step) ──
  readonly addVertex: (point: LatLng) => void;
  readonly moveVertex: (index: number, point: LatLng) => void;
  readonly insertVertex: (edgeIndex: number, point: LatLng) => void;
  readonly deleteVertex: (index: number) => void;
  readonly close: () => void;
  readonly select: (index: number | null) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly reset: () => void;
  readonly load: (ring: readonly LatLng[]) => void;
}

export const useBoundaryDraft = (initial: DraftBoundary = emptyDraft): UseBoundaryDraft => {
  const [draft, dispatch] = useReducer(boundaryReducer, initial);

  // Area only means something once the ring can be a polygon; validateRing
  // already guards simplicity, but the readout should update live during DRAW
  // too, so compute a best-effort area whenever there are ≥ 3 points.
  const areaSqM = useMemo(
    () => (draft.ring.length >= MIN_VERTICES ? polygonAreaSqMeters(draft.ring) : 0),
    [draft.ring],
  );

  const validation = useMemo(() => validateRing(draft.ring), [draft.ring]);

  const addVertex = useCallback((point: LatLng) => dispatch({ type: 'ADD_VERTEX', point }), []);
  const moveVertex = useCallback(
    (index: number, point: LatLng) => dispatch({ type: 'MOVE_VERTEX', index, point }),
    [],
  );
  const insertVertex = useCallback(
    (edgeIndex: number, point: LatLng) => dispatch({ type: 'INSERT_VERTEX', edgeIndex, point }),
    [],
  );
  const deleteVertex = useCallback((index: number) => dispatch({ type: 'DELETE_VERTEX', index }), []);
  const close = useCallback(() => dispatch({ type: 'CLOSE' }), []);
  const select = useCallback((index: number | null) => dispatch({ type: 'SELECT', index }), []);
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const load = useCallback((ring: readonly LatLng[]) => dispatch({ type: 'LOAD', ring }), []);

  return {
    draft,
    ring: draft.ring,
    closed: draft.closed,
    selected: draft.selected,
    vertexCount: draft.ring.length,
    areaSqM,
    validation,
    canUndo: draft.past.length > 0,
    canRedo: draft.future.length > 0,
    canClose: !draft.closed && draft.ring.length >= MIN_VERTICES,
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
  };
};
