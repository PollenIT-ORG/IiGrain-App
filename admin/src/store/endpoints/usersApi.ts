import { apiSlice } from "../api";
import type {
  ApiPaged,
  ApiSuccess,
  User,
  PageMeta,
  AssessorOption,
} from "../../types";

export interface ListUsersParams {
  page?: number;
  limit?: number;
  role?: string;
  status?: "active" | "inactive";
  search?: string;
  assessor?: "assigned" | "unassigned";
}

export interface CreateUserBody {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: string;
}

export interface UpdateUserBody {
  fullName?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
}

export const usersApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    listUsers: build.query<
      { users: User[]; meta: PageMeta },
      ListUsersParams
    >({
      query: (params) => ({ url: "/users", method: "GET", params }),
      transformResponse: (res: ApiPaged<{ users: User[] }>) => ({
        users: res.data.users,
        meta: res.meta,
      }),
      providesTags: ["Users"],
    }),

    getUser: build.query<User, string>({
      query: (id) => ({ url: `/users/${id}`, method: "GET" }),
      transformResponse: (res: ApiSuccess<{ user: User }>) => res.data.user,
      providesTags: (_r, _e, id) => [{ type: "User", id }],
    }),

    createUser: build.mutation<User, CreateUserBody>({
      query: (body) => ({ url: "/users", method: "POST", data: body }),
      transformResponse: (res: ApiSuccess<{ user: User }>) => res.data.user,
      invalidatesTags: ["Users"],
    }),

    updateUser: build.mutation<User, { id: string; body: UpdateUserBody }>({
      query: ({ id, body }) => ({
        url: `/users/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ user: User }>) => res.data.user,
      invalidatesTags: (_r, _e, { id }) => ["Users", { type: "User", id }],
    }),

    setUserStatus: build.mutation<User, { id: string; isActive: boolean }>({
      query: ({ id, isActive }) => ({
        url: `/users/${id}/status`,
        method: "PATCH",
        data: { isActive },
      }),
      transformResponse: (res: ApiSuccess<{ user: User }>) => res.data.user,
      invalidatesTags: (_r, _e, { id }) => ["Users", { type: "User", id }],
    }),

    deleteUser: build.mutation<void, string>({
      query: (id) => ({ url: `/users/${id}`, method: "DELETE" }),
      invalidatesTags: ["Users"],
    }),

    listAssessors: build.query<AssessorOption[], void>({
      query: () => ({ url: "/users/assessors", method: "GET" }),
      transformResponse: (res: ApiSuccess<{ assessors: AssessorOption[] }>) =>
        res.data.assessors,
    }),

    assignAssessor: build.mutation<User, { id: string; assessorId: string }>({
      query: ({ id, assessorId }) => ({
        url: `/users/${id}/assessor`,
        method: "PUT",
        data: { assessorId },
      }),
      transformResponse: (res: ApiSuccess<{ user: User }>) => res.data.user,
      invalidatesTags: (_r, _e, { id }) => ["Users", { type: "User", id }],
    }),

    unassignAssessor: build.mutation<User, string>({
      query: (id) => ({ url: `/users/${id}/assessor`, method: "DELETE" }),
      transformResponse: (res: ApiSuccess<{ user: User }>) => res.data.user,
      invalidatesTags: (_r, _e, id) => ["Users", { type: "User", id }],
    }),
  }),
});

export const {
  useListUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useSetUserStatusMutation,
  useDeleteUserMutation,
  useListAssessorsQuery,
  useAssignAssessorMutation,
  useUnassignAssessorMutation,
} = usersApi;
