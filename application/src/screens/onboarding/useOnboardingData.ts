import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getMyFarms } from '../../api/FarmApi';
import { getFarmFields } from '../../api/FieldApi';
import { getAvailablePrograms } from '../../api/enrollmentApi';
import { useAppSelector } from '../../redux/hooks';
import { selectAuthUser } from '../../redux/slices/authSlice';
import { MAX_PAGE_LIMIT } from '../../types/pagination';
import type { AvailableProgram } from '../../types/enrollment';
import type { Farm, Field } from '../../types/farm';
import { handleApiError } from '../../utils/handleApiError';

export interface FarmRef {
  id: string;
  name: string;
}

export interface FieldRef {
  id: string;
  farmId: string;
  name: string;
}

export interface OnboardingSnapshot {
  program: AvailableProgram | null;
  farmCount: number;
  fieldCount: number;
  boundaryCount: number;
  enrolledAcres: number | null;
  firstFarm: FarmRef | null;
  firstField: FieldRef | null;
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
  firstField: null,
};

const MAX_FARMS_SCANNED = 10;

const pickProgram = (programs: readonly AvailableProgram[]): AvailableProgram | null =>
  programs.find(p => p.alreadyEnrolled) ?? programs.find(p => p.canEnroll) ?? null;

const enrolledAcresOf = (
  program: AvailableProgram | null,
  fields: readonly Field[],
): number | null => {
  if (!program) {
    return null;
  }
  const enrolled = new Set(program.fields.filter(f => f.enrolled).map(f => f.id));
  if (enrolled.size === 0) {
    return null;
  }
  const acres = fields
    .filter(f => enrolled.has(f.id))
    .reduce((sum, f) => sum + (f.areaAcres || 0), 0);
  return acres > 0 ? acres : null;
};

const settled = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
  result.status === 'fulfilled' ? result.value : fallback;

const loadSnapshot = async (): Promise<OnboardingSnapshot> => {
  const [programsResult, farmsResult] = await Promise.allSettled([
    getAvailablePrograms(),
    getMyFarms({ page: 1, limit: MAX_PAGE_LIMIT }),
  ]);
  if (programsResult.status === 'rejected' && farmsResult.status === 'rejected') {
    throw programsResult.reason;
  }

  const programs = settled<AvailableProgram[]>(programsResult, []);
  const farms = settled<{ farms: Farm[] }>(farmsResult, { farms: [] }).farms;
  const program = pickProgram(programs);

  const scanned = farms.filter(f => f.fieldsCount > 0).slice(0, MAX_FARMS_SCANNED);
  const fieldResults = await Promise.allSettled(scanned.map(f => getFarmFields(f.id)));
  const fields = fieldResults.flatMap(r => settled<Field[]>(r, []));

  const firstFarm = farms[0] ? { id: farms[0].id, name: farms[0].name } : null;
  const first = fields[0];

  return {
    program,
    farmCount: farms.length,
    fieldCount: farms.reduce((sum, f) => sum + (f.fieldsCount || 0), 0),
    boundaryCount: fields.filter(f => f.hasBoundary).length,
    enrolledAcres: enrolledAcresOf(program, fields),
    firstFarm,
    firstField: first ? { id: first.id, farmId: first.farmId, name: first.name } : null,
  };
};

let cache: { userId: string; data: OnboardingSnapshot } | null = null;

export const useOnboardingData = (): OnboardingData => {
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
    loadSnapshot()
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
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { snapshot, loading, initialLoading: loading && !loaded, error, refresh };
};
