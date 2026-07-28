import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { DrawerScreenProps } from '@react-navigation/drawer';

export type AuthStackParamList = {
  Authentication: { mode?: 'login' | 'signup' } | undefined;
  Role: { fullName: string; email: string; phone: string; password: string };
  Otp: { email: string; code?: string; mode?: 'verify' | 'login' | 'reset' };
  ForgotPassword: undefined;
  ResetPassword: { email: string; code: string };
};

export type AppTabParamList = {
  Home: undefined;
  Assessment: { fieldId?: string; programId?: string } | undefined;
  // Driven by the tab bar's centre action button rather than a tab of its own,
  // so the tab bar stays visible while enrolling.
  EnrollNow: undefined;
  Farms: undefined;
  More: undefined;
};

export type AppDrawerParamList = {
  MainTabs: NavigatorScreenParams<AppTabParamList>;
};

export type AppStackParamList = {
  Shell: NavigatorScreenParams<AppDrawerParamList>;
  Notifications: undefined;
  Account: undefined;
  Reports: { farmId?: string } | undefined;
  Profile: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  FarmDetails: { farmId: string };
  FieldDetails: { farmId: string; fieldId: string };
  AddFarm: { farmId?: string } | undefined;
  AddField: { farmId: string; farmName?: string; fieldId?: string };
  AssessmentCategory: {
    programId: string;
    fieldId: string;
    categoryId: string;
    categoryName: string;
  };
  AssessmentQuestionDetail: {
    programId: string;
    fieldId: string;
    categoryId: string;
    questionId: string;
  };
  AssessmentFieldSummary: {
    programId: string;
    fieldId: string;
    /** Shown in the header until the summary loads its real title. */
    fieldName?: string;
  };
  AssessmentReview: { programId: string; fieldId: string; locked?: boolean };
  FarmerVisitTracking: { visitId?: string } | undefined;
  /** Reached from More → Help. Hosts the self-service tools. */
  Help: undefined;
  /**
   * Map of every farm the user owns that has coordinates saved.
   * `focusFarmId` opens the map already centred on — and with the card open for
   * — that farm, so the screen can also be linked to from a farm detail page.
   */
  FieldMap: { focusFarmId?: string } | undefined;
  PolygonDebugScreen: undefined;
  
  /**
   * Full-screen satellite boundary editor for one field. Opened from
   * FieldDetails. `fieldName` seeds the header until the field data loads.
   * See docs/maps/FarmBoundary/.
   */
  BoundaryEditor: { farmId: string; fieldId: string; fieldName?: string };
  /** ⚠️ DEBUG ONLY — minimal map + one polyline (A→B). */
  SimpleMap: undefined;
};

export type AssessorTabParamList = {
  AssessorHome: undefined;
  AssessorFarmers: undefined;
  AssessorHistory: undefined;
  AssessorMore: undefined;
};

export type AssessorStackParamList = {
  AssessorShell: NavigatorScreenParams<AssessorTabParamList> | undefined;
  AssessorFarmerDetail: { farmerId: string; farmerName?: string };
  AssessorFarmDetail: { farmId: string; farmName?: string };
  AssessorAssessmentSummary: { programId: string; fieldId: string; fieldName?: string };
  AssessorCategory: {
    programId: string;
    fieldId: string;
    categoryId: string;
    categoryName: string;
  };
  AssessorQuestion: {
    programId: string;
    fieldId: string;
    categoryId: string;
    questionId: string;
  };
  AssessorReview: { programId: string; fieldId: string };
  AssessorFarmerAssessment: { programId: string; fieldId: string; fieldName?: string };
  AssessorComparison: { programId: string; fieldId: string; fieldName?: string };
  AssessorVisit: { visitId?: string } | undefined;
  Notifications: undefined;
  Account: undefined;
  Profile: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
};

export type AssessorScreenProps<T extends keyof AssessorStackParamList> =
  NativeStackScreenProps<AssessorStackParamList, T>;

export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type AppScreenProps<T extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, T>;

export type AppDrawerProps<T extends keyof AppDrawerParamList> =
  DrawerScreenProps<AppDrawerParamList, T>;

export type TabScreenProps<T extends keyof AppTabParamList> =
  BottomTabScreenProps<AppTabParamList, T>;
