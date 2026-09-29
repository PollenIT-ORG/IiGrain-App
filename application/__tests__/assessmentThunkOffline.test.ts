import { AxiosError, AxiosHeaders } from 'axios';
import { open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  asOwnerUserId,
  closeDatabase,
  databaseLocation,
  initializeDatabase,
} from '../src/services/db';
import { upsertLocalUser } from '../src/repositories/userRepository';
import {
  answerRepository,
  farmRepository,
  fieldRepository,
} from '../src/repositories';
import { setSyncLogSink, syncQueue } from '../src/services/sync';
import * as assessmentApi from '../src/api/assessmentApi';
import { saveAssessmentAnswerThunk } from '../src/redux/thunks/assessmentThunks';
import type { SavedAnswer } from '../src/types/assessment';

const USER_ID = 'farmer-9';
const OWNER = asOwnerUserId(USER_ID);
const FIELD_SERVER_ID = 'srv-field-1';
const FARM_SERVER_ID = 'srv-farm-1';
const PROGRAM_ID = 'prog-1';

const networkError = (): AxiosError => new AxiosError('Network Error', 'ERR_NETWORK');

const httpError = (status: number): AxiosError => {
  const error = new AxiosError('failed', 'ERR');
  error.response = {
    status,
    statusText: String(status),
    data: {},
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return error;
};

const stateWithSummary = () => ({
  auth: { user: { id: USER_ID, role: 'farmer' } },
  assessment: {
    submitting: false,
    loadingQuestions: false,
    requestedCategoryScope: null,
    loadingRegenIndex: false,
    requestedRegenFieldId: null,
    summary: {
      field: {
        id: FIELD_SERVER_ID,
        name: 'North Plot',
        farmId: FARM_SERVER_ID,
        farmName: 'Home Farm',
      },
      assessment: { totalQuestions: 4 },
    },
    regenIndex: null,
    myFields: null,
  },
});

const runThunk = async (state: object, questionId = 'q1', score = 2) => {
  const dispatch = jest.fn();
  const getState = () => state;
  const thunk = saveAssessmentAnswerThunk({
    programId: PROGRAM_ID,
    fieldId: FIELD_SERVER_ID,
    questionId,
    input: { score: score as 0 | 1 | 2 | 3, comment: 'offline note' },
  });
  return thunk(dispatch, getState as never, undefined);
};

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

describe('online behaviour is unchanged', () => {
  it('returns the server answer and keeps a synced local copy with nothing queued', async () => {
    const serverAnswer: SavedAnswer = {
      id: 'srv-answer-1',
      fieldId: FIELD_SERVER_ID,
      questionId: 'q1',
      questionType: 'scored',
      score: 2,
      optionId: null,
      answerText: null,
      answerNumber: null,
      answerDate: null,
      answerBoolean: null,
      comment: 'from server',
      evidenceUrls: [],
      createdAtISO: '2026-09-07T00:00:00Z',
      updatedAtISO: '2026-09-07T00:00:00Z',
    };
    jest.spyOn(assessmentApi, 'saveAnswer').mockResolvedValue(serverAnswer);

    const action = await runThunk(stateWithSummary());

    expect(action.type).toBe('assessment/saveAnswer/fulfilled');
    expect(action.payload).toEqual(serverAnswer);
    const [mirrored] = await answerRepository.list(OWNER);
    expect(mirrored).toMatchObject({ question_id: 'q1', score: 2, sync_state: 'synced' });
    await expect(answerRepository.count(OWNER)).resolves.toBe(1);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
  });

  it('still rejects a validation error without queueing', async () => {
    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(httpError(422));

    const action = await runThunk(stateWithSummary());

    expect(action.type).toBe('assessment/saveAnswer/rejected');
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
    await expect(answerRepository.count(OWNER)).resolves.toBe(0);
  });

  it('still rejects a 401 without queueing', async () => {
    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(httpError(401));

    const action = await runThunk(stateWithSummary());

    expect(action.type).toBe('assessment/saveAnswer/rejected');
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
  });
});

describe('offline fallback', () => {
  it('saves the answer locally and queues it when the network is down', async () => {
    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(networkError());

    const action = await runThunk(stateWithSummary());

    expect(action.type).toBe('assessment/saveAnswer/fulfilled');
    const payload = action.payload as SavedAnswer;
    expect(payload.score).toBe(2);
    expect(payload.comment).toBe('offline note');
    expect(payload.fieldId).toBe(FIELD_SERVER_ID);

    await expect(answerRepository.count(OWNER)).resolves.toBe(1);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('mirrors the farm, field and assessment into SQLite', async () => {
    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(networkError());

    await runThunk(stateWithSummary());

    const farm = await farmRepository.getByServerId(OWNER, FARM_SERVER_ID);
    expect(farm?.name).toBe('Home Farm');
    const field = await fieldRepository.getByServerId(OWNER, FIELD_SERVER_ID);
    expect(field?.name).toBe('North Plot');
    expect(field?.farm_local_id).toBe(farm?.local_id);
  });

  it('coalesces repeated offline saves of the same question', async () => {
    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(networkError());

    await runThunk(stateWithSummary(), 'q1', 1);
    await runThunk(stateWithSummary(), 'q1', 3);

    await expect(answerRepository.count(OWNER)).resolves.toBe(1);
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(1);
  });

  it('records local progress against the cached assessment', async () => {
    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(networkError());

    await runThunk(stateWithSummary(), 'q1', 1);
    await runThunk(stateWithSummary(), 'q2', 2);

    const { getDatabase } = require('../src/services/db');
    const rows = await getDatabase().execute(
      'SELECT answered, total_questions, percentage FROM assessments',
    );
    expect(Number(rows.rows[0].answered)).toBe(2);
    expect(Number(rows.rows[0].total_questions)).toBe(4);
    expect(Number(rows.rows[0].percentage)).toBe(50);
  });

  it('rejects when the farm is unknown so nothing can be scoped', async () => {
    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(networkError());

    const state = stateWithSummary();
    state.assessment.summary.field.farmId = '';

    const action = await runThunk(state);

    expect(action.type).toBe('assessment/saveAnswer/rejected');
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
  });

  it('rejects when there is no authenticated user', async () => {
    jest.spyOn(assessmentApi, 'saveAnswer').mockRejectedValue(networkError());

    const state = stateWithSummary();
    state.auth.user.id = '';

    const action = await runThunk(state);

    expect(action.type).toBe('assessment/saveAnswer/rejected');
    await expect(syncQueue.countPending(OWNER)).resolves.toBe(0);
  });
});
