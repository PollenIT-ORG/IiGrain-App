export const Endpoints = {
  health: {
    liveness: '/health',
    readiness: '/health/db',
  },
  auth: {
    register: '/auth/register',
    checkEmail: '/auth/check-email',
    login: '/auth/login',
    requestOtp: '/auth/request-otp',
    verifyOtp: '/auth/verify-otp',
    refreshToken: '/auth/refresh-token',
    logout: '/auth/logout',
    forgotPassword: '/auth/forgot-password',
    verifyResetCode: '/auth/verify-reset-code',
    resetPassword: '/auth/reset-password',
    me: '/auth/me',
  },
  roles: {
    list: '/roles',
  },
  visits: {
    start: '/visits',
    location: (visitId: string): string => `/visits/${visitId}/location`,
    arrive: (visitId: string): string => `/visits/${visitId}/arrive`,
    end: (visitId: string): string => `/visits/${visitId}/end`,
    mineAssessor: '/visits/mine/assessor',
    mineFarmer: '/visits/mine/farmer',
    byId: (visitId: string): string => `/visits/${visitId}`,
    track: (visitId: string): string => `/visits/${visitId}/track`,
  },
  profile: {
    me: '/profile/me',
    avatar: '/profile/me/avatar',
    changePassword: '/profile/change-password',
    organization: '/profile/organization',
  },
  farms: {
    myFarms: '/farms/me/farms',
    myFarm: (farmId: string): string => `/farms/me/farms/${farmId}`,
    resetMyFarm: (farmId: string): string => `/farms/me/farms/${farmId}/reset`,
    fields: (farmId: string): string => `/farms/${farmId}/fields`,
    field: (farmId: string, fieldId: string): string =>
      `/farms/${farmId}/fields/${fieldId}`,
    resetField: (farmId: string, fieldId: string): string =>
      `/farms/${farmId}/fields/${fieldId}/reset`,
    fieldBoundary: (farmId: string, fieldId: string): string =>
      `/farms/${farmId}/fields/${fieldId}/boundary`,
  },
  dashboard: {
    farms: '/dashboard/my/farms',
    farm: (farmId: string): string => `/dashboard/my/farms/${farmId}`,
  },
  fields: {
    details: (fieldId: string): string => `/fields/${fieldId}/details`,
    soil: (fieldId: string): string => `/fields/${fieldId}/soil`,
    documents: (fieldId: string): string => `/fields/${fieldId}/documents`,
    document: (fieldId: string, documentId: string): string =>
      `/fields/${fieldId}/documents/${documentId}`,
  },
  assessment: {
    uploadEvidence: '/assessments/evidence',

    summary: (programId: string, fieldId: string): string =>
      `/assessments/my/programs/${programId}/fields/${fieldId}/summary`,

    categoryQuestions: (programId: string, fieldId: string, categoryId: string): string =>
      `/assessments/my/programs/${programId}/fields/${fieldId}/categories/${categoryId}/questions/list`,

    question: (
      programId: string,
      fieldId: string,
      categoryId: string,
      questionId: string,
    ): string =>
      `/assessments/my/programs/${programId}/fields/${fieldId}/categories/${categoryId}/questions/${questionId}`,

    saveAnswer: (programId: string, fieldId: string, questionId: string): string =>
      `/assessments/my/programs/${programId}/fields/${fieldId}/questions/${questionId}/answer`,

    review: (programId: string, fieldId: string): string =>
      `/assessments/my/programs/${programId}/fields/${fieldId}/review`,

    submit: (programId: string, fieldId: string): string =>
      `/assessments/my/programs/${programId}/fields/${fieldId}/submit`,

    discard: (programId: string, fieldId: string): string =>
      `/assessments/my/programs/${programId}/fields/${fieldId}/discard`,

    myFields: '/assessments/my/fields',

    myHistory: '/assessments/my/history',

    regenIndex: (programId: string, fieldId: string): string =>
      `/assessments/my/programs/${programId}/fields/${fieldId}/regen-index`,
  },
  assessor: {
    fields: '/assessor/fields',

    summary: (programId: string, fieldId: string): string =>
      `/assessor/programs/${programId}/fields/${fieldId}/summary`,

    categoryQuestions: (programId: string, fieldId: string, categoryId: string): string =>
      `/assessor/programs/${programId}/fields/${fieldId}/categories/${categoryId}/questions/list`,

    question: (
      programId: string,
      fieldId: string,
      categoryId: string,
      questionId: string,
    ): string =>
      `/assessor/programs/${programId}/fields/${fieldId}/categories/${categoryId}/questions/${questionId}`,

    categoryQuestionsFull: (programId: string, fieldId: string, categoryId: string): string =>
      `/assessor/programs/${programId}/fields/${fieldId}/categories/${categoryId}/questions`,

    saveAnswer: (programId: string, fieldId: string, questionId: string): string =>
      `/assessor/programs/${programId}/fields/${fieldId}/questions/${questionId}/answer`,

    review: (programId: string, fieldId: string): string =>
      `/assessor/programs/${programId}/fields/${fieldId}/review`,

    submit: (programId: string, fieldId: string): string =>
      `/assessor/programs/${programId}/fields/${fieldId}/submit`,

    farmerAssessment: (programId: string, fieldId: string): string =>
      `/assessor/programs/${programId}/fields/${fieldId}/farmer-assessment`,

    comparison: (programId: string, fieldId: string): string =>
      `/assessor/programs/${programId}/fields/${fieldId}/comparison`,
  },
  programs: {
    available: '/programs/my/available',
    enrollableFields: '/programs/my/fields',
    enrollSelf: (programId: string): string => `/programs/${programId}/enroll-self`,
    unenrollField: (programId: string, fieldId: string): string =>
      `/programs/${programId}/fields/${fieldId}/unenroll`,
  },
  fieldMonitoring: {
    farmPrograms: (farmId: string): string =>
      `/field-monitoring/farms/${farmId}/programs`,

    modules: (programId: string, fieldId: string): string =>
      `/field-monitoring/programs/${programId}/fields/${fieldId}/modules`,

    records: (programId: string, fieldId: string, module: string): string =>
      `/field-monitoring/programs/${programId}/fields/${fieldId}/modules/${module}`,

    record: (
      programId: string,
      fieldId: string,
      module: string,
      recordId: string,
    ): string =>
      `/field-monitoring/programs/${programId}/fields/${fieldId}/modules/${module}/${recordId}`,

    documents: (programId: string, fieldId: string): string =>
      `/field-monitoring/programs/${programId}/fields/${fieldId}/documents`,

    documentUpload: (programId: string, fieldId: string): string =>
      `/field-monitoring/programs/${programId}/fields/${fieldId}/documents/upload`,

    document: (programId: string, fieldId: string, documentId: string): string =>
      `/field-monitoring/programs/${programId}/fields/${fieldId}/documents/${documentId}`,
  },
  notifications: {
    list: '/notifications',
    unreadCount: '/notifications/unread-count',
    markRead: (id: string): string => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
    remove: (id: string): string => `/notifications/${id}`,
    removeMany: '/notifications/delete',
    removeAll: '/notifications',
  },
} as const;

export const PUBLIC_AUTH_PATHS: readonly string[] = [
  Endpoints.auth.register,
  Endpoints.auth.login,
  Endpoints.auth.requestOtp,
  Endpoints.auth.verifyOtp,
  Endpoints.auth.refreshToken,
  Endpoints.auth.logout,
  Endpoints.auth.forgotPassword,
  Endpoints.auth.verifyResetCode,
  Endpoints.auth.resetPassword,
  Endpoints.roles.list,
  Endpoints.health.liveness,
  Endpoints.health.readiness,
];

export const isPublicAuthPath = (url: string | undefined): boolean => {
  if (!url) {
    return false;
  }
  return PUBLIC_AUTH_PATHS.some(path => url.includes(path));
};
