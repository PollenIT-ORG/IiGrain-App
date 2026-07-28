/**
 * src/maps/boundary/engine/boundaryReducer.ts — the pure heart of the module.
 *
 * `(draft, action) → draft`. No React, no map SDK, no Redux, no I/O. This is
 * deterministic and unit-testable with zero mocks — which is the entire reason
 * the geometry and edit logic live here rather than in a component.
 *
 * See docs/maps/FarmBoundary/DRAWING_ENGINE.md for the design this implements.
 */

import type { LatLng } from '../../types';
import { isSameSpot, roundCoordinate } from '../../utils/geo';
import { COORDINATE_PRECISION } from '../../config/mapDefaults';
import type { BoundarySnapshot, DraftBoundary } from '../types';
import { DUPLICATE_VERTEX_EPSILON, MIN_VERTICES, UNDO_LIMIT } from './boundaryConfig';
import type { BoundaryAction } from './boundaryActions';
import { emptyDraft } from './boundaryActions';

/** Round a point to storage precision the moment it enters the ring, so what is
 *  drawn equals what is stored (matches AppMapView's own rounding). */
const normalize = (point: LatLng): LatLng => ({
  latitude: roundCoordinate(point.latitude, COORDINATE_PRECISION),
  longitude: roundCoordinate(point.longitude, COORDINATE_PRECISION),
});

const snapshot = (draft: DraftBoundary): BoundarySnapshot => ({
  ring: draft.ring,
  closed: draft.closed,
});

/**
 * Commit a mutation: push the CURRENT state onto the undo stack (capped), clear
 * redo, and apply the change. Every geometry edit goes through here so undo is
 * uniform and nothing forgets to record history.
 */
const commit = (
  draft: DraftBoundary,
  next: Pick<DraftBoundary, 'ring' | 'closed'> & Partial<DraftBoundary>,
): DraftBoundary => {
  const past = [...draft.past, snapshot(draft)].slice(-UNDO_LIMIT);
  return {
    ring: next.ring,
    closed: next.closed,
    selected: next.selected ?? null,
    past,
    future: [],
  };
};

export const boundaryReducer = (
  draft: DraftBoundary,
  action: BoundaryAction,
): DraftBoundary => {
  switch (action.type) {
    case 'ADD_VERTEX': {
      // Ignore a tap coincident with the last vertex (double-tap guard).
      const last = draft.ring[draft.ring.length - 1];
      const point = normalize(action.point);
      if (last && isSameSpot(last, point, DUPLICATE_VERTEX_EPSILON)) {
        return draft;
      }
      // Adding after closing re-opens the ring (the user chose to keep drawing).
      return commit(draft, { ring: [...draft.ring, point], closed: false });
    }

    case 'MOVE_VERTEX': {
      if (!isIndex(draft.ring, action.index)) {
        return draft;
      }
      const ring = draft.ring.slice();
      ring[action.index] = normalize(action.point);
      return commit(draft, { ring, closed: draft.closed, selected: draft.selected });
    }

    case 'INSERT_VERTEX': {
      // Insert AFTER edgeIndex, i.e. between edgeIndex and edgeIndex+1.
      if (!isIndex(draft.ring, action.edgeIndex)) {
        return draft;
      }
      const ring = draft.ring.slice();
      ring.splice(action.edgeIndex + 1, 0, normalize(action.point));
      return commit(draft, {
        ring,
        closed: draft.closed,
        // Select the freshly inserted vertex so the user can immediately drag it.
        selected: action.edgeIndex + 1,
      });
    }

    case 'DELETE_VERTEX': {
      if (!isIndex(draft.ring, action.index)) {
        return draft;
      }
      // Refuse to drop below the minimum — the UI surfaces why.
      if (draft.ring.length <= MIN_VERTICES) {
        return draft;
      }
      const ring = draft.ring.filter((_, i) => i !== action.index);
      return commit(draft, { ring, closed: draft.closed, selected: null });
    }

    case 'CLOSE': {
      if (draft.closed || draft.ring.length < MIN_VERTICES) {
        return draft;
      }
      return commit(draft, { ring: draft.ring, closed: true });
    }

    case 'SELECT':
      // Pure UI state — not an undo step.
      return draft.selected === action.index
        ? draft
        : { ...draft, selected: action.index };

    case 'UNDO': {
      if (draft.past.length === 0) {
        return draft;
      }
      const previous = draft.past[draft.past.length - 1];
      return {
        ring: previous.ring,
        closed: previous.closed,
        selected: null,
        past: draft.past.slice(0, -1),
        future: [...draft.future, snapshot(draft)].slice(-UNDO_LIMIT),
      };
    }

    case 'REDO': {
      if (draft.future.length === 0) {
        return draft;
      }
      const next = draft.future[draft.future.length - 1];
      return {
        ring: next.ring,
        closed: next.closed,
        selected: null,
        past: [...draft.past, snapshot(draft)].slice(-UNDO_LIMIT),
        future: draft.future.slice(0, -1),
      };
    }

    case 'LOAD':
      // Loading a saved boundary is a fresh history root, not an undo step —
      // the user should not be able to "undo" past the state they opened.
      return {
        ring: action.ring.map(normalize),
        closed: true,
        selected: null,
        past: [],
        future: [],
      };

    case 'RESET':
      return emptyDraft;

    default:
      return draft;
  }
};

const isIndex = (ring: readonly LatLng[], index: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < ring.length;
