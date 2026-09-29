import { apiSlice } from "../api";
import type {
  ApiPaged,
  ApiSuccess,
  Program,
  ProgramEnrollment,
  Submission,
  EnrollmentAssessments,
  PageMeta,
} from "../../types";

export type ProgramStatusFilter =
  | "active"
  | "inactive"
  | "ended"
  | "scheduled";

export interface ListProgramsParams {
  page?: number;
  limit?: number;
  status?: ProgramStatusFilter;
  search?: string;
}

export interface CreateProgramBody {
  name: string;
  code?: string | null;
  description?: string | null;
  type?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  userLimit?: number | null;
  isActive?: boolean;
  showToFarmers?: boolean;
  // Null starts the program from the Global template, "blank" starts it empty, an id copies that template.
  assessmentTemplateId?: string | null;
  // Only with "blank": whether the assessment holds multiple choice or input based questions.
  questionKind?: "mcq" | "input";
  // The name the program's own assessment is listed and reused under.
  assessmentTemplateName?: string;
}

export type UpdateProgramBody = Partial<CreateProgramBody>;

export interface EnrollBody {
  farmerId: string;
  fieldIds: string[];
  assessorId?: string | null;
  note?: string | null;
}

export interface ListSubmissionsParams {
  page?: number;
  // One field's submissions, whoever filled them in.
  fieldId?: string;
  limit?: number;
  programId?: string;
  authorRole?: "farmer" | "assessor";
  reviewStatus?: "in_review" | "approved";
}

export const programsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    listPrograms: build.query<
      { programs: Program[]; meta: PageMeta },
      ListProgramsParams
    >({
      query: (params) => ({ url: "/programs", method: "GET", params }),
      transformResponse: (res: ApiPaged<{ programs: Program[] }>) => ({
        programs: res.data.programs,
        meta: res.meta,
      }),
      providesTags: ["Programs"],
    }),

    getProgram: build.query<Program, string>({
      query: (id) => ({ url: `/programs/${id}`, method: "GET" }),
      transformResponse: (res: ApiSuccess<{ program: Program }>) =>
        res.data.program,
      providesTags: (_r, _e, id) => [{ type: "Program", id }],
    }),

    // A code built from the name, free of any already in use.
    suggestProgramCode: build.query<string, string>({
      query: (name) => ({
        url: "/programs/code-suggestion",
        method: "GET",
        params: { name },
      }),
      transformResponse: (res: ApiSuccess<{ code: string }>) => res.data.code,
    }),

    createProgram: build.mutation<Program, CreateProgramBody>({
      query: (body) => ({ url: "/programs", method: "POST", data: body }),
      transformResponse: (res: ApiSuccess<{ program: Program }>) =>
        res.data.program,
      invalidatesTags: ["Programs"],
    }),

    updateProgram: build.mutation<
      Program,
      { id: string; body: UpdateProgramBody }
    >({
      query: ({ id, body }) => ({
        url: `/programs/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ program: Program }>) =>
        res.data.program,
      // A new template choice gives the program a new copy; its id arrives with the program, and the old copy is gone.
      invalidatesTags: (_r, _e, { id, body }) => [
        "Programs",
        { type: "Program", id },
        ...(body.assessmentTemplateId !== undefined ? (["AssessmentTemplates"] as const) : []),
      ],
    }),

    // The toggle on the list row. Its own endpoint so flipping it never sends
    // the rest of the program back.
    setProgramVisibility: build.mutation<
      Program,
      { id: string; showToFarmers: boolean }
    >({
      query: ({ id, showToFarmers }) => ({
        url: `/programs/${id}/visibility`,
        method: "PATCH",
        data: { showToFarmers },
      }),
      transformResponse: (res: ApiSuccess<{ program: Program }>) =>
        res.data.program,
      // Flip the row in place so the switch answers immediately rather than
      // waiting on a round trip, and put it back if the server refuses. Every
      // cached page of the list is patched, since the same program can sit in
      // more than one (a filter, a search, another page).
      async onQueryStarted({ id, showToFarmers }, { dispatch, queryFulfilled, getState }) {
        const cachedArgs = programsApi.util.selectCachedArgsForQuery(
          getState() as Parameters<
            typeof programsApi.util.selectCachedArgsForQuery
          >[0],
          "listPrograms"
        );
        const undos = cachedArgs.map((args) =>
          dispatch(
            programsApi.util.updateQueryData("listPrograms", args, (draft) => {
              const row = draft.programs.find((p) => p.id === id);
              if (row) row.show_to_farmers = showToFarmers;
            })
          )
        );
        try {
          await queryFulfilled;
        } catch {
          undos.forEach((u) => u.undo());
        }
      },
      invalidatesTags: (_r, _e, { id }) => [
        "Programs",
        { type: "Program", id },
      ],
    }),

    deleteProgram: build.mutation<void, string>({
      query: (id) => ({ url: `/programs/${id}`, method: "DELETE" }),
      invalidatesTags: ["Programs"],
    }),

    listEnrollments: build.query<ProgramEnrollment[], string>({
      query: (programId) => ({
        url: `/programs/${programId}/enrollments`,
        method: "GET",
      }),
      transformResponse: (
        res: ApiSuccess<{ enrollments: ProgramEnrollment[] }>
      ) => res.data.enrollments,
      providesTags: (_r, _e, programId) => [
        { type: "Enrollments", id: programId },
      ],
    }),

    listEnrollmentsPaged: build.query<
      { enrollments: ProgramEnrollment[]; meta: PageMeta },
      {
        programId: string;
        page?: number;
        limit?: number;
        search?: string;
        assessor?: "assigned" | "unassigned";
      }
    >({
      query: ({ programId, page, limit, search, assessor }) => ({
        url: `/programs/${programId}/enrollments/paged`,
        method: "GET",
        params: { page, limit, search, assessor },
      }),
      transformResponse: (res: ApiPaged<{ enrollments: ProgramEnrollment[] }>) => ({
        enrollments: res.data.enrollments,
        meta: res.meta,
      }),
      providesTags: (_r, _e, { programId }) => [
        { type: "Enrollments", id: programId },
      ],
    }),

    enrollFarmer: build.mutation<
      ProgramEnrollment,
      { programId: string; body: EnrollBody }
    >({
      query: ({ programId, body }) => ({
        url: `/programs/${programId}/enrollments`,
        method: "POST",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ enrollment: ProgramEnrollment }>) =>
        res.data.enrollment,
      invalidatesTags: (_r, _e, { programId }) => [
        { type: "Enrollments", id: programId },
        { type: "Program", id: programId },
        "Programs",
      ],
    }),

    updateEnrollmentFields: build.mutation<
      ProgramEnrollment,
      { programId: string; enrollmentId: string; fieldIds: string[] }
    >({
      query: ({ programId, enrollmentId, fieldIds }) => ({
        url: `/programs/${programId}/enrollments/${enrollmentId}`,
        method: "PATCH",
        data: { fieldIds },
      }),
      transformResponse: (res: ApiSuccess<{ enrollment: ProgramEnrollment }>) =>
        res.data.enrollment,
      invalidatesTags: (_r, _e, { programId }) => [
        { type: "Enrollments", id: programId },
      ],
    }),

    setEnrollmentAssessor: build.mutation<
      ProgramEnrollment,
      { programId: string; enrollmentId: string; assessorId: string | null }
    >({
      query: ({ programId, enrollmentId, assessorId }) => ({
        url: `/programs/${programId}/enrollments/${enrollmentId}/assessor`,
        method: "PUT",
        data: { assessorId },
      }),
      transformResponse: (res: ApiSuccess<{ enrollment: ProgramEnrollment }>) =>
        res.data.enrollment,
      invalidatesTags: (_r, _e, { programId }) => [
        { type: "Enrollments", id: programId },
      ],
    }),

    getEnrollmentAssessments: build.query<
      EnrollmentAssessments,
      { programId: string; enrollmentId: string }
    >({
      query: ({ programId, enrollmentId }) => ({
        url: `/programs/${programId}/enrollments/${enrollmentId}/assessments`,
        method: "GET",
      }),
      transformResponse: (res: ApiSuccess<EnrollmentAssessments>) => res.data,
    }),

    unenroll: build.mutation<
      void,
      { programId: string; enrollmentId: string }
    >({
      query: ({ programId, enrollmentId }) => ({
        url: `/programs/${programId}/enrollments/${enrollmentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { programId }) => [
        { type: "Enrollments", id: programId },
        { type: "Program", id: programId },
        "Programs",
      ],
    }),

    listSubmissions: build.query<
      { submissions: Submission[]; meta: PageMeta },
      ListSubmissionsParams
    >({
      query: (params) => ({ url: "/programs/submissions", method: "GET", params }),
      transformResponse: (res: ApiPaged<{ submissions: Submission[] }>) => ({
        submissions: res.data.submissions,
        meta: res.meta,
      }),
      providesTags: ["AssessmentReviews"],
    }),
  }),
});

export const {
  useListProgramsQuery,
  useGetProgramQuery,
  useLazySuggestProgramCodeQuery,
  useCreateProgramMutation,
  useUpdateProgramMutation,
  useSetProgramVisibilityMutation,
  useDeleteProgramMutation,
  useListEnrollmentsQuery,
  useListEnrollmentsPagedQuery,
  useEnrollFarmerMutation,
  useUpdateEnrollmentFieldsMutation,
  useSetEnrollmentAssessorMutation,
  useGetEnrollmentAssessmentsQuery,
  useUnenrollMutation,
  useListSubmissionsQuery,
} = programsApi;
