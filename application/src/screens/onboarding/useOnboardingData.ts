import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getMyFarms } from '../../api/FarmApi';
import { getFarmFields } from '../../api/FieldApi';
import { getAvailablePrograms } from '../../api/enrollmentApi';
import { useAppSelector } from '../../redux/hooks';
import { selectAuthUser } from '../../redux/slices/authSlice';
import { MAX_PAGE_LIMIT } from '../../types/pagination';
import type { AvailableProgram } from '../../types/enrollment';
import type { Field } from '../../types/farm';
import { handleApiError } from '../../utils/handleApiError';

export interface FarmRef {
  id: string;
  name: string;
  location: string;
  fieldCount: number;
}

export interface FieldRef {
  id: string;
  farmId: string;
  farmName: string;
  name: string;
  crop: string;
  areaAcres: number;
  hasBoundary: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface OnboardingSnapshot {
  program: AvailableProgram | null;
  farmCount: number;
  fieldCount: number;
  boundaryCount: number;
  enrolledAcres: number | null;
  firstFarm: FarmRef | null;
  farms: FarmRef[];
  fields: FieldRef[];
}

export interface OnboardingData {
  snapshot: OnboardingSnapshot;
  loading: boolean;
  initialLoading: boolean;
  error: string | null;
  refresh: () => void;
}

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

const MAX_FARMS_SCANNED = 10;

const pickProgram = (programs: readonly AvailableProgram[]): AvailableProgram | null =>
  programs.find(p => p.alreadyEnrolled) ?? programs.find(p => p.canEnroll) ?? null;

export const enrolledAcresOf = (
  program: AvailableProgram | null,
  fields: readonly Field[],
): number | null => {
  if (!program) {
    return null;
  }
  const enrolled = new Set(program.fields.filter(f => f.enrolled).map(f => f.id));
  if (enrolled.size > 0) {
    const acres = fields
      .filter(f => enrolled.has(f.id))
      .reduce((sum, f) => sum + (f.areaAcres || 0), 0);
    if (acres > 0) {
      return acres;
    }
  }
  return program.surveyAcres;
};

const settled = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
  result.status === 'fulfilled' ? result.value : fallback;

const loadSnapshot = async (
  withProgram: boolean,
  carried: OnboardingSnapshot,
): Promise<OnboardingSnapshot> => {
  const [programsResult, farmsResult] = await Promise.allSettled([
    withProgram ? getAvailablePrograms() : Promise.resolve<AvailableProgram[]>([]),
    getMyFarms({ page: 1, limit: MAX_PAGE_LIMIT }),
  ]);
  if (farmsResult.status === 'rejected') {
    throw farmsResult.reason;
  }

  const programs = settled<AvailableProgram[]>(programsResult, []);
  const farms = farmsResult.value.farms;
  const program = withProgram ? pickProgram(programs) : carried.program;

  const scanned = farms.slice(0, MAX_FARMS_SCANNED);
  const farmNames = new Map(scanned.map(f => [f.id, f.name]));
  const fieldResults = await Promise.allSettled(scanned.map(f => getFarmFields(f.id)));
  const fields = fieldResults.flatMap(r => settled<Field[]>(r, []));

  const refs: FieldRef[] = fields.map(field => ({
    id: field.id,
    farmId: field.farmId,
    farmName: farmNames.get(field.farmId) ?? '',
    name: field.name,
    crop: field.crop ?? '',
    areaAcres: field.areaAcres ?? 0,
    hasBoundary: field.hasBoundary === true,
    latitude: field.latitude ?? null,
    longitude: field.longitude ?? null,
  }));

  const countByFarm = new Map<string, number>();
  for (const ref of refs) {
    countByFarm.set(ref.farmId, (countByFarm.get(ref.farmId) ?? 0) + 1);
  }

  const farmRefs: FarmRef[] = farms.map(farm => ({
    id: farm.id,
    name: farm.name,
    location: farm.location ?? '',
    fieldCount: Math.max(countByFarm.get(farm.id) ?? 0, farm.fieldsCount || 0),
  }));

  const reported = farms.reduce((sum, f) => sum + (f.fieldsCount || 0), 0);

  return {
    program,
    farmCount: farms.length,
    fieldCount: Math.max(reported, refs.length),
    boundaryCount: refs.filter(f => f.hasBoundary).length,
    enrolledAcres: withProgram
      ? enrolledAcresOf(program, fields)
      : carried.enrolledAcres,
    firstFarm: farmRefs[0] ?? null,
    farms: farmRefs,
    fields: refs,
  };
};

let cache: { userId: string; data: OnboardingSnapshot } | null = null;

export interface OnboardingDataOptions {
  withProgram?: boolean;
}

export const useOnboardingData = ({
  withProgram = true,
}: OnboardingDataOptions = {}): OnboardingData => {
  const userId = useAppSelector(selectAuthUser)?.id ?? '';
  const fresh = cache && cache.userId === userId ? cache : null;

  const [snapshot, setSnapshot] = useState<OnboardingSnapshot>(fresh?.data ?? EMPTY);
  const [loading, setLoading] = useState(!fresh);
  const [loaded, setLoaded] = useState(Boolean(fresh));
  const [error, setError] = useState<string | null>(null);

  const alive = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    if (inFlight.current) {
      return;
    }
    if (!userId) {
      setLoading(false);
      return;
    }
    inFlight.current = true;
    setLoading(true);
    loadSnapshot(withProgram, cache?.userId === userId ? cache.data : EMPTY)
      .then(data => {
        cache = { userId, data };
        if (alive.current) {
          setSnapshot(data);
          setError(null);
          setLoaded(true);
        }
      })
      .catch(err => {
        if (alive.current) {
          setError(handleApiError(err).message);
        }
      })
      .finally(() => {
        inFlight.current = false;
        if (alive.current) {
          setLoading(false);
        }
      });
  }, [userId, withProgram]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { snapshot, loading, initialLoading: loading && !loaded, error, refresh };
};
