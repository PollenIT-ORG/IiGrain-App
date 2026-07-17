import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export const resetRoot = (routeName: string): void => {
  if (navigationRef.isReady()) {
    navigationRef.resetRoot({ index: 0, routes: [{ name: routeName }] });
  }
};
