import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider } from "react-redux";
import { Toaster } from "react-hot-toast";
import { store } from "./store";
import { DialogProvider } from "./components/ui/DialogProvider";
import { toasterProps } from "./lib/toast";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./components/Home";
import AppLayout from "./components/layout/AppLayout";
import Loader from "./components/Loader";
import BrandingApplier from "./components/BrandingApplier";
import LocaleWatcher from "./components/LocaleWatcher";
import RouteTitle from "./components/RouteTitle";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const LoginLogs = lazy(() => import("./pages/LoginLogs"));
const Users = lazy(() => import("./pages/Users"));
const UserForm = lazy(() => import("./pages/UserForm"));
const Organizations = lazy(() => import("./pages/Organizations"));
const OrganizationForm = lazy(() => import("./pages/OrganizationForm"));
const OrganizationDetail = lazy(() => import("./pages/OrganizationDetail"));
const Farms = lazy(() => import("./pages/Farms"));
const FarmForm = lazy(() => import("./pages/FarmForm"));
const Fields = lazy(() => import("./pages/Fields"));
const FieldForm = lazy(() => import("./pages/FieldForm"));
const FieldDetail = lazy(() => import("./pages/FieldDetail"));
const UserDetail = lazy(() => import("./pages/UserDetail"));
const FarmDetail = lazy(() => import("./pages/FarmDetail"));
const Programs = lazy(() => import("./pages/Programs"));
const ProgramForm = lazy(() => import("./pages/ProgramForm"));
const ProgramDetail = lazy(() => import("./pages/ProgramDetail"));
const ProgramSurveySetup = lazy(() => import("./pages/ProgramSurveySetup"));
const NewSurveyProgram = lazy(() => import("./pages/NewSurveyProgram"));
const EnrolledFarmers = lazy(() => import("./pages/EnrolledFarmers"));
const FieldMonitoring = lazy(() => import("./pages/FieldMonitoring"));
const Submissions = lazy(() => import("./pages/Submissions"));
const Notifications = lazy(() => import("./pages/Notifications"));
const ProgramAdminSurvey = lazy(() => import("./pages/ProgramAdminSurvey"));
const ProgramTemplateEditor = lazy(
  () => import("./pages/ProgramTemplateEditor")
);
const ProgramContractEditor = lazy(
  () => import("./pages/ProgramContractEditor")
);
const ProgramSubmissions = lazy(() => import("./pages/ProgramSubmissions"));
const ProgramSubmissionDetail = lazy(
  () => import("./pages/ProgramSubmissionDetail")
);
const LiveVisits = lazy(() => import("./pages/LiveVisits"));
const AssessmentCategories = lazy(() => import("./pages/AssessmentCategories"));
const CategoryForm = lazy(() => import("./pages/CategoryForm"));
const AssessmentQuestions = lazy(() => import("./pages/AssessmentQuestions"));
const QuestionForm = lazy(() => import("./pages/QuestionForm"));
const Profile = lazy(() => import("./pages/Profile"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Settings = lazy(() => import("./pages/Settings"));
const Placeholder = lazy(() => import("./pages/Placeholder"));
// Public survey (no login) - lives in the admin app but outside the auth gate.
// Public Program Admin Survey (no login) - one link per program.
const ProgramSurveyAssessment = lazy(
  () => import("./pages/program-survey/ProgramSurveyAssessment")
);
const ProgramSurveyStatus = lazy(
  () => import("./pages/program-survey/ProgramSurveyStatus")
);
const ProgramSurveyContract = lazy(
  () => import("./pages/program-survey/ProgramSurveyContract")
);

export default function App() {
  return (
    <Provider store={store}>
      <DialogProvider>
        <Toaster {...toasterProps} />
        <BrandingApplier />
        <BrowserRouter>
          <RouteTitle />
          <LocaleWatcher>
            <Suspense
              fallback={
                <Loader variant="fullPage" message="Loading..." size="lg" />
              }
            >
              <Routes>
                <Route path="/login" element={<Login />} />

                {/* Public survey - no login. Producers arrive from a QR/link. */}

                {/* Public Program Admin Survey - one shareable link per program. */}
                <Route path="/program-admin-survey/status/:token" element={<ProgramSurveyStatus />} />
                <Route path="/program-admin-survey/contract/:token" element={<ProgramSurveyContract />} />
                <Route path="/program-admin-survey/:token" element={<ProgramSurveyAssessment />} />


                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/login-logs" element={<LoginLogs />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/users/new" element={<UserForm />} />
                  <Route path="/users/:id" element={<UserDetail />} />
                  <Route path="/users/:id/edit" element={<UserForm />} />
                  <Route path="/organizations" element={<Organizations />} />
                  <Route
                    path="/organizations/new"
                    element={<OrganizationForm />}
                  />
                  <Route
                    path="/organizations/:id"
                    element={<OrganizationDetail />}
                  />
                  <Route
                    path="/organizations/:id/edit"
                    element={<OrganizationForm />}
                  />
                  <Route path="/profile" element={<Profile />} />
                  <Route
                    path="/profile/change-password"
                    element={<ChangePassword />}
                  />
                  <Route path="/farms" element={<Farms />} />
                  <Route path="/farms/new" element={<FarmForm />} />
                  <Route path="/farms/:id" element={<FarmDetail />} />
                  <Route path="/farms/:id/edit" element={<FarmForm />} />
                  <Route path="/fields" element={<Fields />} />
                  <Route path="/fields/new" element={<FieldForm />} />
                  <Route path="/fields/:id" element={<FieldDetail />} />
                  <Route path="/fields/:id/edit" element={<FieldForm />} />
                  <Route path="/live-visits" element={<LiveVisits />} />
                  <Route path="/programs" element={<Programs />} />
                  <Route path="/programs/new" element={<ProgramForm />} />
                  <Route path="/programs/:id" element={<ProgramDetail />} />
                  <Route path="/programs/:id/edit" element={<ProgramForm />} />
                  {/* Setting a program's survey up, step by step. */}
                  <Route
                    path="/programs/:id/survey"
                    element={<ProgramSurveySetup />}
                  />
                  <Route
                    path="/programs/:id/fields/:fieldId/monitoring"
                    element={<FieldMonitoring />}
                  />
                  <Route
                    path="/programs/:id/farmers"
                    element={<EnrolledFarmers />}
                  />
                  <Route path="/submissions" element={<Submissions />} />
                  <Route path="/notifications" element={<Notifications />} />
                  {/* Older links to these modules still work. */}
                  <Route
                    path="/program-surveys/*"
                    element={<Navigate to="/surveys" replace />}
                  />
                  <Route
                    path="/program-submissions/*"
                    element={<Navigate to="/survey-submissions" replace />}
                  />
                  <Route path="/surveys" element={<ProgramAdminSurvey />} />
                  {/* A survey belongs to a program, so a new one starts there. */}
                  <Route path="/surveys/new" element={<NewSurveyProgram />} />
                  <Route
                    path="/surveys/surveys/:id"
                    element={<ProgramTemplateEditor />}
                  />
                  {/* Old path, kept so existing links keep working. */}
                  <Route
                    path="/surveys/templates/:id"
                    element={<ProgramTemplateEditor />}
                  />
                  <Route
                    path="/surveys/contracts/:id"
                    element={<ProgramContractEditor />}
                  />
                  <Route path="/survey-submissions" element={<ProgramSubmissions />} />
                  <Route
                    path="/survey-submissions/:id"
                    element={<ProgramSubmissionDetail />}
                  />
                  <Route path="/assessments" element={<AssessmentCategories />} />
                  <Route path="/assessments/categories/new" element={<CategoryForm />} />
                  <Route path="/assessments/categories/:id/edit" element={<CategoryForm />} />
                  <Route
                    path="/assessments/categories/:categoryId/questions"
                    element={<AssessmentQuestions />}
                  />
                  <Route
                    path="/assessments/categories/:categoryId/questions/new"
                    element={<QuestionForm />}
                  />
                  <Route
                    path="/assessments/categories/:categoryId/questions/:id/edit"
                    element={<QuestionForm />}
                  />
                  <Route
                    path="/reports"
                    element={<Placeholder title="Reports" />}
                  />
                  <Route path="/settings" element={<Settings />} />
                </Route>

                <Route path="/" element={<Home />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </Suspense>
          </LocaleWatcher>
        </BrowserRouter>
      </DialogProvider>
    </Provider>
  );
}
