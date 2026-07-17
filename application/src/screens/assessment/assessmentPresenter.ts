import { COLORS } from '../../constants';
import type {
  AssessmentCategory,
  AssessmentCategorySummary,
  AssessmentProgress,
  AssessmentQuestion,
  AssessmentQuestionListItem,
  AssessmentSummary,
  CategoryQuestionList,
  EvidenceFile,
  FieldAssessmentSummary,
} from '../../types/assessment';

const START_LABEL = 'Start Assessment';
const CONTINUE_LABEL = 'Continue Assessment';
const REVIEW_LABEL = 'View';

export const isAssessmentComplete = (summary: FieldAssessmentSummary): boolean => {
  const info = summary.assessment;
  return info.totalQuestions > 0 && info.answered >= info.totalQuestions;
};

export const toSummaryCardModel = (
  summary: FieldAssessmentSummary,
): AssessmentSummary => {
  const info = summary.assessment;
  return {
    id: summary.field.id,
    title: info.title,
    status: info.status,
    startedDateISO: '',
    completedQuestions: info.answered,
    totalQuestions: info.totalQuestions,
    progress: info.percentage,
    buttonTitle: isAssessmentComplete(summary)
      ? REVIEW_LABEL
      : info.answered > 0
      ? CONTINUE_LABEL
      : START_LABEL,
  };
};

const iconForCategory = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('animal') || n.includes('livestock')) {
    return 'cow';
  }
  if (n.includes('biodiversity') || n.includes('habitat')) {
    return 'flower';
  }
  if (n.includes('carbon') || n.includes('nutrient')) {
    return 'tree';
  }
  if (n.includes('management') || n.includes('planning')) {
    return 'clipboard-text-outline';
  }
  if (n.includes('water')) {
    return 'water';
  }
  if (n.includes('soil')) {
    return 'leaf';
  }
  return 'leaf';
};

const colorForPercentage = (percentage: number): string => {
  if (percentage <= 0) {
    return COLORS.gray500;
  }
  if (percentage >= 70) {
    return COLORS.success;
  }
  return COLORS.warning;
};

export const toCategoryItems = (
  categories: AssessmentCategorySummary[],
): AssessmentCategory[] =>
  categories.map(category => ({
    id: category.id,
    title: category.name,
    completed: category.answered,
    total: category.totalQuestions,
    percentage: category.percentage,
    icon: iconForCategory(category.name),
    color: colorForPercentage(category.percentage),
  }));

export const toQuestionCardItem = (
  item: AssessmentQuestionListItem,
  index: number,
  categoryId: string,
): AssessmentQuestion => ({
  id: item.id,
  categoryId,
  index,
  code: item.code,
  title: item.text,
  description: item.guidance,
  score: null,
  comment: '',
  attachments: [],
  status: item.answered ? 'COMPLETED' : 'NOT_STARTED',
  lastUpdatedISO: null,
});

export const toCategoryHeaderModel = (
  list: CategoryQuestionList,
): { category: AssessmentCategory; progress: AssessmentProgress } => {
  const total = list.progress.totalQuestions;
  const completed = list.progress.answered;
  const percentage = list.progress.percentage;
  return {
    category: {
      id: list.category.id,
      title: list.category.name,
      completed,
      total,
      percentage,
      icon: iconForCategory(list.category.name),
      color: colorForPercentage(percentage),
    },
    progress: {
      total,
      completed,
      inProgress: 0,
      notStarted: Math.max(total - completed, 0),
      reviewRequired: 0,
      percentage,
    },
  };
};

const fileNameFromUrl = (url: string): string => {
  const last = url.split('?')[0].split('/').pop();
  return last && last.length > 0 ? last : 'evidence';
};

export const evidenceFilesFromUrls = (urls: string[]): EvidenceFile[] =>
  urls.map((url, index) => ({
    id: `evidence-${index}-${url}`,
    uri: url,
    name: fileNameFromUrl(url),
    type: /\.pdf($|\?)/i.test(url) ? 'pdf' : 'image',
    state: 'uploaded',
  }));
