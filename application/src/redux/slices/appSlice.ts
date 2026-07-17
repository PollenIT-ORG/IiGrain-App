import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AppState {
  booted: boolean;
  globalLoading: boolean;
  isOffline: boolean;
}

const initialState: AppState = {
  booted: false,
  globalLoading: false,
  isOffline: false,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setBooted(state, action: PayloadAction<boolean>) {
      state.booted = action.payload;
    },
    setGlobalLoading(state, action: PayloadAction<boolean>) {
      state.globalLoading = action.payload;
    },
    setOffline(state, action: PayloadAction<boolean>) {
      state.isOffline = action.payload;
    },
  },
});

export const { setBooted, setGlobalLoading, setOffline } = appSlice.actions;
export default appSlice.reducer;

interface HasApp {
  app: AppState;
}
export const selectGlobalLoading = (s: HasApp): boolean => s.app.globalLoading;
export const selectIsOffline = (s: HasApp): boolean => s.app.isOffline;
