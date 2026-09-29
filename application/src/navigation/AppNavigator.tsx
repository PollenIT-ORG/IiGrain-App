import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';
import AppDrawer from './drawer/AppDrawer';
import AccountScreen from '../screens/account/AccountScreen';
import ReportsScreen from '../screens/reports/ReportsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import ChangePasswordScreen from '../screens/profile/ChangePasswordScreen';
import FarmDetailsScreen from '../screens/farms/FarmDetailsScreen';
import FieldDetailsScreen from '../screens/farms/FieldDetailsScreen';
import AddFarmScreen from '../screens/farms/AddFarmScreen';
import AddFieldScreen from '../screens/farms/AddFieldScreen';
import AssessmentFieldSummaryScreen from '../screens/assessment/AssessmentFieldSummaryScreen';
import AssessmentCategoryScreen from '../screens/assessment/AssessmentCategoryScreen';
import AssessmentQuestionDetailScreen from '../screens/assessment/AssessmentQuestionDetailScreen';
import AssessmentReviewScreen from '../screens/assessment/AssessmentReviewScreen';
import FarmerComparisonScreen from '../screens/assessment/FarmerComparisonScreen';
import FarmerVisitTrackingScreen from '../screens/home/FarmerVisitTrackingScreen';
import HelpScreen from '../screens/help/HelpScreen';
import ContactUsScreen from '../screens/support/ContactUsScreen';
import FieldMapScreen from '../screens/help/FieldMapScreen';
import BoundaryEditorScreen from '../screens/farms/BoundaryEditorScreen';
import MonitoringModuleScreen from '../screens/monitoring/MonitoringModuleScreen';
import MonitoringRecordScreen from '../screens/monitoring/MonitoringRecordScreen';
import MonitoringRecordFormScreen from '../screens/monitoring/MonitoringRecordFormScreen';
import SimpleMapScreen from '../screens/help/SimpleMapScreen';
import AndroidLinesScreen from '../screens/help/AndroidLinesScreen';
import AssessorNavigator from './AssessorNavigator';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import OnboardingWelcomeScreen from '../screens/onboarding/OnboardingWelcomeScreen';
import OnboardingChecklistScreen from '../screens/onboarding/OnboardingChecklistScreen';
import { useAppSelector } from '../redux/hooks';
import { selectAuthUser } from '../redux/slices/authSlice';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useSyncSettledRefresh } from '../hooks/useSyncSettledRefresh';
import { useFarmerVisitWatch } from '../hooks/useFarmerVisitWatch';
import type { AppStackParamList } from './navigationTypes';

enableScreens(true);

const Stack = createNativeStackNavigator<AppStackParamList>();

const AppNavigator: React.FC = () => {
  const user = useAppSelector(selectAuthUser);
  const isAssessor = user?.role === 'assessor';

  useRealtimeSync();
  useSyncSettledRefresh();
  useFarmerVisitWatch(!isAssessor);

  if (isAssessor) {
    return <AssessorNavigator />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Shell" component={AppDrawer} />
      <Stack.Screen name="OnboardingWelcome" component={OnboardingWelcomeScreen} />
      <Stack.Screen name="OnboardingChecklist" component={OnboardingChecklistScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="FarmDetails" component={FarmDetailsScreen} />
      <Stack.Screen name="FieldDetails" component={FieldDetailsScreen} />
      <Stack.Screen name="AddFarm" component={AddFarmScreen} />
      <Stack.Screen name="AddField" component={AddFieldScreen} />
      <Stack.Screen
        name="AssessmentFieldSummary"
        component={AssessmentFieldSummaryScreen}
      />
      <Stack.Screen name="AssessmentCategory" component={AssessmentCategoryScreen} />
      <Stack.Screen
        name="AssessmentQuestionDetail"
        component={AssessmentQuestionDetailScreen}
      />
      <Stack.Screen name="AssessmentReview" component={AssessmentReviewScreen} />
      <Stack.Screen name="FarmerComparison" component={FarmerComparisonScreen} />
      <Stack.Screen name="FarmerVisitTracking" component={FarmerVisitTrackingScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="ContactUs" component={ContactUsScreen} />
      <Stack.Screen name="FieldMap" component={FieldMapScreen} />
      <Stack.Screen name="BoundaryEditor" component={BoundaryEditorScreen} />
      <Stack.Screen name="MonitoringModule" component={MonitoringModuleScreen} />
      <Stack.Screen name="MonitoringRecord" component={MonitoringRecordScreen} />
      <Stack.Screen name="MonitoringRecordForm" component={MonitoringRecordFormScreen} />
      <Stack.Screen name="SimpleMap" component={SimpleMapScreen} />
      <Stack.Screen name="AndroidLines" component={AndroidLinesScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
