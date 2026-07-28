/**
 * src/maps/boundary/engine/boundaryActions.ts — the engine's action vocabulary.
 *
 * Separated from the reducer so the action shape is a stable contract the hooks
 * and (future) GPS-walk feed can target. Every mutating action becomes one
 * undo step (except `select`, which is pure UI state).
 */

import type { LatLng } from '../../types';
import type { DraftBoundary } from '../types';

export type BoundaryAction =
  /** DRAW: append a vertex at a tapped/crosshair point. */
  | { type: 'ADD_VERTEX'; point: LatLng }
  /** EDIT: replace vertex `index` with a new position (drag release). */
  | { type: 'MOVE_VERTEX'; index: number; point: LatLng }
  /** EDIT: insert a vertex after `edgeIndex` (splitting that edge). */
  | { type: 'INSERT_VERTEX'; edgeIndex: number; point: LatLng }
  /** EDIT: remove vertex `index`. No-op if it would drop below the minimum. */
  | { type: 'DELETE_VERTEX'; index: number }
  /** DRAW → EDIT: finish the ring. */
  | { type: 'CLOSE' }
  /** Select/deselect a vertex (UI only, not undoable). */
  | { type: 'SELECT'; index: number | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  /** Discard everything and start empty. */
  | { type: 'RESET' }
  /** Load an existing committed ring into the draft for editing. */
  | { type: 'LOAD'; ring: readonly LatLng[] };

/** The empty draft — the engine's initial state. */
export const emptyDraft: DraftBoundary = {
  ring: [],
  closed: false,
  selected: null,
  past: [],
  future: [],
};
