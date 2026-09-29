import type { PageMeta } from './pagination';

import type { ActivityEntry } from './farm';

export type ProgramStatus = 'active' | 'scheduled' | 'ended' | 'inactive';

export interface DashboardProgram {
  id: string;
  name: string;
  code: string | null;
  startDateISO: string | null;
  endDateISO: string | null;
  status: ProgramStatus;
  fieldsEnrolled: number;
  assessmentsCompleted: number;
  assessmentsPending: number;
}

export interface DashboardPrograms {
  programs: DashboardProgram[];
  defaultProgramId: string | null;
  meta: PageMeta;
}

export interface DashboardCategory {
  id: string;
  name: string;
  score: number | null;
  answered: number;
  totalQuestions?: number;
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

export type DashboardRating = 'Excellent' | 'Good' | 'Fair' | 'Needs work' | 'Poor' | null;

export interface ProgramDashboard {
  program: DashboardProgram;
  year: number;
  availableYears: number[];
  trend: DashboardTrendPoint[];
  regenHealthIndex: number | null;
  rating: DashboardRating;
  trendVsLastYear: number | null;
  categories: DashboardCategory[];
  upcoming: DashboardUpcoming;
  recentActivity: ActivityEntry[];
  summary: DashboardSummary;
}
