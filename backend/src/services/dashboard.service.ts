import ApiError from "../utils/ApiError.js";
import {
  listDashboardFarms,
  getDefaultDashboardFarmId,
  findOwnedFarm,
  getFarmCategoryScores,
  getFarmSummary,
  getFarmRecentActivity,
  getFarmUpcomingPrograms,
  getFarmStartYear,
  getFarmRhiTrend,
  getFarmCategoryScoresByYear,
  getFarmSummaryByYear,
} from "../models/dashboard.model.js";

function toInt(n: number | string | null | undefined): number | null {
  if (n === null || n === undefined) return null;
  const v = Number(n);
  return Number.isNaN(v) ? null : Math.round(v);
}

export interface FarmOption {
  id: string;
  name: string;
  fieldCount: number;
}

export interface DashboardFarmsInput {
  farmerId: string;
  page: number;
  limit: number;
  search?: string;
}

export async function getMyDashboardFarms(input: DashboardFarmsInput): Promise<{
  farms: FarmOption[];
  defaultFarmId: string | null;
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const offset = (input.page - 1) * input.limit;
  const [{ rows, total }, defaultFarmId] = await Promise.all([
    listDashboardFarms({
      farmerId: input.farmerId,
      search: input.search,
      limit: input.limit,
      offset,
    }),
    getDefaultDashboardFarmId(input.farmerId),
  ]);
  const farms = rows.map((f) => ({
    id: f.id,
    name: f.name,
    fieldCount: f.field_count,
  }));
  return {
    farms,
    defaultFarmId,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export interface FarmDashboard {
  farm: { id: string; name: string };
  regenHealthIndex: number | null;
  trendVsLastYear: number | null;
  categories: Array<{
    id: string;
    name: string;
    score: number | null;
    answered: number;
    totalQuestions: number;
  }>;
  upcoming: {
    hasUpcoming: boolean;
    programs: Array<{
      programId: string;
      programName: string;
      startDate: string;
      endDate: string | null;
      alreadyEnrolled: boolean;
      status: "upcoming";
    }>;
  };
  recentActivity: Array<{
    type: string;
    title: string;
    detail: string | null;
    at: string;
    fieldId: string | null;
    fieldName: string | null;
  }>;
  summary: {
    assessmentsCompleted: number;
    averageScore: number | null;
    topCategory: string | null;
  };
  recommendations: string[];
}

export async function getFarmDashboard(
  farmId: string,
  farmerId: string
): Promise<FarmDashboard> {
  const farm = await findOwnedFarm(farmId, farmerId);
  if (!farm) throw ApiError.notFound("Farm not found.");

  const [catRows, summaryRow, activityRows, upcomingPrograms] =
    await Promise.all([
      getFarmCategoryScores(farmId, farmerId),
      getFarmSummary(farmId, farmerId),
      getFarmRecentActivity(farmId, farmerId, 10),
      getFarmUpcomingPrograms(farmId, farmerId),
    ]);

  const categories = catRows.map((c) => ({
    id: c.id,
    name: c.name,
    score: toInt(c.percentage),
    answered: c.answered,
    totalQuestions: c.answered,
  }));

  const totalScore = catRows.reduce((s, c) => s + c.total_score, 0);
  const maxScore = catRows.reduce((s, c) => s + c.max_score, 0);
  const regenHealthIndex =
    maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : null;

  const scored = catRows.filter((c) => c.percentage !== null);
  const topCategory =
    scored.length > 0
      ? scored.reduce((best, c) =>
          Number(c.percentage) > Number(best.percentage) ? c : best
        ).name
      : null;

  return {
    farm: { id: farm.id, name: farm.name },
    regenHealthIndex,
    trendVsLastYear: null,
    categories,
    upcoming: {
      hasUpcoming: upcomingPrograms.length > 0,
      programs: upcomingPrograms.map((p) => ({
        programId: p.program_id,
        programName: p.program_name,
        startDate: p.start_date,
        endDate: p.end_date,
        alreadyEnrolled: p.already_enrolled,
        status: "upcoming" as const,
      })),
    },
    recentActivity: activityRows.map((a) => ({
      type: a.type,
      title: a.title,
      detail: a.detail,
      at: a.at.toISOString(),
      fieldId: a.field_id,
      fieldName: a.field_name,
    })),
    summary: {
      assessmentsCompleted: summaryRow.assessments_completed,
      averageScore: toInt(summaryRow.average_score),
      topCategory,
    },
    recommendations: [],
  };
}

/* ------------------------------------------------------------------ *
 * Farm summary report: year picker + Regen Health Index trend chart +
 * that year's category scores. Dedicated endpoint, independent of the
 * farm dashboard above.
 * ------------------------------------------------------------------ */

/** How many years the trend chart returns by default. */
const DEFAULT_TREND_YEARS = 5;
const MAX_TREND_YEARS = 20;

export interface FarmSummaryReport {
  farm: { id: string; name: string };
  year: number;
  availableYears: number[];
  regenHealthIndex: number | null;
  rating: string | null;
  trendVsLastYear: number | null;
  trend: Array<{ year: number; score: number }>;
  categories: Array<{
    id: string;
    name: string;
    score: number | null;
    answered: number;
  }>;
  summary: {
    assessmentsCompleted: number;
    averageScore: number | null;
    topCategory: string | null;
  };
}

export interface FarmSummaryOptions {
  year?: number;
  trendYears?: number;
}

function ratingFor(index: number): string {
  if (index >= 80) return "Excellent";
  if (index >= 60) return "Good";
  if (index >= 40) return "Fair";
  if (index >= 20) return "Needs work";
  return "Poor";
}

export async function getFarmSummaryReport(
  farmId: string,
  farmerId: string,
  options: FarmSummaryOptions = {}
): Promise<FarmSummaryReport> {
  const farm = await findOwnedFarm(farmId, farmerId);
  if (!farm) throw ApiError.notFound("Farm not found.");

  // Selectable years run from the farm's first activity (never before the farmer
  // registered) up to the current year.
  const currentYear = new Date().getFullYear();
  const [startYear, allTrend] = await Promise.all([
    getFarmStartYear(farmId, farmerId),
    getFarmRhiTrend(farmId, farmerId),
  ]);

  const availableYears: number[] = [];
  for (let y = currentYear; y >= startYear; y -= 1) availableYears.push(y);

  // Default to the most recent year that actually has a submitted assessment, so
  // the screen never opens on an empty year.
  const latestWithData =
    allTrend.length > 0 ? allTrend[allTrend.length - 1].year : null;
  const defaultYear =
    latestWithData !== null && availableYears.includes(latestWithData)
      ? latestWithData
      : currentYear;

  const year = options.year ?? defaultYear;
  if (!availableYears.includes(year)) {
    throw ApiError.badRequest(
      `You can only view years between ${startYear} and ${currentYear}.`
    );
  }

  // Chart window: the most recent N years that have data, oldest to newest.
  const trendYears = Math.max(
    1,
    Math.min(options.trendYears ?? DEFAULT_TREND_YEARS, MAX_TREND_YEARS)
  );
  const trend = allTrend
    .slice(-trendYears)
    .map((t) => ({ year: t.year, score: t.score }));

  const [catRows, summaryRow] = await Promise.all([
    getFarmCategoryScoresByYear(farmId, farmerId, year),
    getFarmSummaryByYear(farmId, farmerId, year),
  ]);

  const categories = catRows.map((c) => ({
    id: c.id,
    name: c.name,
    score: toInt(c.percentage),
    answered: c.answered,
  }));

  // Compare against the full history, not just the visible chart window.
  const thisYear = allTrend.find((t) => t.year === year);
  const lastYear = allTrend.find((t) => t.year === year - 1);
  const regenHealthIndex = thisYear ? thisYear.score : null;
  const trendVsLastYear =
    thisYear && lastYear ? thisYear.score - lastYear.score : null;

  const scored = catRows.filter((c) => c.percentage !== null);
  const topCategory =
    scored.length > 0
      ? scored.reduce((best, c) =>
          Number(c.percentage) > Number(best.percentage) ? c : best
        ).name
      : null;

  return {
    farm: { id: farm.id, name: farm.name },
    year,
    availableYears,
    regenHealthIndex,
    rating: regenHealthIndex === null ? null : ratingFor(regenHealthIndex),
    trendVsLastYear,
    trend,
    categories,
    summary: {
      assessmentsCompleted: summaryRow.assessments_completed,
      averageScore: toInt(summaryRow.average_score),
      topCategory,
    },
  };
}
