import { apiSlice } from "../api";
import type {
  ApiPaged,
  ApiSuccess,
  Organization,
  User,
  PageMeta,
} from "../../types";

export interface ListOrgsParams {
  page?: number;
  limit?: number;
  status?: "active" | "inactive";
  search?: string;
}

export interface CreateOrgBody {
  name: string;
  code: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  isActive?: boolean;
}

export type UpdateOrgBody = Partial<CreateOrgBody>;

export interface OrgDetail {
  organization: Organization;
  members: User[];
}

export const organizationsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    listOrganizations: build.query<
      { organizations: Organization[]; meta: PageMeta },
      ListOrgsParams
    >({
      query: (params) => ({ url: "/organizations", method: "GET", params }),
      transformResponse: (
        res: ApiPaged<{ organizations: Organization[] }>
      ) => ({
        organizations: res.data.organizations,
        meta: res.meta,
      }),
      providesTags: ["Organizations"],
    }),

    getOrganization: build.query<OrgDetail, string>({
      query: (id) => ({ url: `/organizations/${id}`, method: "GET" }),
      transformResponse: (res: ApiSuccess<OrgDetail>) => res.data,
      providesTags: (_r, _e, id) => [{ type: "Organization", id }],
    }),

    getCurrentOrganization: build.query<Organization | null, void>({
      query: () => ({ url: "/organizations/current", method: "GET" }),
      transformResponse: (res: ApiSuccess<{ organization: Organization | null }>) =>
        res.data.organization,
      providesTags: ["Organizations"],
    }),

    createOrganization: build.mutation<Organization, CreateOrgBody>({
      query: (body) => ({ url: "/organizations", method: "POST", data: body }),
      transformResponse: (res: ApiSuccess<{ organization: Organization }>) =>
        res.data.organization,
      invalidatesTags: ["Organizations"],
    }),

    updateOrganization: build.mutation<
      Organization,
      { id: string; body: UpdateOrgBody }
    >({
      query: ({ id, body }) => ({
        url: `/organizations/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ organization: Organization }>) =>
        res.data.organization,
      invalidatesTags: (_r, _e, { id }) => [
        "Organizations",
        { type: "Organization", id },
      ],
    }),

    deleteOrganization: build.mutation<void, string>({
      query: (id) => ({ url: `/organizations/${id}`, method: "DELETE" }),
      invalidatesTags: ["Organizations"],
    }),

    assignUserToOrg: build.mutation<User, { orgId: string; userId: string }>({
      query: ({ orgId, userId }) => ({
        url: `/organizations/${orgId}/users`,
        method: "POST",
        data: { userId },
      }),
      transformResponse: (res: ApiSuccess<{ user: User }>) => res.data.user,
      invalidatesTags: (_r, _e, { orgId }) => [
        "Organizations",
        { type: "Organization", id: orgId },
        "Users",
      ],
    }),

    removeUserFromOrg: build.mutation<void, { orgId: string; userId: string }>({
      query: ({ orgId, userId }) => ({
        url: `/organizations/${orgId}/users/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { orgId }) => [
        "Organizations",
        { type: "Organization", id: orgId },
        "Users",
      ],
    }),
  }),
});

export const {
  useListOrganizationsQuery,
  useGetOrganizationQuery,
  useGetCurrentOrganizationQuery,
  useCreateOrganizationMutation,
  useUpdateOrganizationMutation,
  useDeleteOrganizationMutation,
  useAssignUserToOrgMutation,
  useRemoveUserFromOrgMutation,
} = organizationsApi;
