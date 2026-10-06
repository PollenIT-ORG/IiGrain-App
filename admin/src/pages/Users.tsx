import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useListUsersQuery,
  useDeleteUserMutation,
  useSetUserStatusMutation,
} from "../store/endpoints/usersApi";
import { showSuccess, showError } from "../lib/toast";
import { useUrlSearchSync } from "../lib/useUrlSearchSync";
import { useConfirmCascadeDelete } from "../lib/confirmDelete";
import Select from "../components/ui/Select";
import Loader from "../components/Loader";
import {
  PlusIcon,
  EditIcon,
  EyeIcon,
  TrashIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "../components/icons";
import { ROLE_LABELS, type User, type UserRole } from "../types";
import { fmtDate } from "../lib/datetime";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const PAGE_SIZE = 10;
const FILTER_ROLES: UserRole[] = [
  "farmer",
  "assessor",
  "program_administrator",
  "program_partner",
];

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  ...FILTER_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
];
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function formatDate(iso: string | null): string {
  return fmtDate(iso);
}

export default function Users() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const roleFromUrl = searchParams.get("role") || "";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  useUrlSearchSync(setSearchInput);
  const [status, setStatus] = useState<"" | "active" | "inactive">("");

  const isAllUsersView = !roleFromUrl;

  const { data, isLoading, isFetching, isError, error } =
    useListUsersQuery({
      page,
      limit: PAGE_SIZE,
      role: roleFromUrl || undefined,
      status: status || undefined,
      search: search || undefined,
    });
  const users = data?.users ?? [];
  const meta = data?.meta ?? null;
  // isFetching (not isLoading) so the spinner also shows while a filter/search
  // refetch is in flight, instead of leaving stale rows on screen.
  const loading = isLoading || isFetching;

  const [deleteUser] = useDeleteUserMutation();
  const confirmDelete = useConfirmCascadeDelete();
  const [setUserStatus] = useSetUserStatusMutation();

  useEffect(() => {
    setPage(1);
  }, [roleFromUrl, status, search]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  function onRoleChange(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("role", value);
    else next.delete("role");
    setSearchParams(next);
  }

  async function handleDelete(user: User) {
    const who = user.full_name || user.email;
    const ok = await confirmDelete({
      title: "Delete this account and all of its data?",
      message:
        `Everything belonging to ${who} is deleted with the account. ` +
        "This is how the numbers stay right - nothing is left behind without " +
        "an owner.",
      summaryPath: `/users/${user.id}/deletion-summary`,
    });
    if (!ok) return;
    try {
      await deleteUser(user.id).unwrap();
      showSuccess("User deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleSetStatus(user: User, isActive: boolean) {
    if (user.is_active === isActive) return;
    try {
      await setUserStatus({ id: user.id, isActive }).unwrap();
      showSuccess(isActive ? "User activated." : "User deactivated.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  const totalPages = meta?.totalPages ?? 1;
  const heading = roleFromUrl
    ? ROLE_LABELS[roleFromUrl as UserRole] + "s"
    : "All users";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{heading}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {meta ? `${meta.total.toLocaleString()} user(s)` : "Manage users and roles"}
          </p>
        </div>
        <button
          onClick={() => navigate("/users/new")}
          className="btn-primary"
        >
          <PlusIcon width={18} height={18} />
          Add user
        </button>
      </div>

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon
            width={18}
            height={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search by name, email, or phone"
            className="input-field pl-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            maxLength={100}
          />
        </div>

        {/* Shown on every one of these pages, not only All users: landing on
            Farmers from the sidebar and then wanting Assessors is the same
            move, and picking one here moves the sidebar with it. */}
        <Select
          value={roleFromUrl}
          onChange={onRoleChange}
          options={ROLE_OPTIONS}
          className="sm:w-44"
        />

        <Select
          value={status}
          onChange={(v) => setStatus(v as "" | "active" | "inactive")}
          options={STATUS_OPTIONS}
          className="sm:w-40"
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Loader message="Loading users..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {errMsg(error)}
          </div>
        ) : users.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            No users found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 font-semibold">Phone</th>
                    {isAllUsersView && (
                      <th className="px-5 py-3 font-semibold">Role</th>
                    )}
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Joined</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                    >
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => navigate(`/users/${u.id}`)}
                          className="text-left font-medium text-gray-900 hover:text-primary hover:underline"
                        >
                          {u.full_name || "-"}
                        </button>
                        {/* Still on the password we emailed, so they cannot sign in yet. */}
                        {u.must_change_password && (
                          <span
                            title="They have not replaced the temporary password yet, so they cannot sign in."
                            className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                          >
                            Not set up
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">{u.email}</td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {u.phone || "-"}
                      </td>
                      {isAllUsersView && (
                        <td className="px-5 py-3.5">
                          <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {ROLE_LABELS[u.role as UserRole] ?? u.role}
                          </span>
                        </td>
                      )}
                      <td className="px-5 py-3.5">
                        <StatusSelect
                          value={u.is_active ? "active" : "inactive"}
                          onChange={(next) =>
                            handleSetStatus(u, next === "active")
                          }
                        />
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/users/${u.id}`)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                            title="View details"
                          >
                            <EyeIcon width={16} height={16} />
                          </button>
                          <button
                            onClick={() => navigate(`/users/${u.id}/edit`)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                            title="Edit"
                          >
                            <EditIcon width={16} height={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-danger"
                            title="Delete"
                          >
                            <TrashIcon width={16} height={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-300 px-5 py-3 sm:flex-row">
              <p className="text-sm text-gray-500">
                Page <span className="font-semibold text-gray-700">{page}</span>{" "}
                of{" "}
                <span className="font-semibold text-gray-700">
                  {totalPages}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeftIcon width={16} height={16} />
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRightIcon width={16} height={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: "active" | "inactive";
  onChange: (value: "active" | "inactive") => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const btnRef = useRef<HTMLButtonElement>(null);

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const MENU_W = 128;
      const MENU_H = 80;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow < MENU_H + 8 ? rect.top - MENU_H - 6 : rect.bottom + 6;
      const left = Math.max(8, rect.right - MENU_W);
      setMenuPos({ top, left });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const isActive = value === "active";
  const Dot = ({ active }: { active: boolean }) => (
    <span
      className={`h-1.5 w-1.5 rounded-full ${
        active ? "bg-success" : "bg-gray-500"
      }`}
    />
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          isActive ? "bg-success/10 text-success" : "bg-gray-200 text-gray-600"
        }`}
      >
        <Dot active={isActive} />
        {isActive ? "Active" : "Inactive"}
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open &&
        menuPos &&
        createPortal(
          <ul
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: 128,
            }}
            className="z-50 overflow-hidden rounded-lg border border-gray-300 bg-white py-1 shadow-card-hover"
          >
            {(["active", "inactive"] as const).map((opt) => (
              <li
                key={opt}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt);
                  setOpen(false);
                }}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-gray-100 ${
                  value === opt ? "text-gray-900" : "text-gray-600"
                }`}
              >
                <Dot active={opt === "active"} />
                {opt === "active" ? "Active" : "Inactive"}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  );
}
