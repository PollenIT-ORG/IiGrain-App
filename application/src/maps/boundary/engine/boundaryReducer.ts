import type { LatLng } from '../../types';
import { distanceMeters, roundCoordinate } from '../../utils/geo';
import { COORDINATE_PRECISION } from '../../config/mapDefaults';
import type {
  BoundaryRejection,
  BoundaryRejectionCode,
  BoundarySnapshot,
  BoundaryVertex,
  DraftBoundary,
} from '../types';
import { MIN_EDGE_METERS, MIN_VERTICES, UNDO_LIMIT } from './boundaryConfig';
import type { BoundaryAction } from './boundaryActions';
import { emptyDraft } from './boundaryActions';
import { nextVertexId } from './boundaryIds';
import { BOUNDARY_REJECTION_MESSAGES } from './boundaryMessages';
import {
  appendCreatesCrossing,
  closingCreatesCrossing,
  deletedVertexCreatesCrossing,
  insertedVertexCreatesCrossing,
  movedVertexCreatesCrossing,
  toRing,
  tooCloseToNeighbours,
} from './boundaryGeometry';

let rejectionSeq = 0;

const reject = (
  draft: DraftBoundary,
  code: BoundaryRejectionCode,
): DraftBoundary => {
  rejectionSeq += 1;
  const rejection: BoundaryRejection = {
    seq: rejectionSeq,
    code,
    message: BOUNDARY_REJECTION_MESSAGES[code],
  };
  return { ...draft, rejection };
};

const normalize = (point: LatLng): LatLng => ({
  latitude: roundCoordinate(point.latitude, COORDINATE_PRECISION),
  longitude: roundCoordinate(point.longitude, COORDINATE_PRECISION),
});

const snapshot = (draft: DraftBoundary): BoundarySnapshot => ({
  vertices: draft.vertices,
  closed: draft.closed,
});

interface CommitOptions {
  readonly vertices: readonly BoundaryVertex[];
  readonly closed?: boolean;
  readonly selectedId?: string | null;
  readonly commitKey?: string | null;
}

const commit = (draft: DraftBoundary, next: CommitOptions): DraftBoundary => {
  const commitKey = next.commitKey ?? null;
  const coalesce = commitKey !== null && draft.commitKey === commitKey;
  const past = coalesce
    ? draft.past
    : [...draft.past, snapshot(draft)].slice(-UNDO_LIMIT);

  return {
    vertices: next.vertices,
    closed: next.closed ?? draft.closed,
    selectedId: next.selectedId !== undefined ? next.selectedId : draft.selectedId,
    past,
    future: [],
    commitKey,
    rejection: null,
  };
};

const restore = (
  draft: DraftBoundary,
  target: BoundarySnapshot,
  past: readonly BoundarySnapshot[],
  future: readonly BoundarySnapshot[],
): DraftBoundary => {
  const stillThere =
    draft.selectedId !== null &&
    target.vertices.some(v => v.id === draft.selectedId);
  return {
    vertices: target.vertices,
    closed: target.closed,
    selectedId: stillThere ? draft.selectedId : null,
    past,
    future,
    commitKey: null,
    rejection: null,
  };
};

const indexOfId = (
  vertices: readonly BoundaryVertex[],
  id: string,
): number => vertices.findIndex(v => v.id === id);

export const boundaryReducer = (
  draft: DraftBoundary,
  action: BoundaryAction,
): DraftBoundary => {
  switch (action.type) {
    case 'ADD_VERTEX': {
      const point = normalize(action.point);
      const ring = toRing(draft.vertices);
      const last = ring[ring.length - 1];
      if (last && distanceMeters(last, point) < MIN_EDGE_METERS) {
        return reject(draft, 'too-close');
      }
      if (appendCreatesCrossing(ring, point)) {
        return reject(draft, 'crossing');
      }
      const vertex: BoundaryVertex = { id: nextVertexId(), ...point };
      return commit(draft, {
        vertices: [...draft.vertices, vertex],
        closed: false,
        selectedId: null,
      });
    }

    case 'MOVE_VERTEX': {
      const index = indexOfId(draft.vertices, action.id);
      if (index < 0) {
        return draft;
      }
      const point = normalize(action.point);
      const ring = toRing(draft.vertices);
      const current = ring[index];
      if (current.latitude === point.latitude && current.longitude === point.longitude) {
        return draft;
      }
      if (draft.vertices.length >= 3 && tooCloseToNeighbours(ring, index, point)) {
        return reject(draft, 'too-close');
      }
      if (movedVertexCreatesCrossing(ring, index, point, draft.closed)) {
        return reject(draft, 'crossing');
      }
      const vertices = draft.vertices.slice();
      vertices[index] = { id: action.id, ...point };
      return commit(draft, {
        vertices,
        selectedId: draft.selectedId,
        commitKey: action.commitKey ?? null,
      });
    }

    case 'INSERT_VERTEX': {
      const n = draft.vertices.length;
      if (n < 3 || action.edgeIndex < 0 || action.edgeIndex >= n) {
        return draft;
      }
      const point = normalize(action.point);
      const ring = toRing(draft.vertices);
      if (insertedVertexCreatesCrossing(ring, action.edgeIndex, point, draft.closed)) {
        return reject(draft, 'crossing');
      }
      const vertex: BoundaryVertex = { id: nextVertexId(), ...point };
      const vertices = draft.vertices.slice();
      vertices.splice(action.edgeIndex + 1, 0, vertex);
      return commit(draft, { vertices, selectedId: vertex.id });
    }

    case 'DELETE_VERTEX': {
      const index = indexOfId(draft.vertices, action.id);
      if (index < 0) {
        return draft;
      }
      if (draft.vertices.length <= MIN_VERTICES) {
        return reject(draft, 'min-vertices');
      }
      const ring = toRing(draft.vertices);
      if (deletedVertexCreatesCrossing(ring, index)) {
        return reject(draft, 'crossing');
      }
      return commit(draft, {
        vertices: draft.vertices.filter(v => v.id !== action.id),
        selectedId: null,
      });
    }

    case 'CLOSE': {
      if (draft.closed) {
        return draft;
      }
      if (draft.vertices.length < MIN_VERTICES) {
        return reject(draft, 'not-closed');
      }
      if (closingCreatesCrossing(toRing(draft.vertices))) {
        return reject(draft, 'crossing');
      }
      return commit(draft, {
        vertices: draft.vertices,
        closed: true,
        selectedId: null,
      });
    }

    case 'SELECT':
      return draft.selectedId === action.id
        ? draft
        : { ...draft, selectedId: action.id, commitKey: null };

    case 'UNDO': {
      if (draft.past.length === 0) {
        return draft;
      }
      const previous = draft.past[draft.past.length - 1];
      return restore(
        draft,
        previous,
        draft.past.slice(0, -1),
        [...draft.future, snapshot(draft)].slice(-UNDO_LIMIT),
      );
    }

    case 'REDO': {
      if (draft.future.length === 0) {
        return draft;
      }
      const next = draft.future[draft.future.length - 1];
      return restore(
        draft,
        next,
        [...draft.past, snapshot(draft)].slice(-UNDO_LIMIT),
        draft.future.slice(0, -1),
      );
    }

    case 'LOAD': {
      const vertices: BoundaryVertex[] = [];
      for (const raw of action.ring) {
        const point = normalize(raw);
        const last = vertices[vertices.length - 1];
        if (last && distanceMeters(last, point) < MIN_EDGE_METERS) {
          continue;
        }
        vertices.push({ id: nextVertexId(), ...point });
      }
      const first = vertices[0];
      const last = vertices[vertices.length - 1];
      if (vertices.length > 3 && first && last && distanceMeters(first, last) < MIN_EDGE_METERS) {
        vertices.pop();
      }
      return {
        ...emptyDraft,
        vertices,
        closed: vertices.length >= MIN_VERTICES,
      };
    }

    case 'CLEAR_REJECTION':
      return draft.rejection === null ? draft : { ...draft, rejection: null };

    case 'RESET':
      return emptyDraft;

    default:
      return draft;
  }
};
