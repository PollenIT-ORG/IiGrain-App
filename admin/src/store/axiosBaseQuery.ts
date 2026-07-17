import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { AxiosRequestConfig } from "axios";
import api, { getApiErrorMessage } from "../lib/api";

export interface AxiosBaseQueryArgs {
  url: string;
  method?: AxiosRequestConfig["method"];
  data?: unknown;
  params?: unknown;
}

export interface AxiosBaseQueryError {
  status?: number;
  message: string;
}

export const axiosBaseQuery =
  (): BaseQueryFn<AxiosBaseQueryArgs, unknown, AxiosBaseQueryError> =>
  async ({ url, method = "GET", data, params }) => {
    try {
      const isFormData =
        typeof FormData !== "undefined" && data instanceof FormData;
      const result = await api({
        url,
        method,
        data,
        params,
        ...(isFormData
          ? { headers: { "Content-Type": undefined } as AxiosRequestConfig["headers"] }
          : {}),
      });
      return { data: result.data };
    } catch (err) {
      return {
        error: {
          status:
            typeof err === "object" && err && "response" in err
              ? (err as { response?: { status?: number } }).response?.status
              : undefined,
          message: getApiErrorMessage(err),
        },
      };
    }
  };
