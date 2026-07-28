import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import {
  MAX_PAGE_LIMIT,
  normalizePageMeta,
  toPageParams,
  type PageQuery,
  type RawPageMeta,
} from '../types/pagination';
import type { ActivityEntry } from '../types/farm';
import type {
  DashboardCategory,
  DashboardFarm,
  DashboardFarms,
  DashboardSummary,
  DashboardUpcoming,
  FarmDashboard,
  NextAssessment,
  UpcomingProgram,
} from '../types/dashboard';

interface Envelope<T> {
  data: T;
  meta?: RawPageMeta;
}

type Num = number | string | null | undefined;

interface RawDashboardFarm {
  id: string;
  name?: string;
  fieldCount?: Num;
  field_count?: Num;
}
interface RawDashboardFarms {
  farms?: RawDashboardFarm[];
  defaultFarmId?: string | null;
  default_farm_id?: string | null;
}

interface RawCategory {
  id: string;
  name?: string;
  score?: Num;
  answered?: Num;
  totalQuestions?: Num;
  total_questions?: Num;
}

interface RawNextAssessment {
  fieldId?: string;
  field_id?: string;
  fieldName?: string;
  field_name?: string;
  programName?: string;
  program_name?: string;
  dueDate?: string | null;
  due_date?: string | null;
  answered?: Num;
  totalQuestions?: Num;
  total_questions?: Num;
  status?: string;
}

interface RawUpcomingProgram {
  programId?: string;
  program_id?: string;
  programName?: string;
  program_name?: string;
  startDate?: string | null;
  start_date?: string | null;
  endDate?: string | null;
  end_date?: string | null;
  alreadyEnrolled?: boolean;
  already_enrolled?: boolean;
  status?: string;
}

interface RawUpcoming {
  hasUpcoming?: boolean;
  has_upcoming?: boolean;
  nextAssessment?: RawNextAssessment | null;
  next_assessment?: RawNextAssessment | null;
  pendingCount?: Num;
  pending_count?: Num;
  programs?: RawUpcomingProgram[];
}

interface RawActivity {
  type?: string;
  title?: string;
  detail?: string;
  at?: string;
  fieldId?: string;
  field_id?: string;
  fieldName?: string;
  field_name?: string;
}

interface RawSummary {
  assessmentsCompleted?: Num;
  assessments_completed?: Num;
  averageScore?: Num;
  average_score?: Num;
  topCategory?: string | null;
  top_category?: string | null;
}

interface RawTrendPoint {
  year?: Num;
  score?: Num;
}

interface RawFarmDashboard {
  farm?: { id?: string; name?: string };
  year?: Num;
  availableYears?: Num[];
  available_years?: Num[];
  trend?: RawTrendPoint[];
  regenHealthIndex?: Num;
  regen_health_index?: Num;
  trendVsLastYear?: Num;
  trend_vs_last_year?: Num;
  categories?: RawCategory[];
  upcoming?: RawUpcoming;
  recentActivity?: RawActivity[];
  recent_activity?: RawActivity[];
  summary?: RawSummary;
  recommendations?: unknown[];
}

const toNumber = (raw: Num): number => {
  const n = Number.parseFloat(String(raw ?? ''));
  return Number.isFinite(n) ? n : 0;
};

const toNumberOrNull = (raw: Num): number | null => {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const n = Number.parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
};

const activityIcon = (type: string): string => {
  switch (type) {
    case 'assessment_submitted':
      return 'clipboard-check-outline';
    case 'assessment_started':
      return 'clipboard-play-outline';
    case 'field_updated':
      return 'pencil-outline';
    case 'field_created':
      return 'sprout-outline';
    case 'farm_created':
      return 'barn';
    default:
      return 'timeline-clock-outline';
  }
};

const mapFarm = (raw: RawDashboardFarm): DashboardFarm => ({
  id: raw.id,
  name: raw.name ?? '',
  fieldCount: toNumber(raw.fieldCount ?? raw.field_count),
});

const mapDashboardFarms = (
  raw: RawDashboardFarms,
  rawMeta: RawPageMeta | undefined,
  query: PageQuery | undefined,
): DashboardFarms => {
  const farms = (raw.farms ?? []).map(mapFarm);
  return {
    farms,
    defaultFarmId: raw.defaultFarmId ?? raw.default_farm_id ?? null,
    meta: normalizePageMeta(rawMeta, farms.length, query),
  };
};

const mapCategory = (raw: RawCategory): DashboardCategory => ({
  id: raw.id,
  name: raw.name ?? '',
  score: toNumberOrNull(raw.score),
  answered: toNumber(raw.answered),
  totalQuestions: toNumber(raw.totalQuestions ?? raw.total_questions),
});

const mapNextAssessment = (raw: RawNextAssessment | null | undefined): NextAssessment | null => {
  if (!raw) {
    return null;
  }
  return {
    fieldId: raw.fieldId ?? raw.field_id ?? '',
    fieldName: raw.fieldName ?? raw.field_name ?? '',
    programName: raw.programName ?? raw.program_name ?? '',
    dueDateISO: raw.dueDate ?? raw.due_date ?? null,
    answered: toNumber(raw.answered),
    totalQuestions: toNumber(raw.totalQuestions ?? raw.total_questions),
    status: raw.status ?? '',
  };
};

const mapUpcomingProgram = (raw: RawUpcomingProgram): UpcomingProgram => ({
  programId: raw.programId ?? raw.program_id ?? '',
  programName: raw.programName ?? raw.program_name ?? '',
  startDateISO: raw.startDate ?? raw.start_date ?? null,
  endDateISO: raw.endDate ?? raw.end_date ?? null,
  alreadyEnrolled: Boolean(raw.alreadyEnrolled ?? raw.already_enrolled),
  status: raw.status ?? '',
});

const mapUpcoming = (raw: RawUpcoming | undefined): DashboardUpcoming => ({
  hasUpcoming: Boolean(raw?.hasUpcoming ?? raw?.has_upcoming),
  nextAssessment: mapNextAssessment(raw?.nextAssessment ?? raw?.next_assessment),
  pendingCount: toNumber(raw?.pendingCount ?? raw?.pending_count),
  programs: (raw?.programs ?? []).map(mapUpcomingProgram),
});

const mapActivity = (raw: RawActivity, index: number): ActivityEntry => ({
  id: `${raw.fieldId ?? raw.field_id ?? 'activity'}-${index}-${raw.at ?? ''}`,
  title: raw.title ?? '',
  description: raw.detail ?? '',
  dateISO: raw.at ?? '',
  icon: activityIcon(raw.type ?? ''),
});

const mapSummary = (raw: RawSummary | undefined): DashboardSummary => ({
  assessmentsCompleted: toNumber(raw?.assessmentsCompleted ?? raw?.assessments_completed),
  averageScore: toNumberOrNull(raw?.averageScore ?? raw?.average_score),
  topCategory: raw?.topCategory ?? raw?.top_category ?? null,
});

const mapFarmDashboard = (raw: RawFarmDashboard): FarmDashboard => ({
  farm: { id: raw.farm?.id ?? '', name: raw.farm?.name ?? '' },
  year: toNumber(raw.year) || new Date().getFullYear(),
  availableYears: (raw.availableYears ?? raw.available_years ?? [])
    .map(toNumber)
    .filter(y => y > 0),
  trend: (raw.trend ?? [])
    .map(p => ({ year: toNumber(p.year), score: toNumber(p.score) }))
    .filter(p => p.year > 0),
  regenHealthIndex: toNumberOrNull(raw.regenHealthIndex ?? raw.regen_health_index),
  trendVsLastYear: toNumberOrNull(raw.trendVsLastYear ?? raw.trend_vs_last_year),
  categories: (raw.categories ?? []).map(mapCategory),
  upcoming: mapUpcoming(raw.upcoming),
  recentActivity: (raw.recentActivity ?? raw.recent_activity ?? []).map(mapActivity),
  summary: mapSummary(raw.summary),
  recommendations: (raw.recommendations ?? []).filter(
    (r): r is string => typeof r === 'string',
  ),
});

/** The farm selector and the reports dropdown both read this list, so it is
 *  fetched at the backend's maximum page size: one round-trip covers every
 *  realistic farmer, and the selector still supports search + load-more beyond
 *  that. */
export const getDashboardFarms = async (
  query?: PageQuery,
): Promise<DashboardFarms> => {
  const effective: PageQuery = { limit: MAX_PAGE_LIMIT, ...query };
  const res = await http.get<Envelope<RawDashboardFarms>>(Endpoints.dashboard.farms, {
    silent: true,
    params: toPageParams(effective),
  });
  return mapDashboardFarms(res.data.data, res.data.meta, effective);
};

export interface FarmDashboardQuery {
  /** Omit to get the backend default: the latest year that has data. */
  year?: number;
  /** How many points the trend chart returns (1-20). Backend default is 5. */
  trendYears?: number;
}

export const getFarmDashboard = async (
  farmId: string,
  query?: FarmDashboardQuery,
): Promise<FarmDashboard> => {
  const res = await http.get<Envelope<RawFarmDashboard>>(Endpoints.dashboard.farm(farmId), {
    silent: true,
    params: {
      ...(query?.year ? { year: query.year } : {}),
      ...(query?.trendYears ? { trendYears: query.trendYears } : {}),
    },
  });
  console.log("getFarmDashboard  ___---", res);
  return mapFarmDashboard(res.data.data);
};
