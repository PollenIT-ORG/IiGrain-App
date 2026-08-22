export type NotificationType =
  | 'new_program_available'
  | 'enrolled_in_program'
  | 'assessor_assigned'
  | 'assessor_visit_started'
  | 'assessment_submitted'
  | string;

export type NotificationScreenKey =
  | 'available_programs'
  | 'my_assessments'
  | 'assessment_history'
  | 'assessor_field_assessment'
  | 'assessment_comparison'
  | 'visit_tracking'
  | 'notifications'
  | string;

export interface NotificationRedirect {
  screen: NotificationScreenKey;
  fieldId?: string;
  programId?: string;
  enrollmentId?: string;
  visitId?: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  redirect: NotificationRedirect;
  read: boolean;
  readAtISO: string | null;
  createdAtISO: string;
}

export interface NotificationsPage {
  notifications: AppNotification[];
  unreadCount: number;
  page: number;
  totalPages: number;
  total: number;
}
