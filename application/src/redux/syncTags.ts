export const Tags = {
  farms: 'farms',
  farm: (farmId: string): string => `farm:${farmId}`,
  fields: (farmId: string): string => `fields:${farmId}`,
  field: (fieldId: string): string => `field:${fieldId}`,
  soil: (fieldId: string): string => `soil:${fieldId}`,
  dashboard: 'dashboard',

  assessment: (programId: string, fieldId: string): string =>
    `assessment:${programId}:${fieldId}`,
  assessmentSummary: (fieldId: string): string => `assessment-summary:${fieldId}`,
  regen: (fieldId: string): string => `regen:${fieldId}`,
  myAssessments: 'my-assessments',
  assessmentHistory: 'assessment-history',

  programs: 'available-programs',
  enrollableFields: 'enrollable-fields',

  monitoring: (programId: string, fieldId: string): string =>
    `monitoring:${programId}:${fieldId}`,
  monitoringModule: (programId: string, fieldId: string, module: string): string =>
    `monitoring:${programId}:${fieldId}:${module}`,
  monitoringPrograms: (farmId: string): string => `monitoring-programs:${farmId}`,

  notifications: 'notifications',
  assessorOverview: 'assessor-overview',
} as const;

export interface SyncPayload {
  resource: 'assessment' | 'field' | 'farm' | 'soil' | 'enrollment' | 'document' | string;
  action: string;
  programId?: string;
  fieldId?: string;
  farmId?: string;
  categoryId?: string;
  questionId?: string;
  enrollmentId?: string;
  module?: string;
}

const compact = (tags: (string | null)[]): string[] =>
  tags.filter((t): t is string => typeof t === 'string' && t.length > 0);

export const tagsForSync = (p: SyncPayload): string[] => {
  switch (p.resource) {
    case 'assessment':
      return compact([
        p.programId && p.fieldId ? Tags.assessment(p.programId, p.fieldId) : null,
        p.fieldId ? Tags.assessmentSummary(p.fieldId) : null,
        p.fieldId ? Tags.regen(p.fieldId) : null,
        Tags.myAssessments,
        Tags.assessmentHistory,
        Tags.assessorOverview,
        Tags.dashboard,
      ]);

    case 'field':
      return compact([
        p.fieldId ? Tags.field(p.fieldId) : null,
        p.farmId ? Tags.fields(p.farmId) : null,
        p.farmId ? Tags.farm(p.farmId) : null,
        Tags.farms,
        Tags.dashboard,
        Tags.enrollableFields,
        Tags.programs,
      ]);

    case 'farm':
      return compact([
        p.farmId ? Tags.farm(p.farmId) : null,
        p.farmId ? Tags.fields(p.farmId) : null,
        Tags.farms,
        Tags.dashboard,
        Tags.enrollableFields,
        Tags.programs,
      ]);

    case 'soil':
      return compact([
        p.fieldId ? Tags.soil(p.fieldId) : null,
        p.fieldId ? Tags.field(p.fieldId) : null,
      ]);

    case 'enrollment':
      return compact([
        Tags.programs,
        Tags.enrollableFields,
        Tags.myAssessments,
        Tags.assessmentHistory,
        Tags.assessorOverview,
        Tags.farms,
        Tags.dashboard,
        p.fieldId ? Tags.field(p.fieldId) : null,
        p.fieldId ? Tags.soil(p.fieldId) : null,
        p.farmId ? Tags.monitoringPrograms(p.farmId) : null,
      ]);

    case 'document':
      return compact([p.fieldId ? Tags.field(p.fieldId) : null]);

    case 'monitoring':
      return compact([
        p.programId && p.fieldId ? Tags.monitoring(p.programId, p.fieldId) : null,
        p.programId && p.fieldId && p.module
          ? Tags.monitoringModule(p.programId, p.fieldId, p.module)
          : null,
      ]);

    default:
      return [];
  }
};
