import { AxiosError, AxiosHeaders } from 'axios';
import { open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  closeDatabase,
  databaseLocation,
  initializeDatabase,
} from '../src/services/db';
import { upsertLocalUser } from '../src/repositories/userRepository';
import { setSyncLogSink } from '../src/services/sync';
import * as assessmentApi from '../src/api/assessmentApi';
import * as authApi from '../src/api/authApi';
import * as notificationApi from '../src/api/notificationApi';
import * as monitoringApi from '../src/api/fieldMonitoringApi';
import { tokenStorage } from '../src/services/tokenStorage';
import {
  fetchAssessmentReviewThunk,
  fetchCategoryQuestionsThunk,
  fetchFieldRegenIndexThunk,
  fetchMyAssessmentHistoryThunk,
} from '../src/redux/thunks/assessmentThunks';
import {
  fetchNotificationsThunk,
  fetchUnreadCountThunk,
} from '../src/redux/thunks/notificationThunks';
import { fetchModulesThunk } from '../src/redux/thunks/monitoringThunks';
import authReducer, {
  bootstrapThunk,
  revalidateSessionThunk,
} from '../src/redux/slices/authSlice';
import { handleApiError } from '../src/utils/handleApiError';
import type { AuthUser } from '../src/api/authApi';

const USER_ID = 'farmer-lkg';
const PROGRAM_ID = 'prog-lkg';
const FIELD_ID = 'srv-field-lkg';

const networkError = (): AxiosError => new AxiosError('Network Error', 'ERR_NETWORK');

const timeoutError = (): AxiosError =>
  new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED');

const serverError = (message: string, status: number): AxiosError => {
  const headers = new AxiosHeaders();
  return new AxiosError(message, 'ERR_BAD_RESPONSE', { headers }, null, {
    data: { message },
    status,
    statusText: String(status),
    headers,
    config: { headers },
  });
};

const savedUser: AuthUser = {
  id: USER_ID,
  fullName: 'Asha Farmer',
  email: 'asha@example.com',
  role: 'farmer',
};

const state = () => ({
  auth: { user: savedUser, status: 'authenticated' },
  user: { profile: savedUser },
  assessment: {
    submitting: false,
    loadingQuestions: false,
    requestedCategoryScope: null,
    loadingRegenIndex: false,
    requestedRegenFieldId: null,
    summary: null,
    regenIndex: null,
    myFields: null,
  },
});

interface ThunkAction<T> {
  type: string;
  payload: T;
}

const run = <T>(
  thunk: unknown,
  dispatch: jest.Mock = jest.fn(),
  getState: () => unknown = state,
): Promise<ThunkAction<T>> =>
  (thunk as (d: unknown, g: unknown, e: unknown) => Promise<ThunkAction<T>>)(
    dispatch,
    getState,
    undefined,
  );

const restartApp = async () => {
  await closeDatabase();
  await initializeDatabase();
};

const history = {
  count: 1,
  items: [{ fieldId: FIELD_ID, fieldName: 'Old Plot', status: 'COMPLETED' }],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
};

const regen = {
  field: { id: FIELD_ID, name: 'Old Plot', farmId: 'farm', farmName: 'Farm' },
  regenHealthIndex: 62,
  rating: 'Good',
  categories: [],
  topCategory: null,
};

const notifications = {
  notifications: [{ id: 'n1', title: 'Visit tomorrow', read: false }],
  unreadCount: 1,
  meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
};

const modules = { context: { fieldId: FIELD_ID }, modules: [{ key: 'soil_samples', count: 2 }] };

beforeEach(async () => {
  setSyncLogSink(() => {});
  jest.restoreAllMocks();
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
  await initializeDatabase();
  await upsertLocalUser({ id: USER_ID });
});

afterAll(async () => {
  setSyncLogSink(null);
  await closeDatabase();
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
});

describe('data loaded before the app was killed is still there offline', () => {
  it('serves history, regen index, notifications and monitoring modules after a restart', async () => {
    jest.spyOn(assessmentApi, 'getMyAssessmentHistory').mockResolvedValue(history as never);
    jest.spyOn(assessmentApi, 'getFieldRegenIndex').mockResolvedValue(regen as never);
    jest.spyOn(notificationApi, 'getNotifications').mockResolvedValue(notifications as never);
    jest.spyOn(notificationApi, 'getUnreadCount').mockResolvedValue(1);
    jest.spyOn(monitoringApi, 'getModules').mockResolvedValue(modules as never);

    await run(fetchMyAssessmentHistoryThunk({ page: 1, search: '' }));
    await run(fetchFieldRegenIndexThunk({ programId: PROGRAM_ID, fieldId: FIELD_ID }));
    await run(fetchNotificationsThunk({ page: 1 }));
    await run(fetchUnreadCountThunk());
    await run(fetchModulesThunk({ fieldId: FIELD_ID }));

    await restartApp();
    jest.restoreAllMocks();
    jest.spyOn(assessmentApi, 'getMyAssessmentHistory').mockRejectedValue(networkError());
    jest.spyOn(assessmentApi, 'getFieldRegenIndex').mockRejectedValue(networkError());
    jest.spyOn(notificationApi, 'getNotifications').mockRejectedValue(networkError());
    jest.spyOn(notificationApi, 'getUnreadCount').mockRejectedValue(networkError());
    jest.spyOn(monitoringApi, 'getModules').mockRejectedValue(networkError());

    const results = await Promise.all([
      run(fetchMyAssessmentHistoryThunk({ page: 1, search: '' })),
      run(fetchFieldRegenIndexThunk({ programId: PROGRAM_ID, fieldId: FIELD_ID })),
      run(fetchNotificationsThunk({ page: 1 })),
      run(fetchUnreadCountThunk()),
      run(fetchModulesThunk({ fieldId: FIELD_ID })),
    ]);

    expect(results.map(r => r.type)).toEqual([
      'assessment/myHistory/fulfilled',
      'assessment/fetchRegenIndex/fulfilled',
      'notifications/fetch/fulfilled',
      'notifications/fetchUnreadCount/fulfilled',
      'monitoring/modules/fulfilled',
    ]);
    expect(results.map(r => r.payload)).toEqual([history, regen, notifications, 1, modules]);
  });

  it('never serves the first-page snapshot for a search or a later page', async () => {
    jest.spyOn(assessmentApi, 'getMyAssessmentHistory').mockResolvedValueOnce(history as never);
    await run(fetchMyAssessmentHistoryThunk({ page: 1 }));
    jest.spyOn(assessmentApi, 'getMyAssessmentHistory').mockRejectedValue(networkError());

    const searched = await run(fetchMyAssessmentHistoryThunk({ page: 1, search: 'north' }));
    const nextPage = await run(fetchMyAssessmentHistoryThunk({ page: 2 }));

    expect(searched.type).toBe('assessment/myHistory/rejected');
    expect(nextPage.type).toBe('assessment/myHistory/rejected');
  });

  it('keeps each user snapshot to that user', async () => {
    jest.spyOn(notificationApi, 'getNotifications').mockResolvedValueOnce(notifications as never);
    await run(fetchNotificationsThunk({ page: 1 }));
    await upsertLocalUser({ id: 'someone-else' });
    jest.spyOn(notificationApi, 'getNotifications').mockRejectedValue(networkError());

    const other = () => ({ ...state(), auth: { user: { id: 'someone-else' } } });
    const action = await run(fetchNotificationsThunk({ page: 1 }), jest.fn(), other);

    expect(action.type).toBe('notifications/fetch/rejected');
  });
});

describe('a cold start does not wait for, or log out on, /auth/me', () => {
  it('signs in from the saved session straight away', async () => {
    jest.spyOn(tokenStorage, 'get').mockResolvedValue('token');
    jest.spyOn(authApi, 'me').mockReturnValue(new Promise<AuthUser>(() => {}));
    const dispatch = jest.fn();

    const action = await run<AuthUser | null>(bootstrapThunk(), dispatch, () => ({
      user: { profile: savedUser },
      auth: { status: 'idle' },
    }));

    expect(action.type).toBe('auth/bootstrap/fulfilled');
    expect(action.payload).toEqual(savedUser);
    expect(dispatch).toHaveBeenCalledWith(expect.any(Function));
  });

  it('keeps the session and the token when revalidation fails offline', async () => {
    jest.spyOn(authApi, 'me').mockRejectedValue(networkError());
    const clear = jest.spyOn(tokenStorage, 'clear');
    const dispatch = jest.fn();

    const action = await run(revalidateSessionThunk(), dispatch, () => ({
      auth: { status: 'authenticated' },
    }));

    expect(action.type).toBe('auth/revalidateSession/fulfilled');
    expect(dispatchedTypes(dispatch)).toEqual(LIFECYCLE_ONLY);
    expect(clear).not.toHaveBeenCalled();
  });

  it('refreshes the signed-in user when the server answers', async () => {
    const fresh = { ...savedUser, fullName: 'Asha Updated' };
    jest.spyOn(authApi, 'me').mockResolvedValue(fresh);
    const dispatch = jest.fn();

    await run(revalidateSessionThunk(), dispatch, () => ({ auth: { status: 'authenticated' } }));

    expect(dispatch).toHaveBeenCalledWith({ type: 'auth/setUser', payload: fresh });
  });

  it('does not bring back a user who signed out meanwhile', async () => {
    jest.spyOn(authApi, 'me').mockResolvedValue(savedUser);
    const dispatch = jest.fn();

    await run(revalidateSessionThunk(), dispatch, () => ({ auth: { status: 'unauthenticated' } }));

    expect(dispatchedTypes(dispatch)).toEqual(LIFECYCLE_ONLY);
  });

  const LIFECYCLE_ONLY = ['auth/revalidateSession/pending', 'auth/revalidateSession/fulfilled'];

  const dispatchedTypes = (dispatch: jest.Mock): unknown[] =>
    dispatch.mock.calls.map(([action]) =>
      typeof action === 'function' ? 'thunk' : (action as { type: string }).type,
    );

  it('without a saved profile, an offline start keeps the token for later', async () => {
    jest.spyOn(tokenStorage, 'get').mockResolvedValue('token');
    jest.spyOn(authApi, 'me').mockRejectedValue(networkError());
    const clear = jest.spyOn(tokenStorage, 'clear');

    const action = await run<AuthUser | null>(bootstrapThunk(), jest.fn(), () => ({
      user: { profile: null },
      auth: { status: 'idle' },
    }));

    expect(action.payload).toBeNull();
    expect(clear).not.toHaveBeenCalled();
  });

  it('keeps a user refreshed while bootstrap was still finishing', () => {
    const fresh = { ...savedUser, fullName: 'Asha Updated' };
    const refreshed = authReducer(undefined, { type: 'auth/setUser', payload: fresh });

    const next = authReducer(refreshed, {
      type: bootstrapThunk.fulfilled.type,
      payload: savedUser,
    });

    expect(next.user?.fullName).toBe('Asha Updated');
    expect(next.status).toBe('authenticated');
    expect(next.bootstrapped).toBe(true);
  });
});

describe('with nothing cached, the app explains instead of saying "Network Error"', () => {
  it('rejects an uncached category with the offline explanation', async () => {
    jest.spyOn(assessmentApi, 'getCategoryQuestions').mockRejectedValue(networkError());

    const action = await run<{ message: string; kind: string }>(
      fetchCategoryQuestionsThunk({ programId: PROGRAM_ID, fieldId: FIELD_ID, categoryId: 'none' }),
    );

    expect(action.type).toBe('assessment/fetchCategoryQuestions/rejected');
    expect(action.payload.kind).toBe('offline');
    expect(action.payload.message).not.toBe('Network Error');
    expect(action.payload.message).toMatch(/needs a connection/);
  });

  it('rejects an uncached review the same way', async () => {
    jest.spyOn(assessmentApi, 'getAssessmentReview').mockRejectedValue(networkError());

    const action = await run<{ message: string }>(
      fetchAssessmentReviewThunk({ programId: PROGRAM_ID, fieldId: FIELD_ID }),
    );

    expect(action.type).toBe('assessment/fetchReview/rejected');
    expect(action.payload.message).toMatch(/needs a connection/);
  });

  it('describes a timeout as slow, not offline copy', () => {
    expect(handleApiError(timeoutError()).message).toMatch(/slow to respond/);
  });

  it('still shows the server message when the server did answer', () => {
    expect(handleApiError(serverError('Field not found.', 404)).message).toBe('Field not found.');
  });
});
