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
import SplashBackdrop from './src/components/splash/SplashBackdrop';
import { COLORS } from './src/constants';
import { SPLASH } from './src/config/splash';
import { store, persistor } from './src/redux/store';

const App = () => {
  return (
    <GestureHandlerRootView style={styles.root}>
      <Provider store={store}>
        {/* Rehydration paints the splash colour rather than `null`: an empty
            render here is the blank frame between the native window and the
            first JS paint. */}
        <PersistGate loading={<SplashBackdrop />} persistor={persistor}>
          <KeyboardProvider>
            <SafeAreaProvider>
              <StatusBar
                backgroundColor={COLORS.primary}
                barStyle="light-content"
              />
              <AppShimmerProvider>
                <RootNavigator />
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
  // Painted explicitly rather than left transparent: an uncoloured root shows
  // the raw window background in any frame where nothing above it has drawn yet,
  // which is seen as a white flash between the native splash and the app.
  root: { flex: 1, backgroundColor: SPLASH.backgroundColor },
});
