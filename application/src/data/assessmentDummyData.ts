import { COLORS } from '../constants';
import type {
  AssessmentCategory,
  AssessmentHistoryItem,
  AssessmentSummary,
} from '../types/assessment';

export const assessmentSummary: AssessmentSummary = {
  id: 'assessment-2024-annual',
  title: '2024 Annual Assessment',
  status: 'IN_PROGRESS',
  startedDateISO: '2024-04-20T00:00:00.000Z',
  completedQuestions: 18,
  totalQuestions: 31,
  progress: 58,
  buttonTitle: 'Continue Assessment',
};

export const assessmentCategories: AssessmentCategory[] = [
  {
    id: 'cat-soil',
    title: 'Soil Health',
    completed: 5,
    total: 6,
    percentage: 83,
    icon: 'leaf',
    color: COLORS.success,
  },
  {
    id: 'cat-water',
    title: 'Water Stewardship',
    completed: 3,
    total: 4,
    percentage: 75,
    icon: 'water',
    color: COLORS.success,
  },
  {
    id: 'cat-bio',
    title: 'Biodiversity & Habitat',
    completed: 4,
    total: 6,
    percentage: 67,
    icon: 'flower',
    color: COLORS.warning,
  },
  {
    id: 'cat-carbon',
    title: 'Carbon & Nutrient Cycling',
    completed: 3,
    total: 5,
    percentage: 60,
    icon: 'tree',
    color: COLORS.warning,
  },
  {
    id: 'cat-livestock',
    title: 'Livestock Integration',
    completed: 3,
    total: 4,
    percentage: 75,
    icon: 'cow',
    color: COLORS.success,
  },
  {
    id: 'cat-farm',
    title: 'Farm Management',
    completed: 0,
    total: 6,
    percentage: 0,
    icon: 'barn',
    color: COLORS.gray500,
  },
];

export const assessmentHistory: AssessmentHistoryItem[] = [];
