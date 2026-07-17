import { COLORS } from '../../constants';

export interface HealthMetric {
  label: string;
  value: number;
  color: string;
}

export interface RecentActivity {
  key: string;
  icon: string;
  title: string;
  date: string;
}

export interface PerformanceRow {
  label: string;
  value: string;
}

const METRIC_BLUE = '#3B82F6';

export const REGEN = {
  score: 72,
  max: 100,
  status: 'Good Progress',
  deltaLabel: '8 vs last year',
  deltaPositive: true,
} as const;

export const HEALTH_METRICS: HealthMetric[] = [
  { label: 'Soil Health', value: 68, color: COLORS.success },
  { label: 'Water Stewardship', value: 75, color: COLORS.warning },
  { label: 'Biodiversity & Habitat', value: 70, color: COLORS.success },
  { label: 'Carbon & Nutrient Cycling', value: 72, color: METRIC_BLUE },
  { label: 'Livestock Integration', value: 74, color: COLORS.success },
];

export const NEXT_ASSESSMENT = {
  title: 'Next Assessment',
  dueLabel: 'Due on Jun 15, 2024',
} as const;

export const RECENT_ACTIVITY: RecentActivity[] = [
  {
    key: 'ra1',
    icon: 'clipboard-check-outline',
    title: 'Self Assessment Completed',
    date: 'Apr 20, 2024',
  },
  {
    key: 'ra2',
    icon: 'file-document-outline',
    title: 'Field Report Generated',
    date: 'Apr 12, 2024',
  },
];

export const PERFORMANCE_SUMMARY: PerformanceRow[] = [
  { label: 'Assessments completed', value: '4' },
  { label: 'Average score', value: '72 / 100' },
  { label: 'Top category', value: 'Water Stewardship' },
];

export const FARM_NAME = 'Green Valley Farm';
