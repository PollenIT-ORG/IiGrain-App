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
    farmer: { submitted: boolean; percentage: number | null };
    assessor: { submitted: boolean; percentage: number | null };
  }>;
}

export interface AssessmentCategory {
  id: string;
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
  category_id: string;
  category_name: string;
  question_code: string | null;
  question_text: string;
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

// ---------------------------------------------------------------------------
// Field monitoring modules
// ---------------------------------------------------------------------------

/** The nine modules a field carries for one program. */
export type ModuleKey =
  | "training"
  | "soil_samples"
  | "irrigation"
  | "pesticide"
  | "fertilizer"
  | "tillage"
  | "amendment"
  | "crop"
  | "nutrient";

export type ModuleStatus = "in_progress" | "completed";

export type DocumentModule = ModuleKey | "other";

export type DocumentKind = "document" | "photo" | "lab_report" | "certificate";

/** Who and what the records on screen belong to. */
export interface FieldModuleContext {
  fieldId: string;
  fieldName: string;
  farmName: string;
  ownerId: string;
  programId: string;
  programName: string;
}

/** A record from any field of a farm, carrying which field it came from. */
export interface FarmModuleRecord extends ModuleRecord {
  field_name: string;
}

/** A program one farm has fields enrolled in, with those fields. */
export interface FarmProgram {
  programId: string;
  programName: string;
  startDate: string | null;
  fields: Array<{ fieldId: string; fieldName: string; areaAcres: number | null }>;
}

export interface ModuleSummary {
  module: ModuleKey;
  label: string;
  total: number;
  completed: number;
  documents: number;
}

/**
 * A record in any module. The shared columns are typed; the rest differ per
 * module and are read through the column registry rather than by name here.
 */
export interface ModuleRecord {
  id: string;
  field_id: string;
  program_id: string;
  status: ModuleStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Present on list responses, not on a single record. */
  document_count?: number;
  [column: string]: unknown;
}

export interface ModuleDocument {
  id: string;
  field_id: string;
  program_id: string;
  module: DocumentModule;
  record_id: string | null;
  kind: DocumentKind;
  name: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}
