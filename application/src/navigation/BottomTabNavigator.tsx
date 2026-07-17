import React from 'react';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/home/HomeScreen';
import AssessmentScreen from '../screens/assessment/AssessmentScreen';
import FarmsScreen from '../screens/farms/FarmsScreen';
import MoreScreen from '../screens/more/MoreScreen';
import CustomTabBar from '../components/BottomTab/CustomTabBar';
import type { AppTabParamList } from './navigationTypes';

const Tab = createBottomTabNavigator<AppTabParamList>();

const renderTabBar = (props: BottomTabBarProps) => <CustomTabBar {...props} />;

const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Assessment"
        component={AssessmentScreen}
        options={{ title: 'My Assessment' }}
      />
      <Tab.Screen name="Farms" component={FarmsScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
