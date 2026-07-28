import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { AxiosRequestConfig } from "axios";
import api, { getApiErrorMessage } from "../lib/api";

export interface AxiosBaseQueryArgs {
  url: string;
  method?: AxiosRequestConfig["method"];
  data?: unknown;
  params?: unknown;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface AxiosBaseQueryError {
  status?: number;
  message: string;
  // Field-level validation errors from the backend, so forms can show them
  // inline next to the offending input instead of only as a toast.
  fieldErrors?: FieldError[];
}

function extractFieldErrors(err: unknown): FieldError[] | undefined {
  if (typeof err !== "object" || err === null || !("response" in err)) return;
  const data = (err as { response?: { data?: unknown } }).response?.data;
  if (typeof data !== "object" || data === null || !("errors" in data)) return;
  const list = (data as { errors?: unknown }).errors;
  if (!Array.isArray(list)) return;
  const mapped = list
    .filter(
      (e): e is FieldError =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as FieldError).field === "string" &&
        typeof (e as FieldError).message === "string"
    )
    .map((e) => ({ field: e.field, message: e.message }));
  return mapped.length ? mapped : undefined;
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
          fieldErrors: extractFieldErrors(err),
        },
      };
    }
  };
