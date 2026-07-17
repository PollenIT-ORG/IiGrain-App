import { apiSlice } from "../api";
import type { ApiSuccess, User } from "../../types";

export const profileApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getMyProfile: build.query<User, void>({
      query: () => ({ url: "/profile/me", method: "GET" }),
      transformResponse: (res: ApiSuccess<{ user: User }>) => res.data.user,
      providesTags: ["Profile"],
    }),

    updateMyProfile: build.mutation<
      User,
      { fullName?: string; phone?: string }
    >({
      query: (body) => ({ url: "/profile/me", method: "PATCH", data: body }),
      transformResponse: (res: ApiSuccess<{ user: User }>) => res.data.user,
      invalidatesTags: ["Profile"],
    }),

    changePassword: build.mutation<
      void,
      { currentPassword: string; newPassword: string }
    >({
      query: (body) => ({
        url: "/profile/change-password",
        method: "POST",
        data: body,
      }),
    }),

    deleteMyAccount: build.mutation<void, void>({
      query: () => ({ url: "/profile/me", method: "DELETE" }),
    }),
  }),
});

export const {
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useChangePasswordMutation,
  useDeleteMyAccountMutation,
} = profileApi;
