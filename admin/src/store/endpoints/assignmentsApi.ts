import { apiSlice } from "../api";
import type { ApiPaged, ApiSuccess, Assignment, PageMeta } from "../../types";

interface ListAssignmentsParams {
  page?: number;
  limit?: number;
  assessorId?: string;
  farmerId?: string;
}

interface AssignBody {
  assessorId: string;
  farmerId: string;
  note?: string;
}

export const assignmentsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    listAssignments: build.query<
      { assignments: Assignment[]; meta: PageMeta },
      ListAssignmentsParams
    >({
      query: (params) => ({ url: "/assessor-assignments", method: "GET", params }),
      transformResponse: (res: ApiPaged<{ assignments: Assignment[] }>) => ({
        assignments: res.data.assignments,
        meta: res.meta,
      }),
      providesTags: ["Assignments"],
    }),

    assignAssessor: build.mutation<Assignment, AssignBody>({
      query: (body) => ({
        url: "/assessor-assignments",
        method: "POST",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ assignment: Assignment }>) =>
        res.data.assignment,
      invalidatesTags: ["Assignments"],
    }),

    unassignAssessor: build.mutation<void, string>({
      query: (id) => ({ url: `/assessor-assignments/${id}`, method: "DELETE" }),
      invalidatesTags: ["Assignments"],
    }),
  }),
});

export const {
  useListAssignmentsQuery,
  useAssignAssessorMutation,
  useUnassignAssessorMutation,
} = assignmentsApi;
