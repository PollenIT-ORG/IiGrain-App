import {
  getAdminKpis,
  getAcreageOverTime,
  getProgramSplit,
  getAssessmentTrends,
  getRhiByProgram,
} from "../models/adminDashboard.model.js";

const DONUT_COLORS = [
  "#136F3F",
  "#22A16A",
  "#207DD2",
  "#F5A623",
  "#8E7CC3",
  "#C0CA33",
  "#94A3B8",
];

const MONTHS_WINDOW = 8;

export interface AdminDashboard {
  kpis: {
    enrolledAcreage: number;
    farmsEnrolled: number;
    farmersEnrolled: number;
    fieldsEnrolled: number;
    assessmentsSubmitted: number;
    completionPct: number | null;
    avgRhi: number | null;
    totalPrograms: number;
  };
  acreageEnrolled: Array<{ month: string; acres: number }>;
  programSplit: Array<{
    name: string;
    acres: number;
    value: number;
    color: string;
  }>;
  assessmentTrends: Array<{
    month: string;
    completion: number;
    score: number | null;
  }>;
  rhiByProgram: Array<{ region: string; rhi: number }>;
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const [kpi, acreage, split, trends, rhi] = await Promise.all([
    getAdminKpis(),
    getAcreageOverTime(MONTHS_WINDOW),
    getProgramSplit(DONUT_COLORS.length - 1),
    getAssessmentTrends(MONTHS_WINDOW),
    getRhiByProgram(8),
  ]);

  const totalSplitAcres = split.reduce((s, p) => s + p.acres, 0);
  const programSplit = split.map((p, i) => ({
    name: p.name,
    acres: p.acres,
    value:
      totalSplitAcres > 0
        ? Math.round((p.acres / totalSplitAcres) * 100)
        : 0,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  return {
    kpis: {
      enrolledAcreage: Math.round(kpi.enrolled_acreage),
      farmsEnrolled: kpi.farms_enrolled,
      farmersEnrolled: kpi.farmers_enrolled,
      fieldsEnrolled: kpi.fields_enrolled,
      assessmentsSubmitted: kpi.assessments_submitted,
      completionPct:
        kpi.completion_pct === null ? null : Number(kpi.completion_pct),
      avgRhi: kpi.avg_rhi === null ? null : Number(kpi.avg_rhi),
      totalPrograms: kpi.total_programs,
    },
    acreageEnrolled: acreage,
    programSplit,
    assessmentTrends: trends.map((t) => ({
      month: t.month,
      completion: t.submitted,
      score: t.score,
    })),
    rhiByProgram: rhi.map((r) => ({ region: r.program, rhi: r.rhi })),
  };
}
