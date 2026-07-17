import React from 'react';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import AssessorTabBar from '../components/BottomTab/AssessorTabBar';
import AssessorDashboardScreen from '../screens/assessor/AssessorDashboardScreen';
import AssessorFarmersScreen from '../screens/assessor/AssessorFarmersScreen';
import AssessorHistoryScreen from '../screens/assessor/AssessorHistoryScreen';
import AssessorMoreScreen from '../screens/assessor/AssessorMoreScreen';
import type { AssessorTabParamList } from './navigationTypes';

const Tab = createBottomTabNavigator<AssessorTabParamList>();

const renderTabBar = (props: BottomTabBarProps) => <AssessorTabBar {...props} />;

const AssessorTabNavigator: React.FC = () => (
  <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
    <Tab.Screen name="AssessorHome" component={AssessorDashboardScreen} />
    <Tab.Screen name="AssessorFarmers" component={AssessorFarmersScreen} />
    <Tab.Screen name="AssessorHistory" component={AssessorHistoryScreen} />
    <Tab.Screen name="AssessorMore" component={AssessorMoreScreen} />
  </Tab.Navigator>
);

export default AssessorTabNavigator;
