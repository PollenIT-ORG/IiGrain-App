jest.mock('../src/services/http', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn() },
}));

import http from '../src/services/http';
import { getFarmFields } from '../src/api/FieldApi';
import { backfillBoundaryAcresThunk } from '../src/redux/thunks/fieldThunks';

const mockedGet = http.get as jest.Mock;
const mockedPatch = http.patch as jest.Mock;

const OUTLINE = {
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

const rawField = (over: Record<string, unknown> = {}) => ({
  id: 'field-1',
  farm_id: 'farm-1',
  name: 'Gvggg',
  area_acres: null,
  crop: 'Wheat',
  boundary: OUTLINE,
  ...over,
});

const respondWith = (fields: unknown[]) =>
  mockedGet.mockResolvedValueOnce({ data: { data: { fields } } });

describe('acres for fields drawn before the server measured them', () => {
  beforeEach(() => mockedGet.mockReset());

  it('works out the acres from the outline when the server stored none', async () => {
    respondWith([rawField()]);
    const [field] = await getFarmFields('farm-1');
    expect(field.areaAcres).toBe(270.11);
    expect(field.areaFromOutline).toBe(true);
  });

  it('keeps the acres the server stored', async () => {
    respondWith([rawField({ area_acres: '2' })]);
    const [field] = await getFarmFields('farm-1');
    expect(field.areaAcres).toBe(2);
    expect(field.areaFromOutline).toBe(false);
  });

  it('shows zero when there is neither an outline nor stored acres', async () => {
    respondWith([rawField({ boundary: null })]);
    const [field] = await getFarmFields('farm-1');
    expect(field.areaAcres).toBe(0);
    expect(field.areaFromOutline).toBe(false);
  });
});

describe('backfillBoundaryAcresThunk', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPatch.mockReset();
  });

  const run = (farmId: string, fields: Awaited<ReturnType<typeof getFarmFields>>) => {
    const dispatch = jest.fn();
    const result = backfillBoundaryAcresThunk({ farmId, fields })(
      dispatch,
      () => ({}),
      undefined,
    );
    return { dispatch, result };
  };

  it('stores the outline acres on the server once and refreshes the farm', async () => {
    respondWith([rawField({ id: 'heal-1' })]);
    const fields = await getFarmFields('farm-1');
    mockedPatch.mockResolvedValue({
      data: { data: { field: { id: 'heal-1', area_acres: '270.11' } } },
    });

    const first = run('farm-1', fields);
    const action = await first.result;

    expect(mockedPatch).toHaveBeenCalledTimes(1);
    expect(mockedPatch.mock.calls[0][0]).toContain('heal-1');
    expect(mockedPatch.mock.calls[0][1]).toEqual({ areaAcres: 270.11 });
    expect(action.payload).toBe(1);
    expect(first.dispatch.mock.calls.some(([a]) => typeof a === 'function')).toBe(true);

    await run('farm-1', fields).result;
    expect(mockedPatch).toHaveBeenCalledTimes(1);
  });

  it('does nothing for fields whose acres the server already stored', async () => {
    respondWith([rawField({ id: 'stored-1', area_acres: '5' })]);
    const fields = await getFarmFields('farm-1');

    await run('farm-1', fields).result;

    expect(mockedPatch).not.toHaveBeenCalled();
  });

  it('does not refresh the farm when the server refuses the acres', async () => {
    respondWith([rawField({ id: 'refused-1' })]);
    const fields = await getFarmFields('farm-1');
    mockedPatch.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { message: 'Field area is too large.' } },
    });

    const refused = run('farm-1', fields);
    const action = await refused.result;

    expect(action.payload).toBe(0);
    expect(refused.dispatch.mock.calls.some(([a]) => typeof a === 'function')).toBe(false);
  });
});
