import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AssessorTabNavigator from './AssessorTabNavigator';
import AssessorFarmerDetailScreen from '../screens/assessor/AssessorFarmerDetailScreen';
import AssessorFarmDetailScreen from '../screens/assessor/AssessorFarmDetailScreen';
import AssessorAssessmentSummaryScreen from '../screens/assessor/AssessorAssessmentSummaryScreen';
import AssessorCategoryScreen from '../screens/assessor/AssessorCategoryScreen';
import AssessorQuestionScreen from '../screens/assessor/AssessorQuestionScreen';
import AssessorReviewScreen from '../screens/assessor/AssessorReviewScreen';
import AssessorFarmerAssessmentScreen from '../screens/assessor/AssessorFarmerAssessmentScreen';
import AssessorComparisonScreen from '../screens/assessor/AssessorComparisonScreen';
import AssessorVisitScreen from '../screens/assessor/AssessorVisitScreen';
import AccountScreen from '../screens/account/AccountScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import ChangePasswordScreen from '../screens/profile/ChangePasswordScreen';
import { useAssessorVisitStream } from '../hooks/useAssessorVisitStream';
import type { AssessorStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<AssessorStackParamList>();

const AssessorNavigator: React.FC = () => {
  useAssessorVisitStream();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AssessorShell" component={AssessorTabNavigator} />
      <Stack.Screen name="AssessorFarmerDetail" component={AssessorFarmerDetailScreen} />
      <Stack.Screen name="AssessorFarmDetail" component={AssessorFarmDetailScreen} />
      <Stack.Screen name="AssessorAssessmentSummary" component={AssessorAssessmentSummaryScreen} />
      <Stack.Screen name="AssessorCategory" component={AssessorCategoryScreen} />
      <Stack.Screen name="AssessorQuestion" component={AssessorQuestionScreen} />
      <Stack.Screen name="AssessorReview" component={AssessorReviewScreen} />
      <Stack.Screen name="AssessorFarmerAssessment" component={AssessorFarmerAssessmentScreen} />
      <Stack.Screen name="AssessorComparison" component={AssessorComparisonScreen} />
      <Stack.Screen name="AssessorVisit" component={AssessorVisitScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </Stack.Navigator>
  );
};

export default AssessorNavigator;
