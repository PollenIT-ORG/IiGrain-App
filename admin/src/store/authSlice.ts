import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  setTokens,
} from "../lib/api";
import type { AuthUser } from "../types";

const USER_KEY = "farmer_admin_user";

interface AuthState {
  user: AuthUser | null;
}

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

const initialState: AuthState = {
  user: loadStoredUser(),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{
        token: string;
        refreshToken: string;
        user: AuthUser;
      }>
    ) {
      const { token, refreshToken, user } = action.payload;
      setTokens(token, refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      state.user = user;
    },
    clearCredentials(state) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      state.user = null;
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
