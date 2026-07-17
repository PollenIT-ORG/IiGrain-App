import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import GlobalErrorModal from './src/components/GlobalErrorModal';
import GlobalToast from './src/components/GlobalToast';
import VisitTrackingFab from './src/components/visit/VisitTrackingFab';
import { AppShimmerProvider } from './src/components/Shimmer';
import { COLORS } from './src/constants';
import { store, persistor } from './src/redux/store';

const App = () => {
  return (
    <GestureHandlerRootView style={styles.root}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <KeyboardProvider>
            <SafeAreaProvider>
              {/* App-wide status bar: primary-green background + LIGHT (white)
                  icons on every screen.
                  • Android <15: `backgroundColor` colours the (opaque) bar right
                    away - no rebuild needed.
                  • Android 15+ / iOS: `backgroundColor` is ignored under
                    edge-to-edge, so StatusBarBackground (below) paints the strip. */}
              <StatusBar
                backgroundColor={COLORS.primary}
                barStyle="light-content"
              />
              {/* App-wide shimmer clock - drives + syncs every AppShimmer skeleton
                  from a single theme; costs nothing while none are on screen. */}
              <AppShimmerProvider>
                <RootNavigator />
                {/* Global live-visit beacon - floats over every screen while a
                    visit is active (hides itself on question / map screens). */}
                <VisitTrackingFab />
                <GlobalErrorModal />
                <GlobalToast />
              </AppShimmerProvider>
            </SafeAreaProvider>
          </KeyboardProvider>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
};

export default App;

const styles = StyleSheet.create({
  root: { flex: 1 },
});
