import type { Field } from './farm';
import type {
  AssessmentStatus,
  FieldAssessmentSummary,
  QuestionScore,
} from './assessment';

export type SubmitterRole = 'farmer' | 'assessor';

export interface SubmittedBy {
  id: string;
  name: string;
  role: SubmitterRole;
}

export interface AssignedFarmer {
  id: string;
  name: string;
  email: string;
  note: string | null;
  farmsCount: number;
  fieldsCount: number;
  pendingCount: number;
  status: AssessmentStatus;
  assignedAtISO: string;
}

export interface AssessorFieldStatus {
  assessedByMe: boolean;
  percentage: number;
  submittedBy: SubmittedBy | null;
  locked: boolean;
}

export interface AssessorFieldItem {
  field: Field;
  status: AssessorFieldStatus;
}

export interface AssessorHistoryItem {
  fieldId: string;
  programId: string;
  fieldName: string;
  farmName: string;
  year: number;
  percentage: number;
  submittedBy: SubmittedBy;
  submittedAtISO: string;
  locked: boolean;
}

export interface AssessorHistoryGroup {
  farmerId: string;
  farmerName: string;
  items: AssessorHistoryItem[];
}

export interface AssessorCounts {
  assigned: number;
  done: number;
  pending: number;
}

export interface AssessorDashboard {
  counts: AssessorCounts;
  recent: AssessorHistoryItem[];
  assignedPreview: AssignedFarmer[];
}

export interface AssessorAssessmentSummary {
  summary: FieldAssessmentSummary;
  submittedBy: SubmittedBy | null;
  locked: boolean;
}

export interface AssessorFieldEntry {
  field: {
    id: string;
    name: string;
    crop: string;
    status: string;
  };
  farm: { id: string; name: string };
  farmer: { id: string; name: string };
  program: { id: string; name: string };
  assessment: {
    status: AssessmentStatus;
    inProgress: boolean;
    completed: boolean;
    totalQuestions: number;
    answered: number;
    percentage: number;
    submittedAtISO: string | null;
    farmerSubmitted: boolean;
  };
}

export interface AssessorFieldsCounts {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
}

export interface AssessorFieldsOverview {
  year: number;
  title: string;
  counts: AssessorFieldsCounts;
  fields: AssessorFieldEntry[];
}

export interface AssessorFarmRow {
  id: string;
  name: string;
  fieldsCount: number;
  doneCount: number;
  pendingCount: number;
}

export interface FarmerAssessmentAnswer {
  id: string;
  code: string;
  text: string;
  score: QuestionScore | null;
  comment: string;
  evidenceUrls: string[];
  answered: boolean;
}

export interface FarmerAssessmentCategory {
  id: string;
  name: string;
  questions: FarmerAssessmentAnswer[];
}

export interface FarmerAssessmentView {
  field: { id: string; name: string };
  farmerSubmitted: boolean;
  submittedAtISO: string | null;
  categories: FarmerAssessmentCategory[];
}

export interface ComparisonQuestion {
  id: string;
  code: string;
  text: string;
  farmerScore: QuestionScore | null;
  assessorScore: QuestionScore | null;
  difference: number | null;
}

export interface ComparisonCategory {
  id: string;
  name: string;
  questions: ComparisonQuestion[];
}

export interface ComparisonSide {
  submitted: boolean;
  percentage: number;
}

export interface AssessorComparison {
  field: { id: string; name: string };
  farmer: ComparisonSide;
  assessor: ComparisonSide;
  categories: ComparisonCategory[];
}
