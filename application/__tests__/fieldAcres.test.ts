import type { GeoJSONPolygon } from '../src/maps/boundary/types';
import {
  acresFromBoundary,
  acresFromRing,
  fitFieldInFarm,
  formatAcres,
} from '../src/maps/utils/fieldAcres';

const SPEC_BOUNDARY: GeoJSONPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [77.1, 28.1],
      [77.11, 28.1],
      [77.11, 28.11],
      [77.1, 28.11],
      [77.1, 28.1],
    ],
  ],
};

describe('acres from a drawn boundary', () => {
  it('matches the acres the server stores for the same outline', () => {
    expect(acresFromBoundary(SPEC_BOUNDARY)).toBe(270.11);
  });

  it('gives nothing until the outline has three points', () => {
    expect(acresFromRing(null)).toBeNull();
    expect(
      acresFromRing([
        { latitude: 28.1, longitude: 77.1 },
        { latitude: 28.1, longitude: 77.11 },
      ]),
    ).toBeNull();
    expect(acresFromBoundary(null)).toBeNull();
  });
});

describe('fitting a drawn field into its farm', () => {
  it('grows the farm to the sum of the fields when the outline is larger', () => {
    const fit = fitFieldInFarm({
      farmAcres: 200,
      usedAcres: 190,
      ownAcres: 0,
      fieldAcres: 270.11,
    });
    expect(fit).toEqual({
      grows: true,
      farmAcresBefore: 200,
      farmAcresAfter: 460.11,
      freeAcresBefore: 10,
      freeAcresAfter: 0,
    });
  });

  it('does not count the field it replaces twice when editing', () => {
    const fit = fitFieldInFarm({
      farmAcres: 200,
      usedAcres: 200,
      ownAcres: 200,
      fieldAcres: 12.5,
    });
    expect(fit).toEqual({
      grows: false,
      farmAcresBefore: 200,
      farmAcresAfter: 200,
      freeAcresBefore: 200,
      freeAcresAfter: 187.5,
    });
  });

  it('never shrinks the farm when the fields fit exactly', () => {
    const fit = fitFieldInFarm({ farmAcres: 100, usedAcres: 40, ownAcres: 0, fieldAcres: 60 });
    expect(fit.grows).toBe(false);
    expect(fit.farmAcresAfter).toBe(100);
    expect(fit.freeAcresAfter).toBe(0);
  });
});

describe('formatAcres', () => {
  it.each([
    [460.11, '460.11'],
    [200, '200'],
    [10.5, '10.5'],
    [1234567.891, '1,234,567.89'],
    [0.004, '0'],
  ])('formats %p as %p', (acres, expected) => {
    expect(formatAcres(acres)).toBe(expected);
  });
});
