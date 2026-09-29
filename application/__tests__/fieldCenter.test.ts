import { coordinatesKey, resolveFieldCenter } from '../src/maps/utils/fieldCenter';

const FIELD = { latitude: 22.802661, longitude: 76.462534 };
const FARM = { latitude: 19.776879, longitude: 78.962897 };

describe('resolveFieldCenter', () => {
  it('opens the map on the field the user picked', () => {
    expect(resolveFieldCenter(FIELD, FARM)).toEqual(FIELD);
  });

  it('prefers the coordinates handed over on the route', () => {
    expect(resolveFieldCenter(FIELD, { latitude: 1, longitude: 1 })).toEqual(FIELD);
  });

  it('falls back to the farm when the field has no coordinates', () => {
    expect(resolveFieldCenter(null, { latitude: null, longitude: null }, FARM)).toEqual(
      FARM,
    );
  });

  it('never returns a half coordinate', () => {
    expect(resolveFieldCenter({ latitude: 22.8, longitude: null })).toBeNull();
    expect(resolveFieldCenter({ latitude: null, longitude: 76.4 })).toBeNull();
  });

  it('rejects values that are not real numbers', () => {
    expect(resolveFieldCenter({ latitude: NaN, longitude: 76.4 })).toBeNull();
    expect(
      resolveFieldCenter({ latitude: Infinity, longitude: Infinity }, FARM),
    ).toEqual(FARM);
  });

  it('returns null when nothing knows where the field is', () => {
    expect(resolveFieldCenter(null, undefined, {})).toBeNull();
  });

  it('treats the equator and prime meridian as real coordinates', () => {
    expect(resolveFieldCenter({ latitude: 0, longitude: 0 }, FARM)).toEqual({
      latitude: 0,
      longitude: 0,
    });
  });
});

describe('coordinatesKey', () => {
  const RING_A = [
    { latitude: 22.973966, longitude: 76.038368 },
    { latitude: 22.974611, longitude: 76.038469 },
    { latitude: 22.974562, longitude: 76.039256 },
  ];
  const RING_B = [
    { latitude: 19.776879, longitude: 78.962897 },
    { latitude: 19.777123, longitude: 78.963001 },
    { latitude: 19.777456, longitude: 78.963402 },
  ];

  it('is stable for the same place, so a map does not re-frame on every render', () => {
    expect(coordinatesKey(RING_A)).toBe(coordinatesKey([...RING_A]));
  });

  it('changes when the field changes, so the map follows instead of latching', () => {
    expect(coordinatesKey(RING_A)).not.toBe(coordinatesKey(RING_B));
  });

  it('notices a single moved vertex', () => {
    const moved = [...RING_A.slice(0, 2), { latitude: 22.9, longitude: 76.1 }];
    expect(coordinatesKey(RING_A)).not.toBe(coordinatesKey(moved));
  });

  it('distinguishes a swapped latitude and longitude', () => {
    expect(coordinatesKey([{ latitude: 22.9, longitude: 76.1 }])).not.toBe(
      coordinatesKey([{ latitude: 76.1, longitude: 22.9 }]),
    );
  });

  it('is empty when nothing has coordinates, so no frame is attempted', () => {
    expect(coordinatesKey([])).toBe('');
    expect(coordinatesKey([{ latitude: null, longitude: null }])).toBe('');
  });

  it('keeps a real point at the equator', () => {
    expect(coordinatesKey([{ latitude: 0, longitude: 0 }])).toBe('0.000000,0.000000');
  });
});
