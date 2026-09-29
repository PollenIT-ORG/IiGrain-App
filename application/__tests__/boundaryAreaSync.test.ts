jest.mock('../src/services/http', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn(), patch: jest.fn() },
}));

import http from '../src/services/http';
import { createRemoteBoundaryRepository } from '../src/maps/boundary/services/remoteBoundaryRepository';
import type { FieldBoundary } from '../src/maps/boundary/types';
import fieldReducer, { fieldBoundarySaved } from '../src/redux/slices/fieldSlice';
import { fetchFarmFieldsThunk } from '../src/redux/thunks/fieldThunks';
import type { Field } from '../src/types/farm';

const mockedPut = http.put as jest.Mock;
const mockedPatch = http.patch as jest.Mock;

const RING = [
  { latitude: 28.1, longitude: 77.1 },
  { latitude: 28.1, longitude: 77.11 },
  { latitude: 28.11, longitude: 77.11 },
  { latitude: 28.11, longitude: 77.1 },
];

const makeRepo = (onServerSaved: jest.Mock) => {
  const rows = new Map<string, FieldBoundary>();
  return createRemoteBoundaryRepository({
    store: {
      read: id => rows.get(id) ?? null,
      write: boundary => {
        rows.set(boundary.fieldId, boundary);
      },
      delete: id => {
        rows.delete(id);
      },
    },
    now: () => '2026-09-15T00:00:00.000Z',
    farmIdForField: () => 'farm-1',
    onServerSaved,
  });
};

describe('boundary save reports the acres the server stored', () => {
  beforeEach(() => {
    mockedPut.mockReset();
    mockedPatch.mockReset();
  });

  it('stores the drawn acres itself when the server does not calculate them', async () => {
    mockedPut.mockResolvedValueOnce({
      data: { data: { field: { id: 'field-1', area_acres: null } } },
    });
    mockedPatch.mockResolvedValueOnce({
      data: { data: { field: { id: 'field-1', area_acres: '270.11' } } },
    });
    const onServerSaved = jest.fn();

    await makeRepo(onServerSaved).save({
      fieldId: 'field-1',
      farmId: 'farm-1',
      orgId: null,
      ring: RING,
    });

    expect(mockedPatch).toHaveBeenCalledTimes(1);
    expect(mockedPatch.mock.calls[0][1]).toEqual({ areaAcres: 270.11 });
    expect(onServerSaved).toHaveBeenCalledWith({
      farmId: 'farm-1',
      fieldId: 'field-1',
      areaAcres: 270.11,
      hasBoundary: true,
    });
  });

  it('replaces the old acres the server sends back for a redrawn outline', async () => {
    mockedPut.mockResolvedValueOnce({
      data: { data: { field: { id: 'field-1', area_acres: '120' } } },
    });
    mockedPatch.mockResolvedValueOnce({
      data: { data: { field: { id: 'field-1', area_acres: '270.11' } } },
    });
    const onServerSaved = jest.fn();

    await makeRepo(onServerSaved).save({
      fieldId: 'field-1',
      farmId: 'farm-1',
      orgId: null,
      ring: RING,
    });

    expect(mockedPatch).toHaveBeenCalledTimes(1);
    expect(mockedPatch.mock.calls[0][1]).toEqual({ areaAcres: 270.11 });
    expect(onServerSaved).toHaveBeenCalledWith({
      farmId: 'farm-1',
      fieldId: 'field-1',
      areaAcres: 270.11,
      hasBoundary: true,
    });
  });

  it('keeps the boundary saved even if storing the acres fails', async () => {
    mockedPut.mockResolvedValueOnce({
      data: { data: { field: { id: 'field-1', area_acres: null } } },
    });
    mockedPatch.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { message: 'Field area is too large.' } },
    });
    const onServerSaved = jest.fn();

    await makeRepo(onServerSaved).save({
      fieldId: 'field-1',
      farmId: 'farm-1',
      orgId: null,
      ring: RING,
    });

    expect(onServerSaved).toHaveBeenCalledWith({
      farmId: 'farm-1',
      fieldId: 'field-1',
      areaAcres: null,
      hasBoundary: true,
    });
  });

  it('passes on area_acres from the boundary response', async () => {
    mockedPut.mockResolvedValueOnce({
      data: { data: { field: { id: 'field-1', area_acres: '270.11' } } },
    });
    const onServerSaved = jest.fn();

    await makeRepo(onServerSaved).save({
      fieldId: 'field-1',
      farmId: 'farm-1',
      orgId: null,
      ring: RING,
    });

    expect(mockedPut.mock.calls[0][1]).toEqual({ boundary: expect.any(Object) });
    expect(mockedPatch).not.toHaveBeenCalled();
    expect(onServerSaved).toHaveBeenCalledWith({
      farmId: 'farm-1',
      fieldId: 'field-1',
      areaAcres: 270.11,
      hasBoundary: true,
    });
  });

  it('keeps the acres when the boundary is removed', async () => {
    mockedPut.mockResolvedValueOnce({
      data: { data: { field: { id: 'field-1', area_acres: '270.11', boundary: null } } },
    });
    const onServerSaved = jest.fn();

    await makeRepo(onServerSaved).remove('field-1');

    expect(mockedPut.mock.calls[0][1]).toEqual({ boundary: null });
    expect(onServerSaved).toHaveBeenCalledWith({
      farmId: 'farm-1',
      fieldId: 'field-1',
      areaAcres: 270.11,
      hasBoundary: false,
    });
  });

  it('does not report a save the server never received', async () => {
    mockedPut.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: { message: 'The boundary crosses itself. Redraw it so no edges cross.' },
      },
    });
    const onServerSaved = jest.fn();

    await expect(
      makeRepo(onServerSaved).save({
        fieldId: 'field-1',
        farmId: 'farm-1',
        orgId: null,
        ring: RING,
      }),
    ).rejects.toBeTruthy();
    expect(onServerSaved).not.toHaveBeenCalled();
  });
});

describe('fieldBoundarySaved', () => {
  const field = (over: Partial<Field> = {}): Field => ({
    id: 'field-1',
    farmId: 'farm-1',
    name: 'North',
    areaAcres: 200,
    crop: 'Wheat',
    season: '—',
    status: 'healthy',
    coordinates: '—',
    sowingDateISO: '',
    expectedHarvestISO: '',
    irrigation: '—',
    weather: '—',
    healthLabel: 'Healthy',
    hasBoundary: false,
    boundary: null,
    ...over,
  });

  const loaded = () =>
    fieldReducer(
      fieldReducer(undefined, fetchFarmFieldsThunk.pending('req-1', 'farm-1')),
      fetchFarmFieldsThunk.fulfilled(
        { farmId: 'farm-1', fields: [field(), field({ id: 'field-2', areaAcres: 190 })] },
        'req-1',
        'farm-1',
      ),
    );

  it('shows the server acres on the saved field only', () => {
    const next = fieldReducer(
      loaded(),
      fieldBoundarySaved({
        farmId: 'farm-1',
        fieldId: 'field-1',
        areaAcres: 270.11,
        hasBoundary: true,
      }),
    );
    expect(next.fields.map(f => [f.id, f.areaAcres, f.hasBoundary])).toEqual([
      ['field-1', 270.11, true],
      ['field-2', 190, false],
    ]);
    expect(next.fields[0].crop).toBe('Wheat');
  });

  it('keeps the current acres when the response has none', () => {
    const next = fieldReducer(
      loaded(),
      fieldBoundarySaved({
        farmId: 'farm-1',
        fieldId: 'field-1',
        areaAcres: null,
        hasBoundary: true,
      }),
    );
    expect(next.fields[0].areaAcres).toBe(200);
  });

  it('ignores a save for a farm that is not on screen', () => {
    const state = loaded();
    const next = fieldReducer(
      state,
      fieldBoundarySaved({
        farmId: 'farm-2',
        fieldId: 'field-1',
        areaAcres: 5,
        hasBoundary: true,
      }),
    );
    expect(next.fields).toBe(state.fields);
  });
});
