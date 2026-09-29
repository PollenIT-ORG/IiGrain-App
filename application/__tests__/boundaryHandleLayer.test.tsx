/**
 * The iOS handle overlay converts between the ring and screen points itself
 * (the native markers used to do it), so the projection round-trip and the
 * placement of each handle are what keep a drag landing where the finger is.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  projectToScreen,
  unprojectFromScreen,
  type ViewSize,
} from '../src/maps/utils/projection';
import BoundaryHandleLayer from '../src/maps/boundary/components/BoundaryHandleLayer';
import { edgeMidpoints } from '../src/maps/boundary/engine/boundaryGeometry';
import { distanceMeters } from '../src/maps/utils/geo';
import type { LatLng, MapRegion } from '../src/maps/types';
import type { BoundaryVertex } from '../src/maps/boundary/types';

const SIZE: ViewSize = { width: 390, height: 720 };

// A ~zoom-18 viewport over Indian farmland, the editor's working scale.
const REGION: MapRegion = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.0015,
  longitudeDelta: 0.0008,
};

const VERTICES: BoundaryVertex[] = [
  { id: 'a', latitude: 28.6142, longitude: 77.2086 },
  { id: 'b', latitude: 28.6142, longitude: 77.2094 },
  { id: 'c', latitude: 28.6136, longitude: 77.2094 },
  { id: 'd', latitude: 28.6136, longitude: 77.2086 },
];

describe('screen projection', () => {
  test('1 - the region centre lands in the middle of the view', () => {
    const point = projectToScreen(REGION, REGION, SIZE);
    expect(point.x).toBeCloseTo(SIZE.width / 2, 6);
    expect(point.y).toBeCloseTo(SIZE.height / 2, 6);
  });

  test('2 - the corners of the region map to the corners of the view', () => {
    const northWest: LatLng = {
      latitude: REGION.latitude + REGION.latitudeDelta / 2,
      longitude: REGION.longitude - REGION.longitudeDelta / 2,
    };
    const point = projectToScreen(northWest, REGION, SIZE);
    expect(point.x).toBeCloseTo(0, 6);
    expect(point.y).toBeCloseTo(0, 6);
  });

  test('3 - unproject inverts project for every vertex', () => {
    VERTICES.forEach(vertex => {
      const back = unprojectFromScreen(
        projectToScreen(vertex, REGION, SIZE),
        REGION,
        SIZE,
      );
      // Within a millimetre — far below the 6-dp (~11 cm) storage precision.
      expect(distanceMeters(vertex, back)).toBeLessThan(0.001);
    });
  });

  test('4 - a drag of N points moves the vertex by the ground distance N points cover', () => {
    const vertex = VERTICES[0];
    const start = projectToScreen(vertex, REGION, SIZE);
    const dragged = unprojectFromScreen(
      { x: start.x + 60, y: start.y },
      REGION,
      SIZE,
    );

    const metresPerPointEastWest =
      (distanceMeters(
        { latitude: REGION.latitude, longitude: REGION.longitude - REGION.longitudeDelta / 2 },
        { latitude: REGION.latitude, longitude: REGION.longitude + REGION.longitudeDelta / 2 },
      ) /
        SIZE.width);

    expect(distanceMeters(vertex, dragged)).toBeCloseTo(
      metresPerPointEastWest * 60,
      1,
    );
    // East is +x, so longitude must increase and latitude hold.
    expect(dragged.longitude).toBeGreaterThan(vertex.longitude);
    expect(dragged.latitude).toBeCloseTo(vertex.latitude, 6);
  });
});

describe('BoundaryHandleLayer', () => {
  const noop = () => {};

  const render = (props: Partial<React.ComponentProps<typeof BoundaryHandleLayer>> = {}) => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <BoundaryHandleLayer
          vertices={VERTICES}
          midpoints={edgeMidpoints(VERTICES)}
          initialRegion={REGION}
          selectedId={null}
          crossingIds={new Set()}
          snapToFirst={false}
          showMidpoints
          activeEdgeIndex={null}
          activeEdgePoint={null}
          onVertexPress={noop}
          onVertexDragStart={noop}
          onVertexDrag={noop}
          onVertexDragEnd={noop}
          onEdgePress={noop}
          onEdgeDragStart={noop}
          onEdgeDrag={noop}
          onEdgeDragEnd={noop}
          onDragActiveChange={noop}
          {...props}
        />,
      );
    });
    // Nothing can be placed before the overlay knows how big it is.
    act(() => {
      tree.root.findAllByProps({ pointerEvents: 'box-none' })[0].props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, ...SIZE } },
      });
    });
    return tree;
  };

  /** Absolutely-positioned handles, in mount order. */
  const handles = (tree: TestRenderer.ReactTestRenderer) =>
    tree.root
      .findAllByType('View' as never)
      .map(node => node.props.style)
      .map(style => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style))
      // A handle is the only absolutely-positioned box that carries a zIndex;
      // the container fills the map and the glyphs inside a handle do not.
      .filter(
        style =>
          style &&
          style.position === 'absolute' &&
          typeof style.left === 'number' &&
          typeof style.zIndex === 'number',
      );

  test('5 - every vertex and every edge midpoint gets a handle', () => {
    const tree = render();
    expect(handles(tree)).toHaveLength(VERTICES.length * 2);
    act(() => tree.unmount());
  });

  test('6 - a handle is centred on its projected coordinate', () => {
    const tree = render();
    const expected = projectToScreen(VERTICES[0], REGION, SIZE);
    const placed = handles(tree).map(style => ({
      x: style.left + style.width / 2,
      y: style.top + style.height / 2,
    }));
    expect(
      placed.some(
        point =>
          Math.abs(point.x - expected.x) < 0.01 &&
          Math.abs(point.y - expected.y) < 0.01,
      ),
    ).toBe(true);
    act(() => tree.unmount());
  });

  test('7 - handles follow the map when the region changes', () => {
    const ref = React.createRef<{ setRegion: (region: MapRegion) => void }>();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <BoundaryHandleLayer
          ref={ref}
          vertices={VERTICES}
          midpoints={[]}
          initialRegion={REGION}
          selectedId={null}
          crossingIds={new Set()}
          snapToFirst={false}
          showMidpoints={false}
          activeEdgeIndex={null}
          activeEdgePoint={null}
          onVertexPress={noop}
          onVertexDragStart={noop}
          onVertexDrag={noop}
          onVertexDragEnd={noop}
          onEdgePress={noop}
          onEdgeDragStart={noop}
          onEdgeDrag={noop}
          onEdgeDragEnd={noop}
          onDragActiveChange={noop}
        />,
      );
    });
    act(() => {
      tree.root.findAllByProps({ pointerEvents: 'box-none' })[0].props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, ...SIZE } },
      });
    });
    const before = handles(tree).map(style => style.top);

    // Pan north: the ground stays put, so every handle must move down-screen.
    const panned: MapRegion = { ...REGION, latitude: REGION.latitude + 0.0003 };
    act(() => ref.current?.setRegion(panned));
    const after = handles(tree).map(style => style.top);

    expect(after).toHaveLength(before.length);
    after.forEach((top, index) => expect(top).toBeGreaterThan(before[index]));
    act(() => tree.unmount());
  });

  test('8 - only the dragged edge keeps a midpoint, and it sits at the drag point', () => {
    const dragPoint: LatLng = { latitude: 28.6141, longitude: 77.2091 };
    const tree = render({ activeEdgeIndex: 0, activeEdgePoint: dragPoint });
    const placed = handles(tree);
    // 4 vertices + the one live midpoint.
    expect(placed).toHaveLength(VERTICES.length + 1);

    const expected = projectToScreen(dragPoint, REGION, SIZE);
    expect(
      placed.some(
        style =>
          Math.abs(style.left + style.width / 2 - expected.x) < 0.01 &&
          Math.abs(style.top + style.height / 2 - expected.y) < 0.01,
      ),
    ).toBe(true);
    act(() => tree.unmount());
  });

  /**
   * Drives a handle through React Native's real responder plumbing, so the
   * tap-vs-drag rule and the screen -> coordinate conversion are exercised the
   * way a finger exercises them.
   */
  const touchAt = (
    start: { x: number; y: number },
    previous: { x: number; y: number },
    current: { x: number; y: number },
    timeStamp: number,
  ) => ({
    touchBank: [
      undefined,
      {
        touchActive: true,
        startPageX: start.x,
        startPageY: start.y,
        startTimeStamp: 0,
        currentPageX: current.x,
        currentPageY: current.y,
        currentTimeStamp: timeStamp,
        previousPageX: previous.x,
        previousPageY: previous.y,
        previousTimeStamp: Math.max(0, timeStamp - 16),
      },
    ],
    numberActiveTouches: 1,
    indexOfSingleActiveTouch: 1,
    mostRecentTimeStamp: timeStamp,
  });

  const event = (touchHistory: ReturnType<typeof touchAt>) => ({
    nativeEvent: { touches: [{ identifier: 1 }] },
    touchHistory,
  });

  const firstHandleHandlers = (tree: TestRenderer.ReactTestRenderer) =>
    tree.root.findAll(node => typeof node.props.onResponderGrant === 'function', {
      deep: true,
    })[0].props;

  /** Move the finger from the grab point by (dx, dy) and let go. */
  const gesture = (
    tree: TestRenderer.ReactTestRenderer,
    grab: { x: number; y: number },
    dx: number,
    dy: number,
  ) => {
    const handlers = firstHandleHandlers(tree);
    const moved = { x: grab.x + dx, y: grab.y + dy };
    act(() => {
      handlers.onStartShouldSetResponderCapture(event(touchAt(grab, grab, grab, 0)));
      handlers.onResponderGrant(event(touchAt(grab, grab, grab, 0)));
      handlers.onResponderMove(event(touchAt(grab, grab, moved, 16)));
      handlers.onResponderRelease(event(touchAt(grab, moved, moved, 16)));
    });
  };

  test('9 - a touch that does not travel is a tap, not a drag', () => {
    const onVertexPress = jest.fn();
    const onVertexDragStart = jest.fn();
    const onVertexDragEnd = jest.fn();
    const tree = render({
      midpoints: [],
      showMidpoints: false,
      onVertexPress,
      onVertexDragStart,
      onVertexDragEnd,
    });

    gesture(tree, projectToScreen(VERTICES[0], REGION, SIZE), 2, -1);

    expect(onVertexPress).toHaveBeenCalledWith('a');
    expect(onVertexDragStart).not.toHaveBeenCalled();
    expect(onVertexDragEnd).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  test('10 - a drag reports the coordinate under the finger and freezes the map', () => {
    const onVertexPress = jest.fn();
    const onVertexDragStart = jest.fn();
    const onVertexDrag = jest.fn();
    const onVertexDragEnd = jest.fn();
    const onDragActiveChange = jest.fn();
    const tree = render({
      midpoints: [],
      showMidpoints: false,
      onVertexPress,
      onVertexDragStart,
      onVertexDrag,
      onVertexDragEnd,
      onDragActiveChange,
    });

    const grab = projectToScreen(VERTICES[0], REGION, SIZE);
    gesture(tree, grab, 60, 40);

    expect(onVertexDragStart).toHaveBeenCalledWith('a');
    expect(onVertexPress).not.toHaveBeenCalled();
    // Grabbed, then released: the map is unfrozen again.
    expect(onDragActiveChange.mock.calls).toEqual([[true], [false]]);

    const expected = unprojectFromScreen(
      { x: grab.x + 60, y: grab.y + 40 },
      REGION,
      SIZE,
    );
    const [id, dropped] = onVertexDragEnd.mock.calls[0];
    expect(id).toBe('a');
    expect(distanceMeters(dropped, expected)).toBeLessThan(0.2);
    // Dragged east and south.
    expect(dropped.longitude).toBeGreaterThan(VERTICES[0].longitude);
    expect(dropped.latitude).toBeLessThan(VERTICES[0].latitude);
    act(() => tree.unmount());
  });
});
