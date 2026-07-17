import { apiSlice } from "../api";
import type { ApiPaged, ApiSuccess, Farm, PageMeta } from "../../types";

export interface ListFarmsParams {
  page?: number;
  limit?: number;
  status?: "active" | "inactive";
  ownerId?: string;
  orgId?: string;
  search?: string;
}

export interface CreateFarmBody {
  name: string;
  areaAcres?: number;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  ownerId: string;
  orgId?: string;
  isActive?: boolean;
}

export type UpdateFarmBody = Partial<CreateFarmBody>;

export const farmsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    listFarms: build.query<
      { farms: Farm[]; meta: PageMeta },
      ListFarmsParams
    >({
      query: (params) => ({ url: "/farms", method: "GET", params }),
      transformResponse: (res: ApiPaged<{ farms: Farm[] }>) => ({
        farms: res.data.farms,
        meta: res.meta,
      }),
      providesTags: ["Farms"],
    }),

    getFarm: build.query<Farm, string>({
      query: (id) => ({ url: `/farms/${id}`, method: "GET" }),
      transformResponse: (res: ApiSuccess<{ farm: Farm }>) => res.data.farm,
      providesTags: (_r, _e, id) => [{ type: "Farm", id }],
    }),

    createFarm: build.mutation<Farm, CreateFarmBody>({
      query: (body) => ({ url: "/farms", method: "POST", data: body }),
      transformResponse: (res: ApiSuccess<{ farm: Farm }>) => res.data.farm,
      invalidatesTags: ["Farms"],
    }),

    updateFarm: build.mutation<Farm, { id: string; body: UpdateFarmBody }>({
      query: ({ id, body }) => ({
        url: `/farms/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ farm: Farm }>) => res.data.farm,
      invalidatesTags: (_r, _e, { id }) => ["Farms", { type: "Farm", id }],
    }),

    deleteFarm: build.mutation<void, string>({
      query: (id) => ({ url: `/farms/${id}`, method: "DELETE" }),
      invalidatesTags: ["Farms"],
    }),
  }),
});

export const {
  useListFarmsQuery,
  useGetFarmQuery,
  useCreateFarmMutation,
  useUpdateFarmMutation,
  useDeleteFarmMutation,
} = farmsApi;
