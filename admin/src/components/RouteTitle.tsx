import { useEffect } from "react";
import { useLocation, matchPath } from "react-router-dom";
import { readCachedBranding } from "../lib/brandingCache";

// Maps a route to the page name shown in the browser tab. Ordered most specific
// first; matched with an exact (end) match so dynamic routes do not collide.
const TITLES: Array<[string, string]> = [
  ["/login", "Sign in"],
  ["/survey", "Program Eligibility Survey"],
  ["/survey/status", "Check your status"],
  ["/survey/status/:token", "Application status"],
  ["/survey/contract/:token", "Sign contract"],
  ["/dashboard", "Dashboard"],
  ["/login-logs", "Login logs"],
  ["/users/new", "New user"],
  ["/users/:id/edit", "Edit user"],
  ["/users/:id", "User details"],
  ["/users", "Users"],
  ["/organizations/new", "New organization"],
  ["/organizations/:id/edit", "Edit organization"],
  ["/organizations/:id", "Organization details"],
  ["/organizations", "Organizations"],
  ["/profile/change-password", "Change password"],
  ["/profile", "Profile"],
  ["/farms/new", "New farm"],
  ["/farms/:id/edit", "Edit farm"],
  ["/farms/:id", "Farm details"],
  ["/farms", "Farms"],
  ["/fields/new", "New field"],
  ["/fields/:id/edit", "Edit field"],
  ["/fields/:id", "Field details"],
  ["/fields", "Fields"],
  ["/live-visits", "Live visits"],
  ["/programs/new", "New program"],
  ["/programs/:id/edit", "Edit program"],
  ["/programs/:id/farmers", "Enrolled farmers"],
  ["/programs/:id", "Program details"],
  ["/programs", "Programs"],
  ["/submissions", "Submissions"],
  ["/assignments", "Assignments"],
  ["/notifications", "Notifications"],
  ["/eligibility/:id", "Survey submission"],
  ["/eligibility", "Survey submissions"],
  ["/survey-questions", "Survey questions"],
  ["/enquiries", "Contact enquiries"],
  ["/assessments/categories/new", "New category"],
  ["/assessments/categories/:id/edit", "Edit category"],
  ["/assessments/categories/:categoryId/questions/new", "New question"],
  ["/assessments/categories/:categoryId/questions/:id/edit", "Edit question"],
  ["/assessments/categories/:categoryId/questions", "Assessment questions"],
  ["/assessments", "Assessments"],
  ["/reports", "Reports"],
  ["/settings", "Settings"],
];

// Keeps the browser tab title in sync with the current route so every page has
// its own title instead of a single static one.
export default function RouteTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const brand = readCachedBranding()?.appName?.trim() || "iiGrain";
    const match = TITLES.find(([path]) =>
      matchPath({ path, end: true }, pathname)
    );
    document.title = match ? `${match[1]} - ${brand}` : `${brand} Admin`;
  }, [pathname]);

  return null;
}
