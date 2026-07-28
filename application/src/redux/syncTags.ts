/**
 * Cache tags — the vocabulary shared by the socket layer and the screens.
 *
 * A screen declares which tags its data depends on (via `useSyncedFetch`); the
 * socket bumps those tags when the server says the underlying data changed. A
 * screen refetches only when one of its tags moved (or its TTL lapsed), which is
 * what stops every screen open / tab switch from hitting the API.
 *
 * Keep tag strings out of screens — always go through this module so a typo
 * cannot silently disconnect a screen from its invalidations.
 */
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

  notifications: 'notifications',
  assessorOverview: 'assessor-overview',
} as const;

/** The `sync` payload the server emits. See backend/hoppscotch/sockets/README.md. */
export interface SyncPayload {
  resource: 'assessment' | 'field' | 'farm' | 'soil' | 'enrollment' | 'document' | string;
  action: string;
  programId?: string;
  fieldId?: string;
  farmId?: string;
  categoryId?: string;
  questionId?: string;
  enrollmentId?: string;
}

const compact = (tags: (string | null)[]): string[] =>
  tags.filter((t): t is string => typeof t === 'string' && t.length > 0);

/**
 * Maps one `sync` event to the tags it invalidates.
 *
 * Deliberately broad: the payload is a "something changed" signal, and an extra
 * tag costs at most one refetch on a screen the user actually has open, while a
 * missing tag leaves stale data on screen. Ids are optional in the payload, so
 * every id-scoped tag is emitted only when its id is present — the list-level
 * tags cover the rest.
 */
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
        // A score change moves the farm's Regen Health Index on the dashboard.
        Tags.dashboard,
      ]);

    case 'field':
      return compact([
        p.fieldId ? Tags.field(p.fieldId) : null,
        p.farmId ? Tags.fields(p.farmId) : null,
        p.farmId ? Tags.farm(p.farmId) : null,
        Tags.farms,
        Tags.dashboard,
        // Adding/removing a field changes what can be enrolled.
        Tags.enrollableFields,
      ]);

    case 'farm':
      return compact([
        p.farmId ? Tags.farm(p.farmId) : null,
        p.farmId ? Tags.fields(p.farmId) : null,
        Tags.farms,
        Tags.dashboard,
        Tags.enrollableFields,
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
        // Enrolling unlocks the soil nutrient inputs, so any cached soil tab is
        // showing a stale lock.
        p.fieldId ? Tags.soil(p.fieldId) : null,
      ]);

    case 'document':
      return compact([p.fieldId ? Tags.field(p.fieldId) : null]);

    default:
      return [];
  }
};
