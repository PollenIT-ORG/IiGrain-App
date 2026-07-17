import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import BottomTabNavigator from '../BottomTabNavigator';
import DrawerContent from './DrawerContent';
import { COLORS } from '../../constants';
import { scale } from '../../utils';
import type { AppDrawerParamList } from '../navigationTypes';

const Drawer = createDrawerNavigator<AppDrawerParamList>();

const renderDrawer = (props: React.ComponentProps<typeof DrawerContent>) => (
  <DrawerContent {...props} />
);

const AppDrawer: React.FC = () => {
  return (
    <Drawer.Navigator
      drawerContent={renderDrawer}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        swipeEdgeWidth: scale(60),
        drawerStyle: {
          width: '78%',
          backgroundColor: COLORS.white,
        },
        sceneStyle: {
          backgroundColor: COLORS.white,
        },
      }}>
      <Drawer.Screen name="MainTabs" component={BottomTabNavigator} />
    </Drawer.Navigator>
  );
};

export default AppDrawer;
