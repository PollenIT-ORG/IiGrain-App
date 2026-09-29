import { boundaryReducer } from '../src/maps/boundary/engine/boundaryReducer';
import { emptyDraft } from '../src/maps/boundary/engine/boundaryActions';
import type { BoundaryAction } from '../src/maps/boundary/engine/boundaryActions';
import { validateRing } from '../src/maps/boundary/engine/boundaryValidation';
import {
  edgeMidpoints,
  midpointOf,
  toRing,
} from '../src/maps/boundary/engine/boundaryGeometry';
import {
  polygonAreaSqMeters,
  polygonPerimeterMeters,
  distanceMeters,
} from '../src/maps/utils/geo';
import type { DraftBoundary } from '../src/maps/boundary/types';
import type { LatLng } from '../src/maps/types';

const A: LatLng = { latitude: 10.0, longitude: 20.0 };
const B: LatLng = { latitude: 10.0, longitude: 20.001 };
const C: LatLng = { latitude: 9.999, longitude: 20.001 };
const D: LatLng = { latitude: 9.999, longitude: 20.0 };

const run = (draft: DraftBoundary, ...actions: BoundaryAction[]): DraftBoundary =>
  actions.reduce(boundaryReducer, draft);

const square = (): DraftBoundary =>
  run(
    emptyDraft,
    { type: 'ADD_VERTEX', point: A },
    { type: 'ADD_VERTEX', point: B },
    { type: 'ADD_VERTEX', point: C },
    { type: 'ADD_VERTEX', point: D },
    { type: 'CLOSE' },
  );

const coords = (draft: DraftBoundary): string[] =>
  draft.vertices.map(v => `${v.latitude},${v.longitude}`);

describe('boundary editor engine', () => {
  test('1 - basic drawing keeps tap order and is not self-crossing', () => {
    const draft = square();
    expect(draft.vertices).toHaveLength(4);
    expect(draft.closed).toBe(true);
    expect(coords(draft)).toEqual([
      '10,20',
      '10,20.001',
      '9.999,20.001',
      '9.999,20',
    ]);
    expect(validateRing(toRing(draft.vertices)).isSimple).toBe(true);
  });

  test('2 - moving a point moves only that point and keeps identity/order', () => {
    const before = square();
    const ids = before.vertices.map(v => v.id);
    const cId = ids[2];

    const after = run(before, {
      type: 'MOVE_VERTEX',
      id: cId,
      point: { latitude: 9.9992, longitude: 20.0011 },
    });

    expect(after.vertices.map(v => v.id)).toEqual(ids);
    expect(after.vertices[2]).toMatchObject({
      latitude: 9.9992,
      longitude: 20.0011,
    });
    expect(after.vertices[0]).toEqual(before.vertices[0]);
    expect(after.vertices[1]).toEqual(before.vertices[1]);
    expect(after.vertices[3]).toEqual(before.vertices[3]);
  });

  test('3 - tapping the B-C midpoint inserts between B and C', () => {
    const before = square();
    const midpoints = edgeMidpoints(before.vertices);
    const bc = midpoints[1];
    expect(bc.fromId).toBe(before.vertices[1].id);
    expect(bc.toId).toBe(before.vertices[2].id);

    const after = run(before, {
      type: 'INSERT_VERTEX',
      edgeIndex: bc.edgeIndex,
      point: bc.coordinate,
    });

    expect(after.vertices).toHaveLength(5);
    expect(after.vertices.map(v => v.id)).toEqual([
      before.vertices[0].id,
      before.vertices[1].id,
      after.vertices[2].id,
      before.vertices[2].id,
      before.vertices[3].id,
    ]);
    expect(after.vertices[2].id).not.toBe(before.vertices[2].id);
    expect(after.selectedId).toBe(after.vertices[2].id);
    expect(validateRing(toRing(after.vertices)).isSimple).toBe(true);
  });

  test('4 - tapping the closing D-A midpoint inserts between D and A', () => {
    const before = square();
    const midpoints = edgeMidpoints(before.vertices);
    const da = midpoints[3];
    expect(da.fromId).toBe(before.vertices[3].id);
    expect(da.toId).toBe(before.vertices[0].id);

    const after = run(before, {
      type: 'INSERT_VERTEX',
      edgeIndex: da.edgeIndex,
      point: da.coordinate,
    });

    expect(after.vertices).toHaveLength(5);
    expect(after.vertices.map(v => v.id)).toEqual([
      before.vertices[0].id,
      before.vertices[1].id,
      before.vertices[2].id,
      before.vertices[3].id,
      after.vertices[4].id,
    ]);
    const expected = midpointOf(D, A);
    expect(after.vertices[4].latitude).toBeCloseTo(expected.latitude, 6);
    expect(after.vertices[4].longitude).toBeCloseTo(expected.longitude, 6);
    expect(validateRing(toRing(after.vertices)).isSimple).toBe(true);
  });

  test('5 - deleting C leaves A-B-D', () => {
    const before = square();
    const withExtra = run(before, {
      type: 'INSERT_VERTEX',
      edgeIndex: 0,
      point: midpointOf(A, B),
    });
    const after = run(withExtra, {
      type: 'DELETE_VERTEX',
      id: before.vertices[2].id,
    });

    expect(after.vertices.map(v => v.id)).toEqual([
      withExtra.vertices[0].id,
      withExtra.vertices[1].id,
      withExtra.vertices[2].id,
      withExtra.vertices[4].id,
    ]);
    expect(after.selectedId).toBeNull();
  });

  test('6 - delete is refused at the three point minimum', () => {
    const before = square();
    const three = run(before, {
      type: 'DELETE_VERTEX',
      id: before.vertices[3].id,
    });
    expect(three.vertices).toHaveLength(3);

    const after = run(three, {
      type: 'DELETE_VERTEX',
      id: three.vertices[0].id,
    });
    expect(after.vertices).toHaveLength(3);
    expect(after.rejection?.code).toBe('min-vertices');
  });

  test('7 - a move that would cross an edge is refused and geometry is unchanged', () => {
    const before = square();
    const after = run(before, {
      type: 'MOVE_VERTEX',
      id: before.vertices[2].id,
      point: { latitude: 10.0005, longitude: 20.0005 },
    });

    expect(after.rejection?.code).toBe('crossing');
    expect(after.vertices).toEqual(before.vertices);
    expect(validateRing(toRing(after.vertices)).isSimple).toBe(true);
  });

  test('7b - drawing refuses a tap that would cross the path already drawn', () => {
    const path = run(
      emptyDraft,
      { type: 'ADD_VERTEX', point: A },
      { type: 'ADD_VERTEX', point: B },
      { type: 'ADD_VERTEX', point: C },
    );
    const crossing = run(path, {
      type: 'ADD_VERTEX',
      point: { latitude: 10.0005, longitude: 20.0005 },
    });

    expect(crossing.rejection?.code).toBe('crossing');
    expect(crossing.vertices).toHaveLength(3);
  });

  test('8 and 9 - undo restores the previous coordinates, redo restores the move', () => {
    const before = square();
    const cId = before.vertices[2].id;
    const moved = run(before, {
      type: 'MOVE_VERTEX',
      id: cId,
      point: { latitude: 9.9992, longitude: 20.0011 },
    });

    const undone = run(moved, { type: 'UNDO' });
    expect(undone.vertices).toEqual(before.vertices);

    const redone = run(undone, { type: 'REDO' });
    expect(redone.vertices).toEqual(moved.vertices);
  });

  test('8b - undo/redo walks the full add, insert, delete history', () => {
    const start = square();
    const inserted = run(start, {
      type: 'INSERT_VERTEX',
      edgeIndex: 1,
      point: midpointOf(B, C),
    });
    const deleted = run(inserted, {
      type: 'DELETE_VERTEX',
      id: inserted.vertices[2].id,
    });

    expect(deleted.vertices.map(v => v.id)).toEqual(start.vertices.map(v => v.id));

    const undo1 = run(deleted, { type: 'UNDO' });
    expect(undo1.vertices.map(v => v.id)).toEqual(inserted.vertices.map(v => v.id));

    const undo2 = run(undo1, { type: 'UNDO' });
    expect(undo2.vertices.map(v => v.id)).toEqual(start.vertices.map(v => v.id));

    const redo1 = run(undo2, { type: 'REDO' });
    expect(redo1.vertices.map(v => v.id)).toEqual(inserted.vertices.map(v => v.id));
  });

  test('10 - loading an existing boundary rebuilds vertices, ids and midpoints', () => {
    const loaded = run(emptyDraft, { type: 'LOAD', ring: [A, B, C, D] });

    expect(loaded.vertices).toHaveLength(4);
    expect(loaded.closed).toBe(true);
    expect(new Set(loaded.vertices.map(v => v.id)).size).toBe(4);
    expect(edgeMidpoints(loaded.vertices)).toHaveLength(4);
    expect(loaded.past).toHaveLength(0);
  });

  test('10b - loading a ring that repeats its first point drops the duplicate', () => {
    const loaded = run(emptyDraft, { type: 'LOAD', ring: [A, B, C, D, A] });
    expect(loaded.vertices).toHaveLength(4);
  });

  test('11 - area follows the geometry', () => {
    const before = square();
    const areaBefore = polygonAreaSqMeters(toRing(before.vertices));

    const after = run(before, {
      type: 'MOVE_VERTEX',
      id: before.vertices[2].id,
      point: { latitude: 9.998, longitude: 20.002 },
    });
    const areaAfter = polygonAreaSqMeters(toRing(after.vertices));

    expect(areaBefore).toBeGreaterThan(0);
    expect(areaAfter).toBeGreaterThan(areaBefore);
  });

  test('12 - perimeter includes the closing edge', () => {
    const ring = toRing(square().vertices);
    const open = polygonPerimeterMeters(ring, false);
    const closed = polygonPerimeterMeters(ring, true);

    expect(closed - open).toBeCloseTo(distanceMeters(D, A), 6);
    expect(closed).toBeGreaterThan(open);
  });

  test('nudges of one point collapse into a single undo step', () => {
    const before = square();
    const id = before.vertices[2].id;
    const key = `nudge:${id}`;

    const nudged = run(
      before,
      { type: 'MOVE_VERTEX', id, point: { latitude: 9.9991, longitude: 20.001 }, commitKey: key },
      { type: 'MOVE_VERTEX', id, point: { latitude: 9.9992, longitude: 20.001 }, commitKey: key },
      { type: 'MOVE_VERTEX', id, point: { latitude: 9.9993, longitude: 20.001 }, commitKey: key },
    );

    expect(nudged.past).toHaveLength(before.past.length + 1);
    const undone = run(nudged, { type: 'UNDO' });
    expect(undone.vertices).toEqual(before.vertices);
  });

  test('a point dropped on top of its neighbour is refused', () => {
    const before = square();
    const after = run(before, {
      type: 'MOVE_VERTEX',
      id: before.vertices[2].id,
      point: { latitude: 10.0, longitude: 20.001 },
    });

    expect(after.rejection?.code).toBe('too-close');
    expect(after.vertices).toEqual(before.vertices);
  });

  test('selection survives undo only while the point still exists', () => {
    const before = square();
    const selected = run(before, { type: 'SELECT', id: before.vertices[1].id });
    const deleted = run(selected, {
      type: 'DELETE_VERTEX',
      id: before.vertices[1].id,
    });
    expect(deleted.selectedId).toBeNull();

    const restored = run(
      run(deleted, { type: 'SELECT', id: before.vertices[0].id }),
      { type: 'UNDO' },
    );
    expect(restored.selectedId).toBe(before.vertices[0].id);
  });
});
