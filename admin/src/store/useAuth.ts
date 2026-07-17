import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./hooks";
import { clearCredentials } from "./authSlice";
import { useLogoutMutation } from "./endpoints/authApi";
import { closeSocket } from "../lib/socket";

export function useAuth() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const [logoutMutation] = useLogoutMutation();

  const logout = useCallback(() => {
    logoutMutation().catch(() => {
      /* logging out locally regardless */
    });
    closeSocket();
    dispatch(clearCredentials());
  }, [dispatch, logoutMutation]);

  return { user, isAuthenticated: !!user, logout };
}
