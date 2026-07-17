import { apiSlice } from "../api";
import type { ApiPaged, LoginLog, PageMeta } from "../../types";

export const loginLogsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    listLoginLogs: build.query<
      { logs: LoginLog[]; meta: PageMeta },
      { page?: number; limit?: number }
    >({
      query: (params) => ({ url: "/login-logs", method: "GET", params }),
      transformResponse: (res: ApiPaged<{ logs: LoginLog[] }>) => ({
        logs: res.data.logs,
        meta: res.meta,
      }),
      providesTags: ["LoginLogs"],
    }),
  }),
});

export const { useListLoginLogsQuery } = loginLogsApi;
