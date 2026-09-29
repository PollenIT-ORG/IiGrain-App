/**
 * Screen-space vertex / midpoint handles drawn *above* the map.
 *
 * Why this exists instead of `<Marker>` children (VertexMarker / MidpointHandle):
 * on iOS, with the New Architecture and `PROVIDER_GOOGLE`, react-native-maps
 * never lays out `AIRGoogleMapMarker`, so the `GMSMarker.iconView` that carries
 * the React children keeps a zero frame — the handle is invisible, and being
 * zero-sized it is also un-tappable and un-draggable. Native `<Polygon>` and
 * `<Polyline>` are unaffected, which is why the shape shows but the points do
 * not. Android composes marker children into a bitmap itself and is fine, so it
 * keeps using the native markers (see `USE_OVERLAY_HANDLES`).
 *
 * This layer projects the ring to screen coordinates with the live map region
 * and renders plain RN views, so it behaves identically on both platforms and
 * gives us the hit-slop and drag semantics the native markers never had.
 *
 * The region arrives imperatively (`ref.setRegion`) rather than as a prop, so a
 * pan re-renders only this overlay and not the whole editor screen — the same
 * pattern as `BoundaryVectorOverlay`.
 */
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import AppText from '../../../components/AppText/AppText';
import { COLORS } from '../../../constants';
import { scale } from '../../../utils';
import { COORDINATE_PRECISION } from '../../config/mapDefaults';
import { roundCoordinate } from '../../utils/geo';
import {
  projectToScreen,
  unprojectFromScreen,
  type ScreenPoint,
  type ViewSize,
} from '../../utils/projection';
import type { LatLng, MapRegion } from '../../types';
import type { BoundaryVertex, EdgeMidpoint } from '../types';

/** Movement below this (points) is a tap, not a drag. */
const DRAG_SLOP = 4;

/** Handles this far outside the viewport are not worth mounting. */
const CULL_MARGIN = 120;

export interface BoundaryHandleLayerHandle {
  readonly setRegion: (region: MapRegion) => void;
}

export interface BoundaryHandleLayerProps {
  /** Vertices at the position they should be drawn at (drag already applied). */
  readonly vertices: readonly BoundaryVertex[];
  readonly midpoints: readonly EdgeMidpoint[];
  readonly initialRegion: MapRegion;
  readonly selectedId: string | null;
  readonly crossingIds: ReadonlySet<string>;
  /** True while drawing with enough points to close on the first vertex. */
  readonly snapToFirst: boolean;
  readonly showMidpoints: boolean;
  /** While an edge is being dragged: that edge only, at that point. */
  readonly activeEdgeIndex: number | null;
  readonly activeEdgePoint: LatLng | null;

  readonly onVertexPress: (id: string) => void;
  readonly onVertexDragStart: (id: string) => void;
  readonly onVertexDrag: (id: string, point: LatLng) => void;
  readonly onVertexDragEnd: (id: string, point: LatLng) => void;

  readonly onEdgePress: (edgeIndex: number, coordinate: LatLng) => void;
  readonly onEdgeDragStart: (edgeIndex: number, edgeKey: string) => void;
  readonly onEdgeDrag: (edgeIndex: number, point: LatLng) => void;
  readonly onEdgeDragEnd: (edgeIndex: number, point: LatLng) => void;

  /** Fires on grab / release so the screen can freeze the map while dragging. */
  readonly onDragActiveChange: (active: boolean) => void;
}

interface HandleProps {
  readonly x: number;
  readonly y: number;
  readonly hit: number;
  readonly zIndex: number;
  readonly onPress: () => void;
  readonly onDragStart: () => void;
  readonly onDragMove: (point: ScreenPoint) => void;
  readonly onDragEnd: (point: ScreenPoint) => void;
  readonly children: React.ReactNode;
}

/**
 * One draggable handle. The PanResponder is built once and reads the current
 * position and callbacks through refs, so a re-render mid-drag never swaps the
 * responder out from under the gesture.
 */
const Handle: React.FC<HandleProps> = ({
  x,
  y,
  hit,
  zIndex,
  onPress,
  onDragStart,
  onDragMove,
  onDragEnd,
  children,
}) => {
  const position = useRef<ScreenPoint>({ x, y });
  position.current = { x, y };

  const callbacks = useRef({ onPress, onDragStart, onDragMove, onDragEnd });
  callbacks.current = { onPress, onDragStart, onDragMove, onDragEnd };

  const grabbedAt = useRef<ScreenPoint>({ x, y });
  const dragging = useRef(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        // Never hand the gesture back — the map is underneath and would pan.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          grabbedAt.current = position.current;
          dragging.current = false;
        },
        onPanResponderMove: (_event, gesture) => {
          if (!dragging.current) {
            if (
              Math.abs(gesture.dx) < DRAG_SLOP &&
              Math.abs(gesture.dy) < DRAG_SLOP
            ) {
              return;
            }
            dragging.current = true;
            callbacks.current.onDragStart();
          }
          callbacks.current.onDragMove({
            x: grabbedAt.current.x + gesture.dx,
            y: grabbedAt.current.y + gesture.dy,
          });
        },
        onPanResponderRelease: (_event, gesture) => {
          if (dragging.current) {
            callbacks.current.onDragEnd({
              x: grabbedAt.current.x + gesture.dx,
              y: grabbedAt.current.y + gesture.dy,
            });
          } else {
            callbacks.current.onPress();
          }
          dragging.current = false;
        },
        onPanResponderTerminate: (_event, gesture) => {
          if (dragging.current) {
            callbacks.current.onDragEnd({
              x: grabbedAt.current.x + gesture.dx,
              y: grabbedAt.current.y + gesture.dy,
            });
          }
          dragging.current = false;
        },
      }),
    [],
  );

  return (
    <View
      {...responder.panHandlers}
      style={[
        styles.handle,
        { left: x - hit / 2, top: y - hit / 2, width: hit, height: hit, zIndex },
      ]}>
      {children}
    </View>
  );
};

const BoundaryHandleLayer = forwardRef<
  BoundaryHandleLayerHandle,
  BoundaryHandleLayerProps
>(
  (
    {
      vertices,
      midpoints,
      initialRegion,
      selectedId,
      crossingIds,
      snapToFirst,
      showMidpoints,
      activeEdgeIndex,
      activeEdgePoint,
      onVertexPress,
      onVertexDragStart,
      onVertexDrag,
      onVertexDragEnd,
      onEdgePress,
      onEdgeDragStart,
      onEdgeDrag,
      onEdgeDragEnd,
      onDragActiveChange,
    },
    ref,
  ) => {
    const [region, setRegion] = useState<MapRegion>(initialRegion);
    const [size, setSize] = useState<ViewSize | null>(null);

    useImperativeHandle(ref, () => ({ setRegion }), []);

    // The gesture callbacks run outside React's render, so they read the
    // projection through a ref rather than a closed-over prop.
    const frame = useRef<{ region: MapRegion; size: ViewSize | null }>({
      region: initialRegion,
      size: null,
    });
    frame.current = { region, size };

    const onLayout = useCallback((event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setSize(previous =>
        previous && previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    }, []);

    const toCoordinate = useCallback((point: ScreenPoint): LatLng | null => {
      const { region: currentRegion, size: currentSize } = frame.current;
      if (!currentSize || currentSize.width === 0 || currentSize.height === 0) {
        return null;
      }
      const coordinate = unprojectFromScreen(point, currentRegion, currentSize);
      return {
        latitude: roundCoordinate(coordinate.latitude, COORDINATE_PRECISION),
        longitude: roundCoordinate(coordinate.longitude, COORDINATE_PRECISION),
      };
    }, []);

    const visible = useCallback(
      (point: ScreenPoint): boolean =>
        !!size &&
        point.x > -CULL_MARGIN &&
        point.y > -CULL_MARGIN &&
        point.x < size.width + CULL_MARGIN &&
        point.y < size.height + CULL_MARGIN,
      [size],
    );

    if (!size || size.width === 0) {
      return <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout} />;
    }

    const midpointHandles = showMidpoints
      ? midpoints.filter(
          midpoint =>
            activeEdgeIndex === null || activeEdgeIndex === midpoint.edgeIndex,
        )
      : [];

    return (
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
        onLayout={onLayout}>
        {midpointHandles.map(midpoint => {
          const coordinate =
            activeEdgeIndex === midpoint.edgeIndex && activeEdgePoint
              ? activeEdgePoint
              : midpoint.coordinate;
          const point = projectToScreen(coordinate, region, size);
          if (!visible(point)) {
            return null;
          }
          return (
            <Handle
              key={`${midpoint.fromId}>${midpoint.toId}`}
              x={point.x}
              y={point.y}
              hit={MIDPOINT_HIT}
              zIndex={4}
              onPress={() => onEdgePress(midpoint.edgeIndex, midpoint.coordinate)}
              onDragStart={() => {
                onDragActiveChange(true);
                onEdgeDragStart(
                  midpoint.edgeIndex,
                  `${midpoint.fromId}>${midpoint.toId}`,
                );
              }}
              onDragMove={screenPoint => {
                const next = toCoordinate(screenPoint);
                if (next) {
                  onEdgeDrag(midpoint.edgeIndex, next);
                }
              }}
              onDragEnd={screenPoint => {
                const next = toCoordinate(screenPoint);
                onDragActiveChange(false);
                onEdgeDragEnd(
                  midpoint.edgeIndex,
                  next ?? midpoint.coordinate,
                );
              }}>
              <View style={styles.midpoint}>
                <View style={styles.plusH} />
                <View style={styles.plusV} />
              </View>
            </Handle>
          );
        })}

        {vertices.map((vertex, index) => {
          const point = projectToScreen(vertex, region, size);
          if (!visible(point)) {
            return null;
          }
          const selected = selectedId === vertex.id;
          const isFirst = index === 0;
          const snapTarget = snapToFirst && isFirst;
          const invalid = crossingIds.has(vertex.id);
          return (
            <Handle
              key={vertex.id}
              x={point.x}
              y={point.y}
              hit={VERTEX_HIT}
              zIndex={selected || snapTarget ? 9 : 7}
              onPress={() => onVertexPress(vertex.id)}
              onDragStart={() => {
                onDragActiveChange(true);
                onVertexDragStart(vertex.id);
              }}
              onDragMove={screenPoint => {
                const next = toCoordinate(screenPoint);
                if (next) {
                  onVertexDrag(vertex.id, next);
                }
              }}
              onDragEnd={screenPoint => {
                const next = toCoordinate(screenPoint);
                onDragActiveChange(false);
                onVertexDragEnd(vertex.id, next ?? vertex);
              }}>
              {selected || snapTarget ? (
                <View
                  style={[
                    styles.halo,
                    snapTarget && styles.haloSnap,
                    invalid && styles.haloDanger,
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.dot,
                  isFirst && styles.dotFirst,
                  selected && styles.dotSelected,
                  snapTarget && styles.dotSnap,
                  invalid && styles.dotDanger,
                ]}>
                <AppText style={styles.label}>{index + 1}</AppText>
              </View>
            </Handle>
          );
        })}
      </View>
    );
  },
);

BoundaryHandleLayer.displayName = 'BoundaryHandleLayer';

export default React.memo(BoundaryHandleLayer);

const VERTEX_HIT = scale(48);
const MIDPOINT_HIT = scale(40);
const DOT = scale(26);
const DOT_SELECTED = scale(34);
const MIDPOINT = scale(20);

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: VERTEX_HIT,
    height: VERTEX_HIT,
    borderRadius: VERTEX_HIT / 2,
    backgroundColor: 'rgba(19,106,203,0.22)',
    borderWidth: 2,
    borderColor: COLORS.infoBlue,
  },
  haloSnap: {
    backgroundColor: 'rgba(22,122,69,0.25)',
    borderColor: COLORS.primary,
  },
  haloDanger: {
    backgroundColor: 'rgba(229,72,77,0.22)',
    borderColor: COLORS.danger,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: COLORS.primary,
    borderWidth: 2.5,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFirst: { backgroundColor: COLORS.primaryDark },
  dotSelected: {
    width: DOT_SELECTED,
    height: DOT_SELECTED,
    borderRadius: DOT_SELECTED / 2,
    backgroundColor: COLORS.infoBlue,
    borderWidth: 3,
  },
  dotSnap: { backgroundColor: COLORS.primary, borderWidth: 3 },
  dotDanger: { backgroundColor: COLORS.danger },
  label: {
    fontSize: scale(11),
    lineHeight: scale(14),
    fontWeight: '700',
    color: COLORS.white,
  },
  midpoint: {
    width: MIDPOINT,
    height: MIDPOINT,
    borderRadius: MIDPOINT / 2,
    backgroundColor: COLORS.validation,
    borderWidth: 2,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusH: {
    position: 'absolute',
    width: scale(9),
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.white,
  },
  plusV: {
    position: 'absolute',
    width: 2,
    height: scale(9),
    borderRadius: 1,
    backgroundColor: COLORS.white,
  },
});
