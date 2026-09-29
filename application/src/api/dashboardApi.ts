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
  DashboardProgram,
  DashboardPrograms,
  DashboardRating,
  DashboardSummary,
  DashboardUpcoming,
  NextAssessment,
  ProgramDashboard,
  ProgramStatus,
  UpcomingProgram,
} from '../types/dashboard';

interface Envelope<T> {
  data: T;
  meta?: RawPageMeta;
}

type Num = number | string | null | undefined;

interface RawDashboardProgram {
  id: string;
  name?: string;
  code?: string | null;
  startDate?: string | null;
  start_date?: string | null;
  endDate?: string | null;
  end_date?: string | null;
  status?: string;
  fieldsEnrolled?: Num;
  fields_enrolled?: Num;
  assessmentsCompleted?: Num;
  assessments_completed?: Num;
  assessmentsPending?: Num;
  assessments_pending?: Num;
}

interface RawDashboardPrograms {
  programs?: RawDashboardProgram[];
  defaultProgramId?: string | null;
  default_program_id?: string | null;
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

interface RawProgramDashboard {
  program?: RawDashboardProgram;
  year?: Num;
  availableYears?: Num[];
  available_years?: Num[];
  trend?: RawTrendPoint[];
  regenHealthIndex?: Num;
  regen_health_index?: Num;
  rating?: string | null;
  trendVsLastYear?: Num;
  trend_vs_last_year?: Num;
  categories?: RawCategory[];
  upcoming?: RawUpcoming;
  recentActivity?: RawActivity[];
  recent_activity?: RawActivity[];
  summary?: RawSummary;
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

const toNumberOrUndefined = (raw: Num): number | undefined => {
  const n = toNumberOrNull(raw);
  return n === null ? undefined : n;
};

const PROGRAM_STATUSES: readonly ProgramStatus[] = ['active', 'scheduled', 'ended', 'inactive'];

const toProgramStatus = (raw: string | undefined): ProgramStatus =>
  PROGRAM_STATUSES.includes(raw as ProgramStatus) ? (raw as ProgramStatus) : 'inactive';

const RATINGS: readonly DashboardRating[] = ['Excellent', 'Good', 'Fair', 'Needs work', 'Poor'];

const toRating = (raw: string | null | undefined): DashboardRating =>
  RATINGS.includes(raw as DashboardRating) ? (raw as DashboardRating) : null;

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
    case 'enrolled_in_program':
      return 'clipboard-plus-outline';
    default:
      return 'timeline-clock-outline';
  }
};

const mapProgram = (raw: RawDashboardProgram): DashboardProgram => ({
  id: raw.id,
  name: raw.name ?? '',
  code: raw.code ?? null,
  startDateISO: raw.startDate ?? raw.start_date ?? null,
  endDateISO: raw.endDate ?? raw.end_date ?? null,
  status: toProgramStatus(raw.status),
  fieldsEnrolled: toNumber(raw.fieldsEnrolled ?? raw.fields_enrolled),
  assessmentsCompleted: toNumber(raw.assessmentsCompleted ?? raw.assessments_completed),
  assessmentsPending: toNumber(raw.assessmentsPending ?? raw.assessments_pending),
});

const mapDashboardPrograms = (
  raw: RawDashboardPrograms,
  rawMeta: RawPageMeta | undefined,
  query: PageQuery | undefined,
): DashboardPrograms => {
  const programs = (raw.programs ?? []).map(mapProgram);
  return {
    programs,
    defaultProgramId: raw.defaultProgramId ?? raw.default_program_id ?? null,
    meta: normalizePageMeta(rawMeta, programs.length, query),
  };
};

const mapCategory = (raw: RawCategory): DashboardCategory => ({
  id: raw.id,
  name: raw.name ?? '',
  score: toNumberOrNull(raw.score),
  answered: toNumber(raw.answered),
  totalQuestions: toNumberOrUndefined(raw.totalQuestions ?? raw.total_questions),
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

const mapProgramDashboard = (raw: RawProgramDashboard): ProgramDashboard => ({
  program: mapProgram(raw.program ?? { id: '' }),
  year: toNumber(raw.year) || new Date().getFullYear(),
  availableYears: (raw.availableYears ?? raw.available_years ?? [])
    .map(toNumber)
    .filter(y => y > 0),
  trend: (raw.trend ?? [])
    .map(p => ({ year: toNumber(p.year), score: toNumber(p.score) }))
    .filter(p => p.year > 0),
  regenHealthIndex: toNumberOrNull(raw.regenHealthIndex ?? raw.regen_health_index),
  rating: toRating(raw.rating),
  trendVsLastYear: toNumberOrNull(raw.trendVsLastYear ?? raw.trend_vs_last_year),
  categories: (raw.categories ?? []).map(mapCategory),
  upcoming: mapUpcoming(raw.upcoming),
  recentActivity: (raw.recentActivity ?? raw.recent_activity ?? []).map(mapActivity),
  summary: mapSummary(raw.summary),
});

export const getDashboardPrograms = async (
  query?: PageQuery,
): Promise<DashboardPrograms> => {
  const effective: PageQuery = { limit: MAX_PAGE_LIMIT, ...query };
  const res = await http.get<Envelope<RawDashboardPrograms>>(Endpoints.dashboard.programs, {
    silent: true,
    params: toPageParams(effective),
  });
  return mapDashboardPrograms(res.data.data, res.data.meta, effective);
};

export interface ProgramDashboardQuery {
  year?: number;
  trendYears?: number;
}

export const getProgramDashboard = async (
  programId: string,
  query?: ProgramDashboardQuery,
): Promise<ProgramDashboard> => {
  const res = await http.get<Envelope<RawProgramDashboard>>(
    Endpoints.dashboard.programSummary(programId),
    {
      silent: true,
      params: {
        ...(query?.year ? { year: query.year } : {}),
        ...(query?.trendYears ? { trendYears: query.trendYears } : {}),
      },
    },
  );
  return mapProgramDashboard(res.data.data);
};
