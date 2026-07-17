import { clamp } from '../../utils';

export interface TrendPoint {
  year: number;
  value: number;
}

export interface CategoryScore {
  id: string;
  label: string;
  value: number;
}

export interface FarmReport {
  trend: TrendPoint[];
  categories: CategoryScore[];
}

export const REPORT_YEARS = [2021, 2022, 2023, 2024] as const;

export const LATEST_YEAR = REPORT_YEARS[REPORT_YEARS.length - 1];

const BASE_TREND: TrendPoint[] = [
  { year: 2021, value: 48 },
  { year: 2022, value: 55 },
  { year: 2023, value: 63 },
  { year: 2024, value: 72 },
];

const BASE_CATEGORIES: CategoryScore[] = [
  { id: 'soil', label: 'Soil Health', value: 68 },
  { id: 'water', label: 'Water Stewardship', value: 75 },
  { id: 'biodiversity', label: 'Biodiversity & Habitat', value: 70 },
  { id: 'carbon', label: 'Carbon & Nutrient Cycling', value: 72 },
  { id: 'livestock', label: 'Livestock Integration', value: 74 },
];

export const getFarmReport = (year: number): FarmReport => {
  const drop = (LATEST_YEAR - year) * 7;
  return {
    trend: BASE_TREND,
    categories: BASE_CATEGORIES.map(c => ({
      ...c,
      value: clamp(c.value - drop, 0, 100),
    })),
  };
};
