import type { AppStackParamList, AppTabParamList } from '../navigation/navigationTypes';

export interface DrawerItem {
  key: string;
  label: string;
  icon: string;
  tab?: keyof AppTabParamList;
  route?: keyof AppStackParamList;
}

export interface DrawerModule {
  title: string;
  items: DrawerItem[];
}

export type DrawerModuleKey = 'dashboard' | 'assessment' | 'farm';

export const drawerConfig: Record<DrawerModuleKey, DrawerModule> = {
  dashboard: {
    title: 'Menu',
    items: [
      { key: 'home', label: 'Dashboard', icon: 'view-dashboard-outline', tab: 'Home' },
      { key: 'farms', label: 'My Farms', icon: 'barn', tab: 'Farms' },
      { key: 'assessments', label: 'Assessments', icon: 'clipboard-text-outline', tab: 'Assessment' },
      { key: 'enroll', label: 'Enroll Now', icon: 'clipboard-plus-outline', route: 'EnrollNow' },
      { key: 'account', label: 'Account', icon: 'account-outline', route: 'Account' },
      { key: 'settings', label: 'Settings', icon: 'cog-outline', tab: 'More' },
    ],
  },
  assessment: {
    title: 'Assessments',
    items: [
      { key: 'my', label: 'My Assessments', icon: 'clipboard-list-outline', tab: 'Assessment' },
      { key: 'home', label: 'Dashboard', icon: 'view-dashboard-outline', tab: 'Home' },
      { key: 'farms', label: 'My Farms', icon: 'barn', tab: 'Farms' },
      { key: 'account', label: 'Account', icon: 'account-outline', route: 'Account' },
      { key: 'settings', label: 'Settings', icon: 'cog-outline', tab: 'More' },
    ],
  },
  farm: {
    title: 'Farms',
    items: [
      { key: 'list', label: 'My Farms', icon: 'barn', tab: 'Farms' },
      { key: 'add', label: 'Add Farm', icon: 'plus-circle-outline', route: 'AddFarm' },
      { key: 'home', label: 'Dashboard', icon: 'view-dashboard-outline', tab: 'Home' },
      { key: 'assessments', label: 'Assessments', icon: 'clipboard-text-outline', tab: 'Assessment' },
      { key: 'settings', label: 'Settings', icon: 'cog-outline', tab: 'More' },
    ],
  },
};

export const tabToModule: Record<keyof AppTabParamList, DrawerModuleKey> = {
  Home: 'dashboard',
  Assessment: 'assessment',
  Farms: 'farm',
  More: 'dashboard',
};
