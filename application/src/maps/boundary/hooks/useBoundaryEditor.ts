import { useCallback, useMemo, useRef, useState } from 'react';
import type { AppMapHandle, LatLng, MapEdgePadding } from '../../types';
import {
  polygonAreaSqMeters,
  polygonPerimeterMeters,
  roundCoordinate,
} from '../../utils/geo';
import { COORDINATE_PRECISION } from '../../config/mapDefaults';
import { DRAG_FRAME_MS, MIN_VERTICES } from '../engine/boundaryConfig';
import {
  insertedVertexCreatesCrossing,
  longestEdgeIndex,
  midpointOf,
  movedVertexCreatesCrossing,
  nearestVertexIndex,
  offsetPoint,
  ringWithInserted,
  ringWithMoved,
  tooCloseToNeighbours,
} from '../engine/boundaryGeometry';
import type { BoundaryDrag, BoundaryMode } from '../types';
import { useBoundaryDraft, type UseBoundaryDraft } from './useBoundaryDraft';
import { useMapScale, type UseMapScale } from './useMapScale';

const FIT_PADDING: MapEdgePadding = { top: 190, right: 70, bottom: 300, left: 70 };

const samePoint = (a: LatLng, b: LatLng): boolean =>
  roundCoordinate(a.latitude, COORDINATE_PRECISION) ===
    roundCoordinate(b.latitude, COORDINATE_PRECISION) &&
  roundCoordinate(a.longitude, COORDINATE_PRECISION) ===
    roundCoordinate(b.longitude, COORDINATE_PRECISION);

export interface UseBoundaryEditorArgs {
  readonly camera: AppMapHandle;
}

export interface UseBoundaryEditor {
  readonly draft: UseBoundaryDraft;
  readonly scale: UseMapScale;

  readonly mode: BoundaryMode;
  readonly isDrawing: boolean;
  readonly isEditing: boolean;
  readonly isPlacing: boolean;
  readonly setMode: (mode: BoundaryMode) => void;

  readonly displayRing: readonly LatLng[];
  readonly liveAreaSqM: number;
  readonly livePerimeterM: number;

  readonly drag: BoundaryDrag | null;
  readonly dragBlocked: boolean;
  readonly markerKey: (id: string) => string;

  readonly onMapPress: (coordinate: LatLng) => void;
  readonly onVertexPress: (id: string) => void;
  readonly onVertexDragStart: (id: string) => void;
  readonly onVertexDrag: (id: string, point: LatLng) => void;
  readonly onVertexDragEnd: (id: string, point: LatLng) => void;
  readonly onEdgePress: (edgeIndex: number, coordinate: LatLng) => void;
  readonly onEdgeDragStart: (edgeIndex: number, edgeKey: string) => void;
  readonly onEdgeDrag: (edgeIndex: number, point: LatLng) => void;
  readonly onEdgeDragEnd: (edgeIndex: number, point: LatLng) => void;

  readonly nudgeSelected: (north: number, east: number) => void;
  readonly addPointOnLongestEdge: () => void;
  readonly deleteSelected: () => void;
  readonly fitToBoundary: () => void;
  readonly focusSelected: () => void;
}

export const useBoundaryEditor = ({
  camera,
}: UseBoundaryEditorArgs): UseBoundaryEditor => {
  const draft = useBoundaryDraft();
  const scale = useMapScale();

  const [mode, setMode] = useState<BoundaryMode>('view');
  const [drag, setDrag] = useState<BoundaryDrag | null>(null);
  const [restore, setRestore] = useState<{ id: string; seq: number } | null>(null);

  const lastFrameRef = useRef(0);
  const dragRef = useRef<BoundaryDrag | null>(null);
  const ringRef = useRef(draft.ring);
  ringRef.current = draft.ring;
  const closedRef = useRef(draft.closed);
  closedRef.current = draft.closed;

  const isDrawing = mode === 'draw';
  const isEditing = mode === 'edit';
  const isPlacing = isDrawing || isEditing;

  const displayRing = useMemo<readonly LatLng[]>(() => {
    if (!drag) {
      return draft.ring;
    }
    if (drag.kind === 'vertex') {
      return ringWithMoved(draft.ring, drag.index, drag.point);
    }
    return ringWithInserted(draft.ring, drag.edgeIndex, drag.point);
  }, [drag, draft.ring]);

  const liveAreaSqM = useMemo(
    () =>
      drag && displayRing.length >= MIN_VERTICES
        ? polygonAreaSqMeters(displayRing)
        : draft.areaSqM,
    [drag, displayRing, draft.areaSqM],
  );

  const livePerimeterM = useMemo(
    () =>
      drag
        ? polygonPerimeterMeters(displayRing, displayRing.length >= MIN_VERTICES)
        : draft.perimeterM,
    [drag, displayRing, draft.perimeterM],
  );

  const markerKey = useCallback(
    (id: string) => (restore && restore.id === id ? `${id}#${restore.seq}` : id),
    [restore],
  );

  const applyDrag = useCallback((next: BoundaryDrag | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const throttled = useCallback(() => {
    const now = Date.now();
    if (now - lastFrameRef.current < DRAG_FRAME_MS) {
      return true;
    }
    lastFrameRef.current = now;
    return false;
  }, []);

  const vertexMoveAllowed = useCallback((index: number, point: LatLng) => {
    const ring = ringRef.current;
    if (ring.length >= 3 && tooCloseToNeighbours(ring, index, point)) {
      return false;
    }
    return !movedVertexCreatesCrossing(ring, index, point, closedRef.current);
  }, []);

  const edgeInsertAllowed = useCallback(
    (edgeIndex: number, point: LatLng) =>
      !insertedVertexCreatesCrossing(
        ringRef.current,
        edgeIndex,
        point,
        closedRef.current,
      ),
    [],
  );

  const onMapPress = useCallback(
    (coordinate: LatLng) => {
      if (isDrawing) {
        const ring = ringRef.current;
        if (ring.length >= MIN_VERTICES) {
          const near = nearestVertexIndex(ring, coordinate, scale.snapMeters());
          if (near === 0) {
            draft.close();
            return;
          }
        }
        draft.addVertex(coordinate);
        return;
      }
      if (isEditing && draft.selectedId !== null) {
        draft.select(null);
      }
    },
    [isDrawing, isEditing, draft, scale],
  );

  const onVertexPress = useCallback(
    (id: string) => {
      if (isDrawing) {
        const index = draft.vertices.findIndex(v => v.id === id);
        if (index === 0 && draft.vertices.length >= MIN_VERTICES) {
          draft.close();
          return;
        }
      }
      draft.select(draft.selectedId === id ? null : id);
    },
    [isDrawing, draft],
  );

  const onVertexDragStart = useCallback(
    (id: string) => {
      const index = draft.vertices.findIndex(v => v.id === id);
      if (index < 0) {
        return;
      }
      lastFrameRef.current = 0;
      draft.select(id);
      applyDrag({
        kind: 'vertex',
        vertexId: id,
        index,
        point: draft.ring[index],
        blocked: false,
      });
    },
    [draft, applyDrag],
  );

  const onVertexDrag = useCallback(
    (id: string, point: LatLng) => {
      const current = dragRef.current;
      if (!current || current.kind !== 'vertex' || current.vertexId !== id) {
        return;
      }
      if (throttled()) {
        return;
      }
      if (!vertexMoveAllowed(current.index, point)) {
        if (!current.blocked) {
          applyDrag({ ...current, blocked: true });
        }
        return;
      }
      applyDrag({ ...current, point, blocked: false });
    },
    [throttled, vertexMoveAllowed, applyDrag],
  );

  const onVertexDragEnd = useCallback(
    (id: string, point: LatLng) => {
      const current = dragRef.current;
      applyDrag(null);

      const index = draft.vertices.findIndex(v => v.id === id);
      if (index < 0) {
        return;
      }
      const origin = draft.ring[index];
      const fallback =
        current && current.kind === 'vertex' && current.vertexId === id
          ? current.point
          : origin;
      const target = vertexMoveAllowed(index, point) ? point : fallback;

      if (!samePoint(target, point)) {
        setRestore(previous => ({ id, seq: (previous?.seq ?? 0) + 1 }));
      }
      if (!samePoint(target, origin)) {
        draft.moveVertex(id, target);
      }
    },
    [draft, vertexMoveAllowed, applyDrag],
  );

  const onEdgePress = useCallback(
    (edgeIndex: number, coordinate: LatLng) => {
      draft.insertVertex(edgeIndex, coordinate);
    },
    [draft],
  );

  const onEdgeDragStart = useCallback(
    (edgeIndex: number, edgeKey: string) => {
      const ring = ringRef.current;
      const from = ring[edgeIndex];
      const to = ring[(edgeIndex + 1) % ring.length];
      if (!from || !to) {
        return;
      }
      lastFrameRef.current = 0;
      applyDrag({
        kind: 'edge',
        edgeIndex,
        edgeKey,
        point: midpointOf(from, to),
        blocked: false,
      });
    },
    [applyDrag],
  );

  const onEdgeDrag = useCallback(
    (edgeIndex: number, point: LatLng) => {
      const current = dragRef.current;
      if (!current || current.kind !== 'edge' || current.edgeIndex !== edgeIndex) {
        return;
      }
      if (throttled()) {
        return;
      }
      if (!edgeInsertAllowed(edgeIndex, point)) {
        if (!current.blocked) {
          applyDrag({ ...current, blocked: true });
        }
        return;
      }
      applyDrag({ ...current, point, blocked: false });
    },
    [throttled, edgeInsertAllowed, applyDrag],
  );

  const onEdgeDragEnd = useCallback(
    (edgeIndex: number, point: LatLng) => {
      const current = dragRef.current;
      applyDrag(null);

      const fallback =
        current && current.kind === 'edge' && current.edgeIndex === edgeIndex
          ? current.point
          : null;
      const target = edgeInsertAllowed(edgeIndex, point) ? point : fallback;
      if (target) {
        draft.insertVertex(edgeIndex, target);
      }
    },
    [draft, edgeInsertAllowed, applyDrag],
  );

  const nudgeSelected = useCallback(
    (north: number, east: number) => {
      const vertex = draft.selectedVertex;
      if (!vertex) {
        return;
      }
      const step = scale.nudgeMeters();
      const next = offsetPoint(vertex, north * step, east * step);
      draft.moveVertex(vertex.id, next, `nudge:${vertex.id}`);
    },
    [draft, scale],
  );

  const addPointOnLongestEdge = useCallback(() => {
    const ring = ringRef.current;
    if (ring.length < MIN_VERTICES) {
      return;
    }
    const edgeIndex = longestEdgeIndex(ring);
    const point = midpointOf(ring[edgeIndex], ring[(edgeIndex + 1) % ring.length]);
    draft.insertVertex(edgeIndex, point);
  }, [draft]);

  const deleteSelected = useCallback(() => {
    if (draft.selectedId !== null) {
      draft.deleteVertex(draft.selectedId);
    }
  }, [draft]);

  const fitToBoundary = useCallback(() => {
    const ring = ringRef.current;
    if (ring.length === 0) {
      return;
    }
    camera.fitToCoordinates(ring, FIT_PADDING);
  }, [camera]);

  const focusSelected = useCallback(() => {
    const vertex = draft.selectedVertex;
    if (vertex) {
      camera.animateToCoordinate(vertex, 19);
    }
  }, [draft.selectedVertex, camera]);

  return {
    draft,
    scale,
    mode,
    isDrawing,
    isEditing,
    isPlacing,
    setMode,
    displayRing,
    liveAreaSqM,
    livePerimeterM,
    drag,
    dragBlocked: drag?.blocked ?? false,
    markerKey,
    onMapPress,
    onVertexPress,
    onVertexDragStart,
    onVertexDrag,
    onVertexDragEnd,
    onEdgePress,
    onEdgeDragStart,
    onEdgeDrag,
    onEdgeDragEnd,
    nudgeSelected,
    addPointOnLongestEdge,
    deleteSelected,
    fitToBoundary,
    focusSelected,
  };
};
