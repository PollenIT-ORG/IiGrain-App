import { COLORS } from '../../constants';
import { formatDate } from '../../utils';
import type { ActivityItem, SummaryRow } from '../../components/home';
import type {
  DashboardCategory,
  DashboardSummary,
  DashboardUpcoming,
} from '../../types/dashboard';
import type { ActivityEntry } from '../../types/farm';

export interface HealthMetric {
  label: string;
  value: number;
  color: string;
}

export interface UpcomingAssessmentLabels {
  title: string;
  dueLabel: string;
}

export interface UpcomingProgramLabels {
  key: string;
  title: string;
  dueLabel: string;
  enrolled: boolean;
}

export interface TrendDelta {
  label?: string;
  positive: boolean;
}

export const METRIC_COLORS: string[] = [
  COLORS.black,
  COLORS.accent,
  COLORS.infoBlue,
  COLORS.leaf,
  COLORS.primary,
];

export const metricColor = (index: number): string =>
  METRIC_COLORS[index % METRIC_COLORS.length];

export const regenStatusLabel = (index: number | null): string => {
  if (index === null || index <= 0) {
    return 'Not assessed yet';
  }
  if (index >= 75) {
    return 'Excellent';
  }
  if (index >= 60) {
    return 'Good Progress';
  }
  if (index >= 40) {
    return 'Fair Progress';
  }
  return 'Needs Attention';
};

export const toHealthMetrics = (categories: DashboardCategory[]): HealthMetric[] =>
  categories.map((c, index) => ({
    label: c.name,
    value: c.score ?? 0,
    color: metricColor(index),
  }));

export const toActivityItems = (activity: ActivityEntry[]): ActivityItem[] =>
  activity.map(a => ({
    key: a.id,
    icon: a.icon,
    title: a.title,
    date: formatDate(a.dateISO),
  }));

export const toSummaryRows = (summary: DashboardSummary): SummaryRow[] => [
  { label: 'Assessments completed', value: String(summary.assessmentsCompleted) },
  {
    label: 'Average score',
    value: summary.averageScore === null ? '-' : `${summary.averageScore} / 100`,
  },
  { label: 'Top category', value: summary.topCategory ?? '-' },
];

export const toUpcomingAssessment = (
  upcoming: DashboardUpcoming,
): UpcomingAssessmentLabels | null => {
  const next = upcoming.nextAssessment;
  if (!next) {
    return null;
  }
  const title = next.fieldName || next.programName || 'Next Assessment';
  const due = next.dueDateISO ? `Due ${formatDate(next.dueDateISO)}` : 'No due date';
  const progress =
    next.totalQuestions > 0 ? ` · ${next.answered}/${next.totalQuestions}` : '';
  return { title, dueLabel: `${due}${progress}` };
};

export const toUpcomingPrograms = (
  upcoming: DashboardUpcoming,
): UpcomingProgramLabels[] =>
  [...upcoming.programs]
    .sort((a, b) => (a.startDateISO ?? '9999').localeCompare(b.startDateISO ?? '9999'))
    .map((p, i) => ({
      key: p.programId || `${p.programName}-${i}`,
      title: p.programName || 'New Program',
      dueLabel: p.startDateISO ? `Starts ${formatDate(p.startDateISO)}` : 'Enrolment open',
      enrolled: p.alreadyEnrolled,
    }));

export const toTrendDelta = (trend: number | null): TrendDelta => {
  if (trend === null) {
    return { positive: true };
  }
  return { label: `${Math.abs(trend)} vs last year`, positive: trend >= 0 };
};
