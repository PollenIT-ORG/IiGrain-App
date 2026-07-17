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
  Assessment: { fieldId?: string } | undefined;
  Farms: undefined;
  More: undefined;
};

export type AppDrawerParamList = {
  MainTabs: NavigatorScreenParams<AppTabParamList>;
};

export type AppStackParamList = {
  Shell: NavigatorScreenParams<AppDrawerParamList>;
  EnrollNow: undefined;
  Account: undefined;
  Reports: { farmId?: string } | undefined;
  Profile: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  FarmDetails: { farmId: string };
  FieldDetails: { farmId: string; fieldId: string };
  AddFarm: { farmId?: string } | undefined;
  AddField: { farmId: string; farmName?: string; fieldId?: string };
  AssessmentCategory: { fieldId: string; categoryId: string; categoryName: string };
  AssessmentQuestionDetail: {
    fieldId: string;
    categoryId: string;
    questionId: string;
  };
  AssessmentReview: { fieldId: string; locked?: boolean };
  FarmerVisitTracking: { visitId?: string } | undefined;
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
  AssessorAssessmentSummary: { fieldId: string; fieldName?: string };
  AssessorCategory: { fieldId: string; categoryId: string; categoryName: string };
  AssessorQuestion: { fieldId: string; categoryId: string; questionId: string };
  AssessorReview: { fieldId: string };
  AssessorFarmerAssessment: { fieldId: string; fieldName?: string };
  AssessorComparison: { fieldId: string; fieldName?: string };
  AssessorVisit: { visitId?: string } | undefined;
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
