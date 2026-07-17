import React from 'react';
import { LogBox } from 'react-native';
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
import AssessmentCategoryScreen from '../screens/assessment/AssessmentCategoryScreen';
import AssessmentQuestionDetailScreen from '../screens/assessment/AssessmentQuestionDetailScreen';
import AssessmentReviewScreen from '../screens/assessment/AssessmentReviewScreen';
import EnrollNowScreen from '../screens/enroll/EnrollNowScreen';
import FarmerVisitTrackingScreen from '../screens/home/FarmerVisitTrackingScreen';
import AssessorNavigator from './AssessorNavigator';
import { useAppSelector } from '../redux/hooks';
import { selectAuthUser } from '../redux/slices/authSlice';
import type { AppStackParamList } from './navigationTypes';

enableScreens(true);
LogBox.ignoreAllLogs(true);

const Stack = createNativeStackNavigator<AppStackParamList>();

const AppNavigator: React.FC = () => {
  const user = useAppSelector(selectAuthUser);
  if (user?.role === 'assessor') {
    return <AssessorNavigator />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Shell" component={AppDrawer} />
      <Stack.Screen name="EnrollNow" component={EnrollNowScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="FarmDetails" component={FarmDetailsScreen} />
      <Stack.Screen name="FieldDetails" component={FieldDetailsScreen} />
      <Stack.Screen name="AddFarm" component={AddFarmScreen} />
      <Stack.Screen name="AddField" component={AddFieldScreen} />
      <Stack.Screen name="AssessmentCategory" component={AssessmentCategoryScreen} />
      <Stack.Screen
        name="AssessmentQuestionDetail"
        component={AssessmentQuestionDetailScreen}
      />
      <Stack.Screen name="AssessmentReview" component={AssessmentReviewScreen} />
      <Stack.Screen name="FarmerVisitTracking" component={FarmerVisitTrackingScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
