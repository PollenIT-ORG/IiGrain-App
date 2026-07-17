export const Endpoints = {
  health: {
    liveness: '/health',
    readiness: '/health/db',
  },
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    requestOtp: '/auth/request-otp',
    verifyOtp: '/auth/verify-otp',
    refreshToken: '/auth/refresh-token',
    logout: '/auth/logout',
    forgotPassword: '/auth/forgot-password',
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
  },
  profile: {
    me: '/profile/me',
    changePassword: '/profile/change-password',
    organization: '/profile/organization',
  },
  farms: {
    myFarms: '/farms/me/farms',
    myFarm: (farmId: string): string => `/farms/me/farms/${farmId}`,
    fields: (farmId: string): string => `/farms/${farmId}/fields`,
    field: (farmId: string, fieldId: string): string =>
      `/farms/${farmId}/fields/${fieldId}`,
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

    summary: (fieldId: string): string =>
      `/assessments/my/fields/${fieldId}/summary`,

    categoryQuestions: (fieldId: string, categoryId: string): string =>
      `/assessments/my/fields/${fieldId}/categories/${categoryId}/questions/list`,

    question: (fieldId: string, categoryId: string, questionId: string): string =>
      `/assessments/my/fields/${fieldId}/categories/${categoryId}/questions/${questionId}`,

    saveAnswer: (fieldId: string, questionId: string): string =>
      `/assessments/my/fields/${fieldId}/questions/${questionId}/answer`,

    review: (fieldId: string): string =>
      `/assessments/my/fields/${fieldId}/review`,

    submit: (fieldId: string): string =>
      `/assessments/my/fields/${fieldId}/submit`,

    myFields: '/assessments/my/fields',
  },
  assessor: {
    fields: '/assessor/fields',

    summary: (fieldId: string): string => `/assessor/fields/${fieldId}/summary`,

    categoryQuestions: (fieldId: string, categoryId: string): string =>
      `/assessor/fields/${fieldId}/categories/${categoryId}/questions/list`,

    question: (fieldId: string, categoryId: string, questionId: string): string =>
      `/assessor/fields/${fieldId}/categories/${categoryId}/questions/${questionId}`,

    categoryQuestionsFull: (fieldId: string, categoryId: string): string =>
      `/assessor/fields/${fieldId}/categories/${categoryId}/questions`,

    saveAnswer: (fieldId: string, questionId: string): string =>
      `/assessor/fields/${fieldId}/questions/${questionId}/answer`,

    review: (fieldId: string): string => `/assessor/fields/${fieldId}/review`,

    submit: (fieldId: string): string => `/assessor/fields/${fieldId}/submit`,

    farmerAssessment: (fieldId: string): string =>
      `/assessor/fields/${fieldId}/farmer-assessment`,

    comparison: (fieldId: string): string => `/assessor/fields/${fieldId}/comparison`,
  },
  programs: {
    available: '/programs/my/available',
    enrollableFields: '/programs/my/fields',
    enrollSelf: (programId: string): string => `/programs/${programId}/enroll-self`,
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
