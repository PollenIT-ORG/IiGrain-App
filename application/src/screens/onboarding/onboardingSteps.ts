import { ICONS } from '../../components/AppIcon';
import type { FarmRef, OnboardingSnapshot } from './useOnboardingData';

export interface ProducerIdentity {
  fullName?: string;
  phone?: string;
}

export type OnboardingStepKey = 'profile' | 'farms' | 'fields' | 'boundaries';

export interface OnboardingStep {
  key: OnboardingStepKey;
  title: string;
  subtitle: string;
  icon: string;
  done: boolean;
}

export interface StepInput {
  profile: ProducerIdentity | null;
  snapshot: OnboardingSnapshot;
  hasLocalBoundary: boolean;
}

const isProfileComplete = (profile: ProducerIdentity | null): boolean =>
  Boolean(profile?.fullName?.trim() && profile?.phone?.trim());

export const buildSteps = ({
  profile,
  snapshot,
  hasLocalBoundary,
}: StepInput): OnboardingStep[] => [
  {
    key: 'profile',
    title: 'Complete Producer Profile',
    subtitle: 'Tell us about yourself',
    icon: ICONS.PRODUCER,
    done: isProfileComplete(profile),
  },
  {
    key: 'farms',
    title: 'Add Your Farms',
    subtitle: 'Add one or more farms',
    icon: ICONS.FARM,
    done: snapshot.farmCount > 0,
  },
  {
    key: 'fields',
    title: 'Add Your Fields',
    subtitle: 'Add fields in your farms',
    icon: ICONS.FIELD,
    done: snapshot.fieldCount > 0,
  },
  {
    key: 'boundaries',
    title: 'Map Field Boundaries',
    subtitle: 'Draw boundaries on the map',
    icon: ICONS.MAP_CHECK,
    done: snapshot.boundaryCount > 0 || hasLocalBoundary,
  },
];

export const canOpenStep = (step: OnboardingStep): boolean => !step.done;

export const completedCount = (steps: readonly OnboardingStep[]): number =>
  steps.filter(step => step.done).length;

export type AddFieldTarget =
  | { kind: 'addFarm' }
  | { kind: 'addField'; farm: FarmRef }
  | { kind: 'pickFarm' };

export const addFieldTarget = (farms: readonly FarmRef[]): AddFieldTarget => {
  if (farms.length === 0) {
    return { kind: 'addFarm' };
  }
  if (farms.length === 1) {
    return { kind: 'addField', farm: farms[0] };
  }
  return { kind: 'pickFarm' };
};
