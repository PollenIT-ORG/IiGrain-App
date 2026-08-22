import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { ModuleKey } from '../types/monitoring';

export type AuthStackParamList = {
  Authentication:
    | {
        mode?: 'login' | 'signup';
        enrollmentError?: string;
      }
    | undefined;
  Role: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    enrollmentId: string;
  };
  Otp: { email: string; code?: string; mode?: 'verify' | 'login' | 'reset' };
  ForgotPassword: undefined;
  ResetPassword: { email: string; code: string };
};

export type AppTabParamList = {
  Home: undefined;
  Assessment: { fieldId?: string; programId?: string } | undefined;
  EnrollNow: undefined;
  Farms: undefined;
  More: undefined;
};

export type AppDrawerParamList = {
  MainTabs: NavigatorScreenParams<AppTabParamList>;
};

export type AppStackParamList = {
  Shell: NavigatorScreenParams<AppDrawerParamList>;

  OnboardingWelcome: undefined;
  OnboardingChecklist: undefined;
  OnboardingProgramInfo: undefined;
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
    fieldName?: string;
  };
  AssessmentReview: { programId: string; fieldId: string; locked?: boolean };
  FarmerVisitTracking: { visitId?: string } | undefined;
  Help: undefined;
  FieldMap: { focusFarmId?: string } | undefined;
  PolygonDebugScreen: undefined;

  BoundaryEditor: { farmId: string; fieldId: string; fieldName?: string };
  SimpleMap: undefined;
  AndroidLines: undefined;

  MonitoringModule: {
    programId: string;
    fieldId: string;
    module: ModuleKey;
    farmId?: string;
    fieldName?: string;
    programName?: string;
  };
  MonitoringRecord: {
    programId: string;
    fieldId: string;
    module: ModuleKey;
    recordId: string;
    farmId?: string;
    fieldName?: string;
    programName?: string;
  };
  MonitoringRecordForm: {
    programId: string;
    fieldId: string;
    module: ModuleKey;
    recordId?: string;
    farmId?: string;
    fieldName?: string;
    programName?: string;
  };
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
  AssessorReview: { programId: string; fieldId: string; locked?: boolean };
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
