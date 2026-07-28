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
import notificationReducer from './slices/notificationSlice';
import syncReducer from './slices/syncSlice';
import appReducer from './slices/appSlice';
import boundaryReducer from './slices/boundarySlice';
import { setUnauthorizedHandler } from '../services/http';
import { PERSIST_ROOT_KEY, PERSIST_VERSION } from '../config/storageKeys';

const userPersistConfig = {
  key: 'user',
  version: PERSIST_VERSION,
  storage: AsyncStorage,
  whitelist: ['profile', 'lastFetchedAt'],
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

// Phase D of the Farm Boundary module: boundaries live only on the device, so
// the whole slice is persisted. When the API sync layer lands (Phase E) this
// becomes the offline cache. See docs/maps/FarmBoundary/DATA_MODEL.md §2.
const boundaryPersistConfig = {
  key: 'boundary',
  version: PERSIST_VERSION,
  storage: AsyncStorage,
  whitelist: ['byFieldId'],
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
  notifications: notificationReducer,
  sync: syncReducer,
  app: appReducer,
  boundary: persistReducer(boundaryPersistConfig, boundaryReducer),
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
