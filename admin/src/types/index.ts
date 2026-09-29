import type { GeoJSONPolygon } from "../lib/geo";

export type { GeoJSONPolygon };

export interface AuthUser {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  role: string;
}

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface LoginData {
  token: string;
  refreshToken: string;
  user: AuthUser;
}

export interface LoginLog {
  id: string;
  email: string;
  method: "password" | "otp";
  status: "success" | "failed";
  ip_address: string | null;
  reason: string | null;
  created_at: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiPaged<T> {
  success: true;
  message: string;
  data: T;
  meta: PageMeta;
}

export type UserRole =
  | "super_admin"
  | "admin"
  | "program_administrator"
  | "program_partner"
  | "assessor"
  | "farmer";

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  program_administrator: "Program Administrator",
  program_partner: "Program Partner",
  assessor: "Assessor",
  farmer: "Farmer",
};

// Roles allowed to sign in to this management panel. Must stay in step with the
// backend, where these three are the org-manager roles guarding the admin routes.
export const ADMIN_PANEL_ROLES: UserRole[] = [
  "super_admin",
  "admin",
  "program_administrator",
];

export function canUseAdminPanel(role: string): boolean {
  return (ADMIN_PANEL_ROLES as string[]).includes(role);
}

export interface AssignedAssessor {
  assignmentId: string;
  assessorId: string;
  assessorName: string | null;
  assessorEmail: string;
}

export interface User {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  is_email_verified: boolean;
  /** True while the temporary password we emailed is still in place. */
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_assessor?: AssignedAssessor | null;
}

export interface AssessorOption {
  id: string;
  full_name: string | null;
  email: string;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_hours: string | null;
  address: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  /** The timezone and clock every date in the panel is shown with. */
  timezone: string;
  time_format: "12h" | "24h";
  is_active: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface Farm {
  id: string;
  name: string;
  area_acres: string | null;
  location: string | null;
  business_entity: string | null;
  latitude: number | null;
  longitude: number | null;
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  org_id: string | null;
  org_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  used_area?: string;
  available_area?: string | null;
  field_count?: number;
}

export interface ComparisonSide {
  submitted: boolean;
  submittedAt: string | null;
  percentage: number | null;
}

export interface AssessmentComparison {
  field: { id: string; name: string };
  farmer: ComparisonSide;
  assessor: ComparisonSide;
  categories: Array<{
    id: string;
    name: string;
    questions: Array<{
      id: string;
      questionCode: string | null;
      questionText: string;
      maxScore: number;
      // What each side answered, written out by the server.
      farmerAnswer: string | null;
      assessorAnswer: string | null;
      // How many records each side filled in for this form.
      farmerRecords: number;
      assessorRecords: number;
      farmerAnswered: boolean;
      assessorAnswered: boolean;
      farmerScore: number | null;
      assessorScore: number | null;
      difference: number | null;
    }>;
  }>;
}

export interface Program {
  id: string;
  org_id: string;
  org_name: string | null;
  name: string;
  code: string | null;
  description: string | null;
  type: string | null;
  start_date: string | null;
  end_date: string | null;
  user_limit: number | null;
  is_active: boolean;
  // Whether the program is offered to farmers already on the platform.
  show_to_farmers: boolean;
  // A program cannot be shown to farmers until it has a survey to send them to.
  has_survey: boolean;
  created_by: string | null;
  enrolled_count: number;
  // The program's own copy of an assessment template, and the template it was copied from.
  assessment_template_id: string;
  assessment_template_name: string;
  // Null when the program started blank.
  assessment_source_template_id: string | null;
  // Only on the single program read: false once anything has been answered.
  assessment_template_changeable?: boolean;
  created_at: string;
  updated_at: string;
}

export interface EnrollmentField {
  id: string;
  field_id: string;
  field_name: string;
  /** Needed by the farm workbook, which lists every field with its size. */
  area_acres: number | null;
  farm_name: string | null;
}

export interface ProgramEnrollment {
  id: string;
  program_id: string;
  farmer_id: string;
  /** What the farmer quotes when they call about this program. */
  enrollment_id: string | null;
  farmer_name: string | null;
  farmer_email: string;
  assessor_id: string | null;
  assessor_name: string | null;
  assessor_email: string | null;
  enrolled_by: string | null;
  status: string;
  note: string | null;
  enrolled_at: string;
  fields: EnrollmentField[];
  created_at: string;
  updated_at: string;
}

export interface Submission {
  assessmentId: string;
  reviewStatus: "in_review" | "approved";
  fieldId: string;
  fieldName: string;
  farmName: string | null;
  farmerId: string;
  farmerName: string | null;
  authorRole: "farmer" | "assessor";
  authorId: string | null;
  authorName: string | null;
  programId: string | null;
  programName: string | null;
  answered: number;
  totalQuestions: number;
  percentage: number;
  submittedAt: string | null;
}

/** One side of a field's assessment, with the id its review screen opens on. */
export interface EnrollmentAssessmentSide {
  submitted: boolean;
  percentage: number | null;
  assessmentId: string | null;
  reviewStatus: "in_review" | "approved" | null;
}

export interface EnrollmentAssessments {
  enrollment: {
    id: string;
    farmer_id: string;
    farmer_name: string | null;
    assessor_id: string | null;
    assessor_name: string | null;
  };
  fields: Array<{
    field: { id: string; name: string; farm_name: string | null };
    farmer: EnrollmentAssessmentSide;
    assessor: EnrollmentAssessmentSide;
  }>;
}

// "scored" is the 0 to 3 question older templates hold. A new question is
// either multiple choice, or one of the fields an input based form asks for.
export type QuestionType =
  | "scored"
  | "mcq"
  | "text"
  | "long_text"
  | "number"
  | "date"
  | "boolean";

/** What a template holds, and what a question asks for alongside the answer. */
export type QuestionKind = "mcq" | "input";

export type AnswerExtra = "off" | "optional" | "required";

export interface QuestionOption {
  id: string;
  option_text: string;
  score: number;
  sort_order: number;
}

export interface AssessmentTemplate {
  id: string;
  owner_id: string | null;
  is_global: boolean;
  // Set only on a program's own copy.
  program_id: string | null;
  program_name: string | null;
  copied_from_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  category_count: number;
  question_count: number;
  active_question_count: number;
  linked_program_count: number;
  // What the template was set up to hold, and what it holds right now.
  question_kind: QuestionKind | null;
  kind: QuestionKind | "mixed" | null;
  // True once an assessment was submitted in a program using it, or an admin locked it.
  locked: boolean;
  has_submissions: boolean;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssessmentReview {
  id: string;
  field: { id: string; name: string; farmName: string };
  program: { id: string; name: string };
  author: { id: string | null; name: string | null; role: "farmer" | "assessor" };
  totalQuestions: number;
  answered: number;
  // Answers still waiting for a score.
  unscored: number;
  // Everything this assessment can score, for a score given as a whole.
  possibleScore: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  reviewStatus: "in_review" | "approved";
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
}

export interface AssessmentReviewAnswer {
  id: string;
  // Which filling of the form the answer is from; null for multiple choice.
  recordId: string | null;
  questionCode: string | null;
  questionText: string;
  guidanceNote: string | null;
  questionType: QuestionType;
  maxScore: number;
  evidenceMode: AnswerExtra;
  commentMode: AnswerExtra;
  options: { id: string; text: string; score: number }[];
  answered: boolean;
  answerScore: number | null;
  answerOptionId: string | null;
  answerOptionText: string | null;
  answerText: string | null;
  answerNumber: number | null;
  answerDate: string | null;
  answerBoolean: boolean | null;
  answerComment: string | null;
  answerEvidenceUrls: string[];
  reviewScore: number | null;
  finalScore: number | null;
}

export interface AssessmentReviewDetail {
  review: AssessmentReview;
  categories: Array<{
    id: string;
    name: string;
    // Everything this category can score, for a score given per category.
    possibleScore: number;
    // Each filling of the form; one with no id for a multiple choice category.
    records: Array<{
      id: string | null;
      number: number | null;
      // The evidence uploaded at the end of the form.
      evidenceUrls: string[];
      questions: AssessmentReviewAnswer[];
    }>;
    questions: AssessmentReviewAnswer[];
  }>;
}

export interface AssessmentImportProblem {
  // Where it went wrong: "Row 7", or "Trainings, column B" in a form.
  where: string;
  message: string;
}

export interface AssessmentImportResult {
  created: number;
  skipped: number;
  problems: AssessmentImportProblem[];
}

export interface AssessmentCategory {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  question_count: number;
  created_at: string;
  updated_at: string;
}

export interface AssessmentQuestion {
  id: string;
  template_id: string;
  category_id: string;
  category_name: string;
  question_code: string | null;
  question_text: string;
  question_type: QuestionType;
  max_score: number;
  evidence_mode: AnswerExtra;
  comment_mode: AnswerExtra;
  options: QuestionOption[];
  guidance_note: string | null;
  score0_description: string | null;
  score1_description: string | null;
  score2_description: string | null;
  score3_description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Field {
  id: string;
  farm_id: string;
  farm_name: string;
  name: string;
  area_acres: string | null;
  crop: string | null;
  season: string | null;
  irrigation: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  sowing_date: string | null;
  expected_harvest: string | null;
  boundary: GeoJSONPolygon | null;
  boundary_updated_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FieldSoil {
  id: string;
  field_id: string;
  ph: string | null;
  organic_matter: string | null;
  nitrogen: string | null;
  phosphorus: string | null;
  potassium: string | null;
  moisture: string | null;
  texture: string | null;
  notes: string | null;
  tested_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface FieldDocument {
  id: string;
  field_id: string;
  name: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FieldHistoryEvent {
  type: "assessment_submitted" | "field_created" | "field_updated";
  title: string;
  detail: string | null;
  at: string;
  meta: Record<string, unknown> | null;
}

export interface Assignment {
  id: string;
  assessor_id: string;
  assessor_name: string | null;
  assessor_email: string;
  farmer_id: string;
  farmer_name: string | null;
  farmer_email: string;
  assigned_by: string | null;
  org_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// Help screen: the questions the app shows, written here.
export interface Faq {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// A reply the office emailed back, kept so the thread reads in order.
export interface ContactEnquiryReply {
  id: string;
  enquiry_id: string;
  to_email: string;
  subject: string;
  message: string;
  sent_by: string | null;
  sent_by_name: string | null;
  created_at: string;
}

// What somebody sent through the Contact Us form in the app.
export interface ContactEnquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: boolean;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}
