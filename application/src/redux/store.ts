import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import authReducer, { logoutThunk } from './slices/authSlice';
import userReducer from './slices/userSlice';
import farmReducer from './slices/farmSlice';
import fieldReducer from './slices/fieldSlice';
import fieldDetailsReducer from './slices/fieldDetailsSlice';
import soilReducer from './slices/soilSlice';
import assessmentReducer from './slices/assessmentSlice';
import assessmentProgressReducer from './slices/assessmentProgressSlice';
import assessorReducer from './slices/assessorSlice';
import enrollmentReducer from './slices/enrollmentSlice';
import dashboardReducer from './slices/dashboardSlice';
import visitReducer from './slices/visitSlice';
import appReducer from './slices/appSlice';
import { setUnauthorizedHandler } from '../services/http';
import { PERSIST_ROOT_KEY, PERSIST_VERSION } from '../config/storageKeys';

const userPersistConfig = {
  key: 'user',
  version: PERSIST_VERSION,
  storage: AsyncStorage,
  whitelist: ['profile'],
};

const assessmentProgressPersistConfig = {
  key: 'assessmentProgress',
  version: PERSIST_VERSION,
  storage: AsyncStorage,
  whitelist: ['resumeByField'],
};

const dashboardPersistConfig = {
  key: 'dashboard',
  version: PERSIST_VERSION,
  storage: AsyncStorage,
  whitelist: ['selectedFarmId'],
};

const rootReducer = combineReducers({
  auth: authReducer,
  user: persistReducer(userPersistConfig, userReducer),
  farm: farmReducer,
  field: fieldReducer,
  fieldDetails: fieldDetailsReducer,
  soil: soilReducer,
  assessment: assessmentReducer,
  assessmentProgress: persistReducer(assessmentProgressPersistConfig, assessmentProgressReducer),
  assessor: assessorReducer,
  enrollment: enrollmentReducer,
  dashboard: persistReducer(dashboardPersistConfig, dashboardReducer),
  visit: visitReducer,
  app: appReducer,
});

const rootPersistConfig = {
  key: PERSIST_ROOT_KEY,
  version: PERSIST_VERSION,
  storage: AsyncStorage,
  whitelist: [] as string[],
};

const persistedReducer = persistReducer(rootPersistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  devTools: __DEV__,
});

export const persistor = persistStore(store);

setUnauthorizedHandler(() => {
  store.dispatch(logoutThunk());
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
