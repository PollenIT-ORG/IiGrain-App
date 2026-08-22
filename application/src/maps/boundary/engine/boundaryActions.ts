import type { LatLng } from '../../types';
import type { DraftBoundary } from '../types';

export type BoundaryAction =
  | { type: 'ADD_VERTEX'; point: LatLng }
  | { type: 'MOVE_VERTEX'; id: string; point: LatLng; commitKey?: string }
  | { type: 'INSERT_VERTEX'; edgeIndex: number; point: LatLng }
  | { type: 'DELETE_VERTEX'; id: string }
  | { type: 'CLOSE' }
  | { type: 'SELECT'; id: string | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' }
  | { type: 'LOAD'; ring: readonly LatLng[] }
  | { type: 'CLEAR_REJECTION' };

export const emptyDraft: DraftBoundary = {
  vertices: [],
  closed: false,
  selectedId: null,
  past: [],
  future: [],
  commitKey: null,
  rejection: null,
};
