import React, { useEffect, useState } from 'react';
import { AppState, StatusBar, StyleSheet , LogBox } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import GlobalConfirmModal from './src/components/GlobalConfirmModal';
import GlobalErrorModal from './src/components/GlobalErrorModal';
import GlobalToast from './src/components/GlobalToast';
import VisitTrackingFab from './src/components/visit/VisitTrackingFab';
import { AppShimmerProvider } from './src/components/Shimmer';
import SplashBackdrop from './src/components/splash/SplashBackdrop';
import SplashOverlay from './src/components/splash/SplashOverlay';
import { COLORS } from './src/constants';
import { SPLASH } from './src/config/splash';
import { store, persistor } from './src/redux/store';
import { initializeDatabase, isDatabaseReady } from './src/services/db';
import { getSyncSubsystem } from './src/services/sync';
import SyncOwnerBridge from './src/components/SyncOwnerBridge';
import SyncStatusBanner from './src/components/SyncStatusBanner';




LogBox.ignoreLogs(['Require cycle:']);
LogBox.ignoreAllLogs(true);

const App = () => {
  const [databaseReady, setDatabaseReady] = useState(false);

  useEffect(() => {
    let alive = true;

    const bootstrapDatabase = async (): Promise<void> => {
      if (!alive || isDatabaseReady()) {
        return;
      }
      try {
        await initializeDatabase();
        if (!alive) {
          return;
        }
        await getSyncSubsystem().recoverForCurrentOwner();
        setDatabaseReady(true);
      } catch (error) {
        console.error('[db] initialization failed', error);
      }
    };

    bootstrapDatabase();

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        bootstrapDatabase();
      }
    });

    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <Provider store={store}>

        <PersistGate loading={<SplashBackdrop />} persistor={persistor}>
          <KeyboardProvider>
            <SafeAreaProvider>
              <StatusBar
                backgroundColor={COLORS.primary}
                barStyle="light-content"
              />
              <SyncOwnerBridge databaseReady={databaseReady} />
              <AppShimmerProvider>
                <RootNavigator />
                <VisitTrackingFab />
                <GlobalErrorModal />
                <GlobalConfirmModal />
                <GlobalToast />
                <SyncStatusBanner />
              </AppShimmerProvider>
            </SafeAreaProvider>
          </KeyboardProvider>
        </PersistGate>

        <SplashOverlay />
      </Provider>
    </GestureHandlerRootView>
  );
};

export default App;

const styles = StyleSheet.create({

  root: { flex: 1, backgroundColor: SPLASH.backgroundColor },
});

