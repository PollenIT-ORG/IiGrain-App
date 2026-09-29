import {
  addFieldTarget,
  buildSteps,
  canOpenStep,
  completedCount,
} from '../src/screens/onboarding/onboardingSteps';
import type { OnboardingSnapshot } from '../src/screens/onboarding/useOnboardingData';

const EMPTY: OnboardingSnapshot = {
  program: null,
  farmCount: 0,
  fieldCount: 0,
  boundaryCount: 0,
  enrolledAcres: null,
  firstFarm: null,
  farms: [],
  fields: [],
};

const snapshot = (patch: Partial<OnboardingSnapshot>): OnboardingSnapshot => ({
  ...EMPTY,
  ...patch,
});

const PROFILE = { fullName: 'Asha Singh', phone: '5551234567' };

describe('onboarding checklist steps', () => {
  it('locks every step once it is done so it cannot be reopened', () => {
    const steps = buildSteps({
      profile: PROFILE,
      snapshot: snapshot({ farmCount: 1, fieldCount: 1, boundaryCount: 0 }),
      hasLocalBoundary: false,
    });
    const openable = Object.fromEntries(steps.map(s => [s.key, canOpenStep(s)]));
    expect(openable).toEqual({
      profile: false,
      farms: false,
      fields: false,
      boundaries: true,
    });
  });

  it('starts with nothing done for a brand new producer', () => {
    const steps = buildSteps({
      profile: null,
      snapshot: EMPTY,
      hasLocalBoundary: false,
    });
    expect(steps.map(s => s.key)).toEqual(['profile', 'farms', 'fields', 'boundaries']);
    expect(completedCount(steps)).toBe(0);
  });

  it('needs both a name and a phone before the profile step counts', () => {
    const only = (profile: { fullName?: string; phone?: string }) =>
      buildSteps({ profile, snapshot: EMPTY, hasLocalBoundary: false })[0].done;

    expect(only({ fullName: 'Asha Singh' })).toBe(false);
    expect(only({ phone: '5551234567' })).toBe(false);
    expect(only({ fullName: '  ', phone: '5551234567' })).toBe(false);
    expect(only(PROFILE)).toBe(true);
  });

  it('follows the farm then field then boundary order the flow walks', () => {
    const afterFarm = buildSteps({
      profile: PROFILE,
      snapshot: snapshot({ farmCount: 1 }),
      hasLocalBoundary: false,
    });
    expect(completedCount(afterFarm)).toBe(2);
    expect(afterFarm.find(s => s.key === 'fields')?.done).toBe(false);

    const afterField = buildSteps({
      profile: PROFILE,
      snapshot: snapshot({ farmCount: 1, fieldCount: 1 }),
      hasLocalBoundary: false,
    });
    expect(completedCount(afterField)).toBe(3);
    expect(afterField.find(s => s.key === 'boundaries')?.done).toBe(false);

    const afterBoundary = buildSteps({
      profile: PROFILE,
      snapshot: snapshot({ farmCount: 1, fieldCount: 1, boundaryCount: 1 }),
      hasLocalBoundary: false,
    });
    expect(completedCount(afterBoundary)).toBe(4);
  });

  it('accepts a boundary drawn on this device before the server confirms it', () => {
    const steps = buildSteps({
      profile: PROFILE,
      snapshot: snapshot({ farmCount: 1, fieldCount: 1, boundaryCount: 0 }),
      hasLocalBoundary: true,
    });
    expect(steps.find(s => s.key === 'boundaries')?.done).toBe(true);
    expect(completedCount(steps)).toBe(4);
  });
});

describe('where the "Add Your Fields" step goes', () => {
  const farm = (id: string, name: string) => ({
    id,
    name,
    location: 'Dewas, Madhya Pradesh',
    fieldCount: 0,
  });

  it('sends a producer with no farms to create one first', () => {
    expect(addFieldTarget([])).toEqual({ kind: 'addFarm' });
  });

  it('goes straight into the only farm, with no pointless choice', () => {
    const only = farm('farm-1', 'New Farmer 24');
    expect(addFieldTarget([only])).toEqual({ kind: 'addField', farm: only });
  });

  it('asks which farm once there is more than one', () => {
    expect(addFieldTarget([farm('farm-1', 'A'), farm('farm-2', 'B')])).toEqual({
      kind: 'pickFarm',
    });
  });

  it('never silently picks a farm when several exist', () => {
    const target = addFieldTarget([
      farm('farm-1', 'A'),
      farm('farm-2', 'B'),
      farm('farm-3', 'C'),
    ]);
    expect(target.kind).not.toBe('addField');
  });
});
