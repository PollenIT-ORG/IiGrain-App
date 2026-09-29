import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import Logo from "../Logo";
import {
  DashboardIcon,
  InboxIcon,
  FarmIcon,
  FieldsIcon,
  BuildingIcon,
  ChartIcon,
  UsersIcon,
  FileIcon,
  LinkIcon,
  MapPinIcon,
  SettingsIcon,
  CloseIcon,
} from "../icons";
import { ROLE_LABELS, type UserRole } from "../../types";
import { useGetConfigQuery } from "../../store/endpoints/configApi";
import { usePasSubmissionStatsQuery } from "../../store/endpoints/programAdminSurveyApi";
import { useLiveData } from "../../lib/useLiveData";
import { useAuth } from "../../store/useAuth";
import { canOpen, managedRoles } from "../../lib/access";
import type { ComponentType, SVGProps } from "react";

// Sub-items under "Survey Submissions", each a status group with a live count.
const SURVEY_STATUS_ITEMS: Array<{
  status: string;
  label: string;
  keys: string[];
  badge: string;
}> = [
  {
    status: "",
    label: "All Submissions",
    keys: [
      "draft",
      "submitted",
      "qualified",
      "contract_sent",
      "contract_signed",
      "enrolled",
      "not_qualified",
      "withdrawn",
    ],
    badge: "bg-gray-200 text-gray-600",
  },
  { status: "registered", label: "Registered", keys: ["draft"], badge: "bg-indigo-100 text-indigo-700" },
  { status: "under_review", label: "Under Review", keys: ["submitted", "qualified"], badge: "bg-amber-100 text-amber-700" },
  { status: "contract_sent", label: "Contract Sent", keys: ["contract_sent", "contract_signed"], badge: "bg-blue-100 text-blue-700" },
  { status: "enrolled", label: "Enrolled", keys: ["enrolled"], badge: "bg-emerald-100 text-emerald-700" },
  { status: "not_qualified", label: "Not Qualified", keys: ["not_qualified"], badge: "bg-rose-100 text-rose-700" },
  { status: "withdrawn", label: "Withdrawn", keys: ["withdrawn"], badge: "bg-gray-200 text-gray-600" },
];

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  saasOnly?: boolean;
  /** Writing the help content is the platform team's, so this hides it. */
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { to: "/organizations", label: "Organizations", Icon: BuildingIcon, saasOnly: true },
  { to: "/farms", label: "Farms", Icon: FarmIcon },
  { to: "/fields", label: "Fields", Icon: FieldsIcon },
  // A program, what its farmers and assessors submitted, then its own survey
  // and the producers who applied through it: the order they are worked in.
  { to: "/programs", label: "Programs", Icon: LinkIcon },
  { to: "/assessments", label: "Assessments", Icon: ChartIcon },
  { to: "/submissions", label: "Submissions", Icon: FileIcon },
  { to: "/surveys", label: "Surveys", Icon: LinkIcon },
  { to: "/survey-submissions", label: "Survey Submissions", Icon: FileIcon },
  { to: "/live-visits", label: "Live visits", Icon: MapPinIcon },
  // Reports are not in use yet.
  // { to: "/reports", label: "Reports", Icon: FileIcon },
  { to: "/contact-enquiries", label: "Contact enquiries", Icon: InboxIcon },
  { to: "/faqs", label: "Help & FAQs", Icon: FileIcon, adminOnly: true },
  { to: "/login-logs", label: "Login activity", Icon: FileIcon },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

const USER_ROLES: UserRole[] = [
  "farmer",
  "assessor",
  "program_administrator",
  "program_partner",
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const activeRole = params.get("role");
  const onUsers = location.pathname.startsWith("/users");

  const { data: config } = useGetConfigQuery();
  const saasEnabled = config?.saasEnabled ?? false;
  const { user } = useAuth();
  // Only the modules this role works with, and only the people they look after.
  const visible = (to: string) => canOpen(user?.role, to);
  const isAdminLevel = user?.role === "super_admin" || user?.role === "admin";
  const userGroups = managedRoles(user?.role, USER_ROLES);

  const onPasSubmissions = location.pathname.startsWith("/survey-submissions");
  const surveyStatus = params.get("status") ?? "";
  const { data: pasStats, refetch: refetchPasStats } = usePasSubmissionStatsQuery(
    undefined,
    { skip: !visible("/survey-submissions") }
  );
  useLiveData(["program_admin_survey"], refetchPasStats);
  const pasCount = (keys: string[]) =>
    keys.reduce((n, k) => n + (pasStats?.[k] ?? 0), 0);

  const [usersOpen, setUsersOpen] = useState(onUsers);
  const [pasOpen, setPasOpen] = useState(onPasSubmissions);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-gray-900/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-300 bg-white transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-300 px-5">
          <Logo size="sm" />
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden"
            aria-label="Close menu"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>

        <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Main
          </p>
          {visible("/dashboard") && (
            <NavLink
              to="/dashboard"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
            >
              <DashboardIcon width={20} height={20} />
              Dashboard
            </NavLink>
          )}

          <div className={userGroups.length ? "" : "hidden"}>
            <button
              onClick={() => setUsersOpen((o) => !o)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                onUsers
                  ? "bg-primary/10 text-primary"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <UsersIcon width={20} height={20} />
              Users
              <ChevronIcon open={usersOpen} />
            </button>

            {usersOpen && (
              <div className="mt-1 ml-5 space-y-0.5 border-l border-gray-300 pl-2">
                <button
                  onClick={() => {
                    navigate("/users");
                    onClose();
                  }}
                  className={`-ml-2 flex w-[calc(100%+0.5rem)] items-center border-l-2 py-2 pl-3 pr-2 text-left text-sm transition-colors ${
                    onUsers && !activeRole
                      ? "border-primary font-semibold text-primary"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  All users
                </button>
                {userGroups.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      navigate(`/users?role=${role}`);
                      onClose();
                    }}
                    className={`-ml-2 flex w-[calc(100%+0.5rem)] items-center border-l-2 py-2 pl-3 pr-2 text-left text-sm transition-colors ${
                      onUsers && activeRole === role
                        ? "border-primary font-semibold text-primary"
                        : "border-transparent text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {NAV_ITEMS.filter(
            (i) =>
              i.to !== "/dashboard" &&
              (!i.saasOnly || saasEnabled) &&
              (!i.adminOnly || isAdminLevel) &&
              visible(i.to)
          ).map(({ to, label, Icon }) =>
            to === "/survey-submissions" ? (
              <div key={to}>
                <button
                  onClick={() => setPasOpen((o) => !o)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    onPasSubmissions
                      ? "bg-primary/10 text-primary"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon width={20} height={20} />
                  {label}
                  <ChevronIcon open={pasOpen} />
                </button>

                {pasOpen && (
                  <div className="mt-1 ml-5 space-y-0.5 border-l border-gray-300 pl-2">
                    {SURVEY_STATUS_ITEMS.map((item) => {
                      const active =
                        onPasSubmissions && surveyStatus === item.status;
                      const n = pasCount(item.keys);
                      return (
                        <button
                          key={item.status || "all"}
                          onClick={() => {
                            navigate(
                              item.status
                                ? `/survey-submissions?status=${item.status}`
                                : "/survey-submissions"
                            );
                            onClose();
                          }}
                          className={`-ml-2 flex w-[calc(100%+0.5rem)] items-center justify-between gap-2 border-l-2 py-2 pl-3 pr-2 text-left text-sm transition-colors ${
                            active
                              ? "border-primary font-semibold text-primary"
                              : "border-transparent text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          <span>{item.label}</span>
                          {n > 0 && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.badge}`}
                            >
                              {n}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  }`
                }
              >
                <Icon width={20} height={20} />
                {label}
              </NavLink>
            )
          )}
        </nav>

        <div className="border-t border-gray-300 p-4">
          <div className="rounded-lg bg-gray-100 p-3">
            <p className="text-xs font-semibold text-gray-900">Need help?</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Check the docs or contact support.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`ml-auto h-4 w-4 transition-transform ${
        open ? "rotate-180" : ""
      }`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
