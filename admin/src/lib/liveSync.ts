import type { TagType } from "../store/api";

// What the server calls a change, as the backend sends it in "data:changed".
export type ChangedResource =
  | "enrollments"
  | "submissions"
  | "visits"
  | "assignments"
  | "dashboard"
  | "farms"
  | "fields"
  | "users"
  | "programs"
  | "organizations"
  | "eligibility"
  | "survey_questions"
  | "program_admin_survey"
  | "faqs"
  | "contact_enquiries"
  | "assessments"
  | "login_logs"
  | "email_settings";

// The cached data each kind of change makes out of date. Only what is on screen is loaded again.
export const TAGS_FOR: Record<ChangedResource, readonly TagType[]> = {
  enrollments: ["Enrollments", "Programs", "Program", "Dashboard", "Assignments", "AssessmentReviews"],
  submissions: ["AssessmentReviews", "AssessmentReview", "FieldHistory", "Field", "Program", "Programs", "Dashboard"],
  visits: ["Visits"],
  assignments: ["Assignments", "Users", "User", "Enrollments"],
  dashboard: ["Dashboard"],
  farms: ["Farms", "Farm", "Fields", "Dashboard"],
  fields: ["Fields", "Field", "FieldSoil", "FieldDocuments", "FieldHistory", "Farms", "Farm", "Dashboard"],
  users: ["Users", "User", "Profile", "Assignments", "Dashboard"],
  programs: [
    "Programs",
    "Program",
    "Enrollments",
    "Dashboard",
    "AssessmentTemplates",
    "AssessmentTemplate",
    "AssessmentCategories",
    "AssessmentQuestions",
    "PasPrograms",
  ],
  organizations: ["Organizations", "Organization", "Config"],
  eligibility: ["PasSubmissions", "PasSubmission"],
  survey_questions: ["ScoringRules"],
  program_admin_survey: [
    "PasTemplates",
    "PasTemplate",
    "PasPrograms",
    "PasProgram",
    "PasSubmissions",
    "PasSubmission",
    "PasContracts",
    "PasContract",
    "Programs",
    "Program",
    "Dashboard",
  ],
  faqs: ["Faqs"],
  contact_enquiries: ["ContactEnquiries"],
  assessments: [
    "AssessmentTemplates",
    "AssessmentTemplate",
    "AssessmentCategories",
    "AssessmentCategory",
    "AssessmentQuestions",
    "AssessmentQuestion",
    "AssessmentReviews",
    "AssessmentReview",
    "Programs",
    "Program",
    "Dashboard",
  ],
  login_logs: ["LoginLogs"],
  email_settings: ["EmailSettings", "Config"],
};

export function isChangedResource(value: unknown): value is ChangedResource {
  return typeof value === "string" && value in TAGS_FOR;
}
