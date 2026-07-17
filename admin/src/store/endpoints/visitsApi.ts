import { apiSlice } from "../api";
import type { ApiSuccess } from "../../types";

export interface Visit {
  id: string;
  assessor_id: string;
  assessor_name: string | null;
  farmer_id: string;
  farmer_name: string | null;
  program_id: string | null;
  field_id: string | null;
  field_name: string | null;
  status: "en_route" | "arrived" | "completed" | "cancelled";
  dest_latitude: number | null;
  dest_longitude: number | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_at: string | null;
  started_at: string;
  arrived_at: string | null;
  ended_at: string | null;
}

export const visitsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    listActiveVisits: build.query<Visit[], void>({
      query: () => ({ url: "/visits/active", method: "GET" }),
      transformResponse: (res: ApiSuccess<{ visits: Visit[] }>) =>
        res.data.visits,
      providesTags: ["Visits"],
    }),

    getVisit: build.query<Visit, string>({
      query: (id) => ({ url: `/visits/${id}`, method: "GET" }),
      transformResponse: (res: ApiSuccess<{ visit: Visit }>) => res.data.visit,
    }),
  }),
});

export const { useListActiveVisitsQuery, useGetVisitQuery } = visitsApi;
