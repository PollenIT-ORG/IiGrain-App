/**
 * react-native-maps 1.29's Fabric polygon on iOS rebuilds its path only when
 * the coordinate COUNT changes, so moving a vertex leaves the shape frozen.
 * `BoundaryPolygon` works around that by padding the ring so the length it
 * sends is never the length it sent last time. These tests pin that invariant —
 * if the padding ever stops changing the length, editing silently dies again.
 */
import React from 'react';
import { Platform } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import BoundaryPolygon from '../src/maps/boundary/components/BoundaryPolygon';
import type { LatLng } from '../src/maps/types';

const square: LatLng[] = [
  { latitude: 28.6142, longitude: 77.2086 },
  { latitude: 28.6142, longitude: 77.2094 },
  { latitude: 28.6136, longitude: 77.2094 },
  { latitude: 28.6136, longitude: 77.2086 },
];

const moved = (ring: LatLng[], index: number, by: number): LatLng[] =>
  ring.map((point, i) =>
    i === index ? { ...point, latitude: point.latitude + by } : point,
  );

/** The coordinates actually handed to the native polygon. */
const sentCoordinates = (tree: TestRenderer.ReactTestRenderer): LatLng[] =>
  tree.root.findAll(node => Array.isArray(node.props.coordinates), {
    deep: true,
  })[0].props.coordinates;

describe('BoundaryPolygon on iOS', () => {
  beforeAll(() => {
    Platform.OS = 'ios';
  });

  test('1 - a moved vertex changes the coordinate count the SDK sees', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<BoundaryPolygon ring={square} />);
    });

    const lengths: number[] = [sentCoordinates(tree).length];
    let ring = square;
    // Ten frames of a drag: the vertex moves, the ring length never does.
    for (let frame = 0; frame < 10; frame += 1) {
      ring = moved(ring, 1, 0.00002);
      const next = ring;
      act(() => tree.update(<BoundaryPolygon ring={next} />));
      lengths.push(sentCoordinates(tree).length);
    }

    lengths.forEach((length, index) => {
      if (index > 0) {
        expect(length).not.toBe(lengths[index - 1]);
      }
    });
    act(() => tree.unmount());
  });

  test('2 - the count still changes across an insert and a delete', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<BoundaryPolygon ring={square} />);
    });
    const lengths = [sentCoordinates(tree).length];

    // insert → move → delete → move: the ring length itself changes here, which
    // is exactly where a naive alternating pad collides with itself.
    const inserted = [...square, { latitude: 28.6139, longitude: 77.209 }];
    const nudged = moved(inserted, 4, 0.00002);
    const deleted = nudged.slice(0, 4);
    const nudgedAgain = moved(deleted, 0, 0.00002);

    [inserted, nudged, deleted, nudgedAgain].forEach(ring => {
      act(() => tree.update(<BoundaryPolygon ring={ring} />));
      lengths.push(sentCoordinates(tree).length);
    });

    lengths.forEach((length, index) => {
      if (index > 0) {
        expect(length).not.toBe(lengths[index - 1]);
      }
    });
    act(() => tree.unmount());
  });

  test('3 - the padding only repeats the last vertex, so the shape is unchanged', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<BoundaryPolygon ring={square} />);
    });
    const sent = sentCoordinates(tree);

    expect(sent.slice(0, square.length)).toEqual(square);
    sent.slice(square.length).forEach(extra => {
      expect(extra).toEqual(square[square.length - 1]);
    });
    act(() => tree.unmount());
  });

  test('4 - fewer than three points draws nothing', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<BoundaryPolygon ring={square.slice(0, 2)} />);
    });
    expect(tree.toJSON()).toBeNull();
    act(() => tree.unmount());
  });
});

describe('BoundaryPolygon on Android', () => {
  beforeAll(() => {
    Platform.OS = 'android';
  });
  afterAll(() => {
    Platform.OS = 'ios';
  });

  test('5 - the ring is passed through untouched', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<BoundaryPolygon ring={square} />);
    });
    expect(sentCoordinates(tree)).toEqual(square);

    const next = moved(square, 1, 0.00002);
    act(() => tree.update(<BoundaryPolygon ring={next} />));
    expect(sentCoordinates(tree)).toEqual(next);
    act(() => tree.unmount());
  });
});
