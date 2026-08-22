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
  // `expired` is the server auto-closing a visit that went 4 h with no position.
  status: "en_route" | "arrived" | "completed" | "cancelled" | "expired";
  dest_latitude: number | null;
  dest_longitude: number | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_at: string | null;
  started_at: string;
  arrived_at: string | null;
  ended_at: string | null;

  /** The field's surveyed outline, when the farmer has drawn one. */
  field_boundary: GeoJSONPolygon | null;

  // Server-side arrival geofence. This is the whole point of recording an
  // arrival: without it "Reached 10:42" is only the assessor's own word.
  arrival_latitude: number | null;
  arrival_longitude: number | null;
  arrival_accuracy_m: number | null;
  /** Metres from the field edge (0 = inside). `null` when the field is unmapped. */
  arrival_distance_m: number | null;
  /** `true` within tolerance, `false` outside it, `null` not checkable. */
  arrival_verified: boolean | null;
  /** Anti-spoof flag raised by the server, for a human to review. */
  location_flag: "mock_location" | "impossible_speed" | "teleport" | null;
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: Array<Array<[number, number]>>;
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
