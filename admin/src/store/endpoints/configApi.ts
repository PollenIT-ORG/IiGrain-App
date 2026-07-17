import { apiSlice } from "../api";
import type { ApiSuccess } from "../../types";

interface AppConfig {
  saasEnabled: boolean;
}

export const configApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getConfig: build.query<AppConfig, void>({
      query: () => ({ url: "/config", method: "GET" }),
      transformResponse: (res: ApiSuccess<AppConfig>) => res.data,
      providesTags: ["Config"],
    }),
  }),
});

export const { useGetConfigQuery } = configApi;
