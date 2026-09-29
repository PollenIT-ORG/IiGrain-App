import { AxiosError } from 'axios';
import { open } from '@op-engineering/op-sqlite';
import { configureStore } from '@reduxjs/toolkit';
import {
  DATABASE_NAME,
  LATEST_SCHEMA_VERSION,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  getDatabase,
  initializeDatabase,
} from '../src/services/db';
import { upsertLocalUser } from '../src/repositories/userRepository';
import {
  PROGRAMS_SCOPE,
  clearSnapshots,
  readSnapshot,
  saveSnapshot,
  setSyncLogSink,
} from '../src/services/sync';
import {
  fetchDashboardProgramsThunk,
  fetchProgramDashboardThunk,
} from '../src/redux/slices/dashboardSlice';
import * as dashboardApi from '../src/api/dashboardApi';
import { describeAge } from '../src/components/StaleDataNote';
import type { DashboardPrograms, ProgramDashboard } from '../src/types/dashboard';

jest.mock('../src/api/dashboardApi', () => ({
  ...jest.requireActual('../src/api/dashboardApi'),
  getDashboardPrograms: jest.fn(),
  getProgramDashboard: jest.fn(),
}));

const OWNER_ID = 'farmer-dash';
const OWNER = asOwnerUserId(OWNER_ID);

const authReducer = () => ({ user: { id: OWNER_ID } });
const dashboardReducer = () => ({ dashboardLoading: false, requestedKey: null });

const makeStore = () =>
  configureStore({ reducer: { auth: authReducer, dashboard: dashboardReducer } });

const dispatch = (action: unknown) =>
  (makeStore().dispatch as unknown as (a: unknown) => Promise<{
    type: string;
    payload: unknown;
  }>)(action);

const offlineError = (): AxiosError => {
  const error = new AxiosError('Network Error', 'ERR_NETWORK');
  error.request = {};
  return error;
};

const programsPayload: DashboardPrograms = {
  programs: [
    {
      id: 'srv-program-1',
      name: 'Regenerative Wheat 2026',
      code: 'RW-001',
      startDateISO: '2026-07-01',
      endDateISO: '2026-12-31',
      status: 'active',
      fieldsEnrolled: 3,
      assessmentsCompleted: 1,
      assessmentsPending: 2,
    },
    {
      id: 'srv-program-2',
      name: 'Kharif Rice 2027',
      code: 'KR-002',
      startDateISO: '2027-01-15',
      endDateISO: null,
      status: 'scheduled',
      fieldsEnrolled: 1,
      assessmentsCompleted: 0,
      assessmentsPending: 1,
    },
  ],
  defaultProgramId: 'srv-program-1',
  meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
};

const dashboardPayload: ProgramDashboard = {
  program: {
    id: 'srv-program-1',
    name: 'Regenerative Wheat 2026',
    code: 'RW-001',
    startDateISO: '2026-07-01',
    endDateISO: '2026-12-31',
    status: 'active',
    fieldsEnrolled: 3,
    assessmentsCompleted: 1,
    assessmentsPending: 2,
  },
  year: 2026,
  availableYears: [2025, 2026],
  trend: [],
  regenHealthIndex: 72,
  rating: 'Good',
  trendVsLastYear: 4,
  categories: [
    { id: 'c1', name: 'Soil', score: 80, answered: 8, totalQuestions: 10 },
  ],
  upcoming: {
    hasUpcoming: false,
    nextAssessment: null,
    pendingCount: 0,
    programs: [],
  },
  recentActivity: [],
  summary: { assessmentsCompleted: 4, averageScore: 71, topCategory: 'Soil' },
};

beforeEach(async () => {
  setSyncLogSink(() => {});
  (dashboardApi.getDashboardPrograms as jest.Mock).mockRejectedValue(offlineError());
  (dashboardApi.getProgramDashboard as jest.Mock).mockRejectedValue(offlineError());
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
  await upsertLocalUser({ id: OWNER_ID });
});

afterAll(async () => {
  setSyncLogSink(null);
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

describe('the dashboard snapshot table', () => {
  it('ships in the schema', async () => {
    const rows = await getDatabase().execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='dashboard_snapshots'",
    );
    expect(rows.rows).toHaveLength(1);
    expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(5);
  });

  it('keeps one row per scope and year', async () => {
    await saveSnapshot(OWNER, 'srv-program-1', { a: 1 }, 2025);
    await saveSnapshot(OWNER, 'srv-program-1', { a: 2 }, 2026);
    await saveSnapshot(OWNER, 'srv-program-1', { a: 3 }, 2025);

    const rows = await getDatabase().execute(
      'SELECT COUNT(*) AS c FROM dashboard_snapshots',
    );
    expect(Number(rows.rows[0].c)).toBe(2);

    const cached = await readSnapshot<{ a: number }>(OWNER, 'srv-program-1', 2025);
    expect(cached?.payload.a).toBe(3);
  });

  it('records when it was captured', async () => {
    await saveSnapshot(OWNER, PROGRAMS_SCOPE, programsPayload);

    const cached = await readSnapshot<DashboardPrograms>(OWNER, PROGRAMS_SCOPE);
    expect(cached?.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('survives an app restart', async () => {
    await saveSnapshot(OWNER, PROGRAMS_SCOPE, programsPayload);

    await closeDatabase();
    await initializeDatabase();

    const cached = await readSnapshot<DashboardPrograms>(OWNER, PROGRAMS_SCOPE);
    expect(cached?.payload.programs).toHaveLength(2);
  });

  it('is scoped to its owner', async () => {
    await upsertLocalUser({ id: 'other-user' });
    await saveSnapshot(OWNER, PROGRAMS_SCOPE, programsPayload);

    await expect(
      readSnapshot(asOwnerUserId('other-user'), PROGRAMS_SCOPE),
    ).resolves.toBeNull();
  });

  it('can be cleared for one owner only', async () => {
    await upsertLocalUser({ id: 'other-user' });
    const other = asOwnerUserId('other-user');
    await saveSnapshot(OWNER, PROGRAMS_SCOPE, programsPayload);
    await saveSnapshot(other, PROGRAMS_SCOPE, programsPayload);

    await expect(clearSnapshots(OWNER)).resolves.toBe(1);

    await expect(readSnapshot(OWNER, PROGRAMS_SCOPE)).resolves.toBeNull();
    await expect(readSnapshot(other, PROGRAMS_SCOPE)).resolves.not.toBeNull();
  });

  it('survives a payload that is not valid json', async () => {
    await getDatabase().execute(
      `INSERT INTO dashboard_snapshots (owner_user_id, scope, year, payload_json, captured_at)
       VALUES (?, ?, 0, 'not json', ?)`,
      [OWNER_ID, 'broken', new Date().toISOString()],
    );

    await expect(readSnapshot(OWNER, 'broken')).resolves.toBeNull();
  });
});

describe('the program picker offline', () => {
  it('serves the programs the user saw online', async () => {
    await saveSnapshot(OWNER, PROGRAMS_SCOPE, programsPayload);

    const action = await dispatch(fetchDashboardProgramsThunk(undefined));

    expect(fetchDashboardProgramsThunk.fulfilled.match(action as never)).toBe(true);
    const payload = action.payload as DashboardPrograms;
    expect(payload.programs.map(p => p.name)).toEqual([
      'Regenerative Wheat 2026',
      'Kharif Rice 2027',
    ]);
    expect(payload.defaultProgramId).toBe('srv-program-1');
  });

  it('fails rather than showing an empty picker when nothing was cached', async () => {
    const action = await dispatch(fetchDashboardProgramsThunk(undefined));

    expect(fetchDashboardProgramsThunk.rejected.match(action as never)).toBe(true);
  });

  it('stores the list on a successful online read', async () => {
    (dashboardApi.getDashboardPrograms as jest.Mock).mockResolvedValueOnce(programsPayload);

    await dispatch(fetchDashboardProgramsThunk(undefined));

    const cached = await readSnapshot<DashboardPrograms>(OWNER, PROGRAMS_SCOPE);
    expect(cached?.payload.programs).toHaveLength(2);
  });
});

describe('the program dashboard offline', () => {
  it('serves the last dashboard the user saw', async () => {
    await saveSnapshot(OWNER, 'srv-program-1', dashboardPayload, dashboardPayload.year);

    const action = await dispatch(
      fetchProgramDashboardThunk({ programId: 'srv-program-1', year: 2026 }),
    );

    expect(fetchProgramDashboardThunk.fulfilled.match(action as never)).toBe(true);
    const payload = action.payload as ProgramDashboard;
    expect(payload.regenHealthIndex).toBe(72);
    expect(payload.categories[0].name).toBe('Soil');
  });

  it('answers a request with no year from the default snapshot', async () => {
    (dashboardApi.getProgramDashboard as jest.Mock).mockResolvedValueOnce(dashboardPayload);
    await dispatch(fetchProgramDashboardThunk({ programId: 'srv-program-1' }));

    (dashboardApi.getProgramDashboard as jest.Mock).mockRejectedValue(offlineError());
    const action = await dispatch(fetchProgramDashboardThunk({ programId: 'srv-program-1' }));

    expect(fetchProgramDashboardThunk.fulfilled.match(action as never)).toBe(true);
    expect((action.payload as ProgramDashboard).regenHealthIndex).toBe(72);
  });

  it('keeps each program dashboard separate', async () => {
    await saveSnapshot(OWNER, 'srv-program-1', dashboardPayload, 2026);
    await saveSnapshot(
      OWNER,
      'srv-program-2',
      { ...dashboardPayload, regenHealthIndex: 31 },
      2026,
    );

    const action = await dispatch(
      fetchProgramDashboardThunk({ programId: 'srv-program-2', year: 2026 }),
    );

    expect((action.payload as ProgramDashboard).regenHealthIndex).toBe(31);
  });

  it('fails for a program never seen online', async () => {
    const action = await dispatch(
      fetchProgramDashboardThunk({ programId: 'never-seen', year: 2026 }),
    );

    expect(fetchProgramDashboardThunk.rejected.match(action as never)).toBe(true);
  });
});

describe('telling the user how old the figures are', () => {
  const NOW = Date.parse('2026-09-10T12:00:00Z');
  const ago = (ms: number): string => new Date(NOW - ms).toISOString();

  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it('says just now for a fresh capture', () => {
    expect(describeAge(ago(30 * 1000), NOW)).toBe('just now');
  });

  it('counts minutes within the hour', () => {
    expect(describeAge(ago(25 * MINUTE), NOW)).toBe('25 minutes ago');
  });

  it('uses the singular for one hour', () => {
    expect(describeAge(ago(HOUR), NOW)).toBe('an hour ago');
    expect(describeAge(ago(5 * HOUR), NOW)).toBe('5 hours ago');
  });

  it('says yesterday rather than 1 days ago', () => {
    expect(describeAge(ago(DAY), NOW)).toBe('yesterday');
    expect(describeAge(ago(4 * DAY), NOW)).toBe('4 days ago');
  });

  it('never reports a negative age from a clock skew', () => {
    expect(describeAge(ago(-5 * HOUR), NOW)).toBe('just now');
  });

  it('degrades gracefully on an unreadable timestamp', () => {
    expect(describeAge('not a date', NOW)).toBe('earlier');
  });

  it('marks a dashboard served from cache and not one served live', async () => {
    await saveSnapshot(OWNER, 'srv-program-1', dashboardPayload, 2026);

    const offline = await dispatch(
      fetchProgramDashboardThunk({ programId: 'srv-program-1', year: 2026 }),
    );
    expect(
      (offline as unknown as { meta: { capturedAt: string | null } }).meta.capturedAt,
    ).toMatch(/^\d{4}-/);

    (dashboardApi.getProgramDashboard as jest.Mock).mockResolvedValueOnce(dashboardPayload);
    const live = await dispatch(
      fetchProgramDashboardThunk({ programId: 'srv-program-1', year: 2026 }),
    );
    expect(
      (live as unknown as { meta: { capturedAt: string | null } }).meta.capturedAt,
    ).toBeNull();
  });
});
