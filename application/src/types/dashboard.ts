import type { PageMeta } from './pagination';

import type { ActivityEntry } from './farm';

export interface DashboardFarm {
  id: string;
  name: string;
  fieldCount: number;
}

export interface DashboardFarms {
  farms: DashboardFarm[];
  defaultFarmId: string | null;
  meta: PageMeta;
}

export interface DashboardCategory {
  id: string;
  name: string;
  score: number | null;
  answered: number;
  totalQuestions: number;
}

export interface NextAssessment {
  fieldId: string;
  fieldName: string;
  programName: string;
  dueDateISO: string | null;
  answered: number;
  totalQuestions: number;
  status: string;
}

export interface UpcomingProgram {
  programId: string;
  programName: string;
  startDateISO: string | null;
  endDateISO: string | null;
  alreadyEnrolled: boolean;
  status: string;
}

export interface DashboardUpcoming {
  hasUpcoming: boolean;
  nextAssessment: NextAssessment | null;
  pendingCount: number;
  programs: UpcomingProgram[];
}

export interface DashboardSummary {
  assessmentsCompleted: number;
  averageScore: number | null;
  topCategory: string | null;
}

export interface DashboardTrendPoint {
  year: number;
  score: number;
}

export interface FarmDashboard {
  farm: { id: string; name: string };
  year: number;
  availableYears: number[];
  trend: DashboardTrendPoint[];
  regenHealthIndex: number | null;
  trendVsLastYear: number | null;
  categories: DashboardCategory[];
  upcoming: DashboardUpcoming;
  recentActivity: ActivityEntry[];
  summary: DashboardSummary;
  recommendations: string[];
}
