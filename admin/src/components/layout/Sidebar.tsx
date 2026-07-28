import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import Logo from "../Logo";
import {
  DashboardIcon,
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
import type { ComponentType, SVGProps } from "react";

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  saasOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { to: "/organizations", label: "Organizations", Icon: BuildingIcon, saasOnly: true },
  { to: "/farms", label: "Farms", Icon: FarmIcon },
  { to: "/fields", label: "Fields", Icon: FieldsIcon },
  { to: "/programs", label: "Programs", Icon: LinkIcon },
  { to: "/assignments", label: "Assessor Assignments", Icon: UsersIcon },
  { to: "/live-visits", label: "Live visits", Icon: MapPinIcon },
  { to: "/assessments", label: "Assessments", Icon: ChartIcon },
  { to: "/submissions", label: "Submissions", Icon: FileIcon },
  { to: "/eligibility", label: "Survey Submissions", Icon: UsersIcon },
  { to: "/survey-questions", label: "Survey Questions", Icon: ChartIcon },
  { to: "/enquiries", label: "Contact Enquiries", Icon: FileIcon },
  { to: "/reports", label: "Reports", Icon: FileIcon },
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

  const [usersOpen, setUsersOpen] = useState(onUsers);

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

          <div>
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
              <div className="mt-1 space-y-1 pl-7">
                <button
                  onClick={() => {
                    navigate("/users");
                    onClose();
                  }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    onUsers && !activeRole
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  All users
                </button>
                {USER_ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      navigate(`/users?role=${role}`);
                      onClose();
                    }}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      onUsers && activeRole === role
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {NAV_ITEMS.filter(
            (i) => i.to !== "/dashboard" && (!i.saasOnly || saasEnabled)
          ).map(
            ({ to, label, Icon }) => (
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
