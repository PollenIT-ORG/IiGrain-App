import { enrolledAcresOf } from '../src/screens/onboarding/useOnboardingData';
import { enrollmentLookupFailure } from '../src/screens/auth/components/useEnrollmentIdLookup';
import type { AvailableProgram } from '../src/types/enrollment';
import type { Field } from '../src/types/farm';

const program = (patch: Partial<AvailableProgram> = {}): AvailableProgram => ({
  id: 'p1',
  name: '2026 GFM Regen Program',
  code: 'GRP-001',
  description: null,
  type: '',
  startDateISO: null,
  endDateISO: null,
  userLimit: null,
  enrolledCount: 0,
  isFull: false,
  alreadyEnrolled: false,
  canEnroll: true,
  enrollmentId: null,
  surveyUrl: null,
  surveyAcres: null,
  fields: [],
  ...patch,
});

const field = (id: string, areaAcres: number): Field =>
  ({ id, areaAcres } as Field);

describe('Enrolled Acres on the welcome card', () => {
  it('falls back to the survey figure before any farm exists', () => {
    expect(enrolledAcresOf(program({ surveyAcres: 876 }), [])).toBe(876);
  });

  it('switches to the enrolled fields once they exist', () => {
    const p = program({
      surveyAcres: 876,
      fields: [
        { id: 'f1', name: 'A', crop: '', farmName: '', enrolled: true },
        { id: 'f2', name: 'B', crop: '', farmName: '', enrolled: true },
        { id: 'f3', name: 'C', crop: '', farmName: '', enrolled: false },
      ],
    });
    expect(enrolledAcresOf(p, [field('f1', 40), field('f2', 15), field('f3', 500)])).toBe(
      55,
    );
  });

  it('keeps the survey figure when a field is enrolled but has no acreage yet', () => {
    const p = program({
      surveyAcres: 876,
      fields: [{ id: 'f1', name: 'A', crop: '', farmName: '', enrolled: true }],
    });
    expect(enrolledAcresOf(p, [field('f1', 0)])).toBe(876);
  });

  it('shows a dash only when neither number exists', () => {
    expect(enrolledAcresOf(program(), [])).toBeNull();
  });

  it('has nothing to show without a program', () => {
    expect(enrolledAcresOf(null, [field('f1', 40)])).toBeNull();
  });
});

describe('Enrollment ID lookup failures', () => {
  it('treats a missing ID as a wrong ID the farmer should fix', () => {
    expect(enrollmentLookupFailure(404).kind).toBe('notFound');
    expect(enrollmentLookupFailure(400).kind).toBe('notFound');
    expect(enrollmentLookupFailure(404).message).toMatch(/check the ID in your email/i);
  });

  it('does not blame the ID when we are simply rate limited', () => {
    const limited = enrollmentLookupFailure(429);
    expect(limited.kind).toBe('unavailable');
    expect(limited.message).toMatch(/still continue/i);
  });

  it('lets the farmer carry on when the check is offline or broken', () => {
    expect(enrollmentLookupFailure(null).kind).toBe('unavailable');
    expect(enrollmentLookupFailure(500).kind).toBe('unavailable');
    expect(enrollmentLookupFailure(500).message).toMatch(/still continue/i);
  });
});
