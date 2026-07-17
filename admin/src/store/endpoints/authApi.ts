import { apiSlice } from "../api";
import { getRefreshToken } from "../../lib/api";
import type { ApiSuccess, LoginData } from "../../types";

export const authApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<
      LoginData,
      { email: string; password: string }
    >({
      query: (body) => ({ url: "/auth/login", method: "POST", data: body }),
      transformResponse: (res: ApiSuccess<LoginData>) => res.data,
    }),

    logout: build.mutation<void, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
        data: { refreshToken: getRefreshToken() },
      }),
    }),

    forgotPassword: build.mutation<void, { email: string }>({
      query: (body) => ({
        url: "/auth/forgot-password",
        method: "POST",
        data: body,
      }),
    }),

    resetPassword: build.mutation<
      void,
      { email: string; code: string; newPassword: string }
    >({
      query: (body) => ({
        url: "/auth/reset-password",
        method: "POST",
        data: body,
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = authApi;
