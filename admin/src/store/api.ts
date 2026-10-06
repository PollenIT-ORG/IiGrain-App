import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "./axiosBaseQuery";

export const TAG_TYPES = [
  "Users",
  "User",
  "Profile",
  "LoginLogs",
  "Organizations",
  "Organization",
  "Farms",
  "Farm",
  "Fields",
  "Field",
  "FieldSoil",
  "FieldDocuments",
  "FieldHistory",
  "AssessmentTemplates",
  "AssessmentTemplate",
  "AssessmentCategories",
  "AssessmentCategory",
  "AssessmentQuestions",
  "AssessmentQuestion",
  "AssessmentReviews",
  "AssessmentReview",
  "Assignments",
  "Programs",
  "Program",
  "Enrollments",
  "Config",
  "EmailSettings",
  "Dashboard",
  "Visits",
  "Notifications",
  "ScoringRules",
  "PasTemplates",
  "PasTemplate",
  "PasPrograms",
  "PasProgram",
  "PasSubmissions",
  "PasSubmission",
  "PasContracts",
  "PasContract",
  "Faqs",
  "ContactEnquiries",
] as const;

export type TagType = (typeof TAG_TYPES)[number];

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery(),
  // Resilience so no screen depends solely on a live-sync socket event that may
  // never arrive (a dropped/missed emit). These apply to EVERY query in the app:
  //  - refetchOnMountOrArgChange: landing on / revisiting a screen pulls fresh
  //    data from the server instead of serving possibly-stale cache.
  //  - refetchOnFocus: tabbing back to the window refetches.
  //  - refetchOnReconnect: the network coming back refetches.
  // Together with the socket invalidation, a change always surfaces - at worst on
  // the next mount, focus or reconnect - never lost until a hard reload.
  refetchOnMountOrArgChange: true,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: [...TAG_TYPES],
  endpoints: () => ({}),
});
