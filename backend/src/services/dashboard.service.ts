import ApiError from "../utils/ApiError.js";
import {
  listDashboardFarms,
  findOwnedFarm,
  getFarmCategoryScores,
  getFarmSummary,
  getFarmRecentActivity,
  getFarmUpcomingPrograms,
  type DashboardFarm,
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

export async function getMyDashboardFarms(farmerId: string): Promise<{
  farms: FarmOption[];
  defaultFarmId: string | null;
}> {
  const rows: DashboardFarm[] = await listDashboardFarms(farmerId);
  const farms = rows.map((f) => ({
    id: f.id,
    name: f.name,
    fieldCount: f.field_count,
  }));
  return { farms, defaultFarmId: farms[0]?.id ?? null };
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
