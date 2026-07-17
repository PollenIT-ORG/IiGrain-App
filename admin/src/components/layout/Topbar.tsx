import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../store/useAuth";
import { showSuccess } from "../../lib/toast";
import { MenuIcon, SearchIcon, LogoutIcon, UsersIcon } from "../icons";
import NotificationBell from "./NotificationBell";

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = (user?.fullName || user?.email || "A")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-300 bg-white px-4 sm:px-6">
      <button
        onClick={onMenuClick}
        className="grid h-10 w-10 place-items-center rounded-lg text-gray-700 hover:bg-gray-100 lg:hidden"
        aria-label="Open menu"
      >
        <MenuIcon width={22} height={22} />
      </button>

      <div className="relative hidden w-full max-w-md md:block">
        <SearchIcon
          width={18}
          height={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
        />
        <input
          type="text"
          placeholder="Search farms, users, reports…"
          className="input-field pl-10"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <NotificationBell />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-lg p-1 pr-1.5 hover:bg-gray-100 sm:pr-2"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-semibold text-white">
              {initials}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-semibold leading-tight text-gray-900">
                {user?.fullName || "Administrator"}
              </span>
              <span className="block text-xs leading-tight text-gray-500">
                {user?.email}
              </span>
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-gray-300 bg-white shadow-card-hover">
              <div className="border-b border-gray-300 px-4 py-3 sm:hidden">
                <p className="text-sm font-semibold text-gray-900">
                  {user?.fullName || "Administrator"}
                </p>
                <p className="truncate text-xs text-gray-500">{user?.email}</p>
              </div>
              <Link
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2.5 border-b border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <UsersIcon width={18} height={18} />
                My profile
              </Link>
              <button
                onClick={() => {
                  logout();
                  showSuccess("Signed out successfully.");
                }}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium text-danger hover:bg-gray-100"
              >
                <LogoutIcon width={18} height={18} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
