import { useEffect } from "react";
import { useLocation, matchPath } from "react-router-dom";
import { readCachedBranding } from "../lib/brandingCache";

// Maps a route to the page name shown in the browser tab. Ordered most specific
// first; matched with an exact (end) match so dynamic routes do not collide.
const TITLES: Array<[string, string]> = [
  ["/login", "Sign in"],
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
  ["/fields/:fieldId/comparison", "Farmer and assessor"],
  ["/fields/:id", "Field details"],
  ["/fields", "Fields"],
  ["/live-visits", "Live visits"],
  ["/programs/new", "New program"],
  ["/programs/:id/edit", "Edit program"],
  ["/programs/:id/farmers", "Enrolled farmers in assessment"],
  ["/programs/:programId/survey-submissions/:id", "Survey submission"],
  ["/programs/:programId/fields/:id/edit", "Edit field"],
  ["/programs/:programId/fields/:fieldId/comparison", "Farmer and assessor"],
  ["/programs/:programId/submissions/:id", "Assessment review"],
  ["/programs/:programId/fields/:id", "Field details"],
  ["/programs/:programId/assessments/categories/new", "New category"],
  ["/programs/:programId/assessments/categories/:id/edit", "Edit category"],
  ["/programs/:programId/assessments/categories/:categoryId/questions/new", "New question"],
  ["/programs/:programId/assessments/categories/:categoryId/questions/:id/edit", "Edit question"],
  ["/programs/:programId/assessments/categories/:categoryId/questions", "Assessment questions"],
  ["/programs/:id", "Program details"],
  ["/programs", "Programs"],
  ["/submissions", "Submissions"],
  ["/surveys/surveys/:templateId/submissions/:id", "Survey submission"],
  ["/surveys/surveys/:id", "Edit survey"],
  ["/surveys/contracts/:id", "Edit contract"],
  ["/surveys", "Surveys"],
  ["/survey-submissions/:id", "Survey submission"],
  ["/survey-submissions", "Survey submissions"],
  ["/notifications", "Notifications"],
  ["/assessments/templates/:templateId/categories/new", "New category"],
  ["/assessments/templates/:templateId/categories/:id/edit", "Edit category"],
  ["/assessments/templates/:templateId/categories/:categoryId/questions/new", "New question"],
  ["/assessments/templates/:templateId/categories/:categoryId/questions/:id/edit", "Edit question"],
  ["/assessments/templates/:templateId/categories/:categoryId/questions", "Assessment questions"],
  ["/assessments/templates/:templateId", "Assessment template"],
  ["/assessments", "Assessments"],
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
