import { apiSlice } from "../api";
import type { ApiSuccess } from "../../types";

export interface AdminDashboardData {
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

/** The programs summary, scoped to the caller's own programs where that applies. */
export interface ProgramDashboardData {
  totalPrograms: number;
  enrolledFarmers: number;
  fieldsEnrolled: number;
  assessmentSubmissions: number;
  farmersWithAssessor: number;
  farmersFullyAssessed: number;
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
}

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getAdminDashboard: build.query<AdminDashboardData, void>({
      query: () => ({ url: "/dashboard/admin", method: "GET" }),
      transformResponse: (res: ApiSuccess<AdminDashboardData>) => res.data,
      providesTags: ["Dashboard"],
    }),
    getProgramDashboard: build.query<ProgramDashboardData, void>({
      query: () => ({ url: "/dashboard/programs", method: "GET" }),
      transformResponse: (res: ApiSuccess<ProgramDashboardData>) => res.data,
      providesTags: ["Dashboard"],
    }),
  }),
});

export const { useGetAdminDashboardQuery, useGetProgramDashboardQuery } =
  dashboardApi;
