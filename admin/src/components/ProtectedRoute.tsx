import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/useAuth";
import { canOpen, homePath } from "../lib/access";
import type { ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  // A module this role does not work with is not reachable by typing its
  // address either; they land back where they belong.
  if (!canOpen(user?.role, location.pathname)) {
    return <Navigate to={homePath()} replace />;
  }
  return <>{children}</>;
}
