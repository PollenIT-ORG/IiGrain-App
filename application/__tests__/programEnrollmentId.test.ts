jest.mock('../src/services/http', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import http from '../src/services/http';
import { getAvailablePrograms } from '../src/api/enrollmentApi';
import enrollmentReducer, {
  selectAvailablePrograms,
} from '../src/redux/slices/enrollmentSlice';
import { logout } from '../src/redux/slices/authSlice';
import { fetchAvailableProgramsThunk } from '../src/redux/thunks/enrollmentThunks';
import { copyText } from '../src/utils/clipboard';
import Clipboard from '@react-native-clipboard/clipboard';
import { Share } from 'react-native';

const mockedGet = http.get as jest.Mock;

const rawProgram = (over: Record<string, unknown> = {}) => ({
  id: 'prog-1',
  name: 'Regenerative Wheat 2026',
  code: null,
  description: null,
  type: null,
  start_date: null,
  end_date: null,
  user_limit: null,
  enrolled_count: 14,
  is_full: false,
  already_enrolled: false,
  can_enroll: true,
  survey_url: 'https://example.com/survey/abc123',
  survey_acres: 40,
  fields: [],
  ...over,
});

const respondWith = (programs: unknown[]) =>
  mockedGet.mockResolvedValueOnce({ data: { data: { programs } } });

describe('Enrollment ID on the program list', () => {
  beforeEach(() => mockedGet.mockReset());

  it('carries the issued Enrollment ID onto the program', async () => {
    respondWith([rawProgram({ enrollment_id: 'IIG-2026-000123' })]);
    const [program] = await getAvailablePrograms();
    expect(program.enrollmentId).toBe('IIG-2026-000123');
    expect(program.canEnroll).toBe(true);
  });

  it('has no Enrollment ID while the survey is not accepted', async () => {
    respondWith([
      rawProgram({ id: 'a', can_enroll: false, enrollment_id: null }),
      rawProgram({ id: 'b', can_enroll: false }),
      rawProgram({ id: 'c', enrollment_id: '   ' }),
    ]);
    const programs = await getAvailablePrograms();
    expect(programs.map(p => p.enrollmentId)).toEqual([null, null, null]);
  });

  it('forgets every Enrollment ID when the farmer signs out', () => {
    const loaded = enrollmentReducer(
      undefined,
      fetchAvailableProgramsThunk.fulfilled(
        [
          {
            id: 'prog-1',
            name: 'Regen',
            code: '',
            description: null,
            type: '',
            startDateISO: null,
            endDateISO: null,
            userLimit: null,
            enrolledCount: 1,
            isFull: false,
            alreadyEnrolled: true,
            canEnroll: true,
            enrollmentId: 'IIG-2026-000123',
            surveyUrl: null,
            surveyAcres: null,
            fields: [],
          },
        ],
        'req-1',
      ),
    );
    expect(selectAvailablePrograms({ enrollment: loaded })[0].enrollmentId).toBe(
      'IIG-2026-000123',
    );

    const signedOut = enrollmentReducer(loaded, logout());
    expect(signedOut.availablePrograms).toEqual([]);
    expect(signedOut.programsLoaded).toBe(false);
  });
});

describe('copyText', () => {
  afterEach(() => jest.restoreAllMocks());

  it('copies straight to the clipboard', async () => {
    await expect(copyText('IIG-2026-000123')).resolves.toBe('copied');
    expect(Clipboard.setString).toHaveBeenCalledWith('IIG-2026-000123');
  });

  it('falls back to the share sheet when the clipboard is unavailable', async () => {
    (Clipboard.setString as jest.Mock).mockImplementationOnce(() => {
      throw new Error('RNCClipboard is not linked');
    });
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction });
    await expect(copyText('IIG-2026-000123')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ message: 'IIG-2026-000123' });
  });
});
