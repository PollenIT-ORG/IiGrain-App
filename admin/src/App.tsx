import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider } from "react-redux";
import { Toaster } from "react-hot-toast";
import { store } from "./store";
import { DialogProvider } from "./components/ui/DialogProvider";
import { toasterProps } from "./lib/toast";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import Loader from "./components/Loader";
import BrandingApplier from "./components/BrandingApplier";
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
const EnrolledFarmers = lazy(() => import("./pages/EnrolledFarmers"));
const Submissions = lazy(() => import("./pages/Submissions"));
const Assignments = lazy(() => import("./pages/Assignments"));
const Notifications = lazy(() => import("./pages/Notifications"));
const EligibilitySubmissions = lazy(() => import("./pages/EligibilitySubmissions"));
const EligibilitySubmissionDetail = lazy(
  () => import("./pages/EligibilitySubmissionDetail")
);
const SurveyQuestions = lazy(() => import("./pages/SurveyQuestions"));
const ContactEnquiries = lazy(() => import("./pages/ContactEnquiries"));
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
const SurveyAssessment = lazy(() => import("./pages/survey/SurveyAssessment"));
const SurveyStatus = lazy(() => import("./pages/survey/SurveyStatus"));
const SurveyStatusLookup = lazy(() => import("./pages/survey/SurveyStatusLookup"));
const SurveyContract = lazy(() => import("./pages/survey/SurveyContract"));

export default function App() {
  return (
    <Provider store={store}>
      <DialogProvider>
        <Toaster {...toasterProps} />
        <BrandingApplier />
        <BrowserRouter>
          <RouteTitle />
          <Suspense
            fallback={
              <Loader variant="fullPage" message="Loading..." size="lg" />
            }
          >
            <Routes>
              <Route path="/login" element={<Login />} />

              {/* Public survey - no login. Producers arrive from a QR/link. */}
              <Route path="/survey" element={<SurveyAssessment />} />
              <Route path="/survey/status" element={<SurveyStatusLookup />} />
              <Route path="/survey/status/:token" element={<SurveyStatus />} />
              <Route path="/survey/contract/:token" element={<SurveyContract />} />


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
                <Route
                  path="/programs/:id/farmers"
                  element={<EnrolledFarmers />}
                />
                <Route path="/submissions" element={<Submissions />} />
                <Route path="/assignments" element={<Assignments />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/eligibility" element={<EligibilitySubmissions />} />
                <Route
                  path="/eligibility/:id"
                  element={<EligibilitySubmissionDetail />}
                />
                <Route path="/survey-questions" element={<SurveyQuestions />} />
                <Route path="/enquiries" element={<ContactEnquiries />} />
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

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </DialogProvider>
    </Provider>
  );
}
