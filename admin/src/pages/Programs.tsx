import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUrlSearchSync } from "../lib/useUrlSearchSync";
import { useLiveData } from "../lib/useLiveData";
import {
  useListProgramsQuery,
  useDeleteProgramMutation,
} from "../store/endpoints/programsApi";
import { showSuccess, showError } from "../lib/toast";
import { useDialog } from "../components/ui/DialogProvider";
import Select from "../components/ui/Select";
import Loader from "../components/Loader";
import {
  PlusIcon,
  EditIcon,
  EyeIcon,
  UsersIcon,
  TrashIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "../components/icons";
import type { Program } from "../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

function limitLabel(p: Program): string {
  return `${p.enrolled_count} / ${p.user_limit === null ? "No Limit" : p.user_limit}`;
}

export default function Programs() {
  const navigate = useNavigate();
  const { confirm } = useDialog();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  useUrlSearchSync(setSearchInput);

  const { data, isLoading, isError, error, refetch } = useListProgramsQuery({
    page,
    limit: PAGE_SIZE,
    isActive: status === "" ? undefined : status === "true",
    search: search || undefined,
  });
  useLiveData(["programs", "enrollments"], refetch);
  const programs = data?.programs ?? [];
  const meta = data?.meta ?? null;

  const [deleteProgram] = useDeleteProgramMutation();

  useEffect(() => {
    setPage(1);
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function handleDelete(program: Program) {
    const ok = await confirm({
      title: "Delete program?",
      message: `"${program.name}" will be removed along with its enrollments. A program with submitted assessments cannot be deleted - set it inactive instead.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteProgram(program.id).unwrap();
      showSuccess("Program deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programs</h1>
          <p className="mt-1 text-sm text-gray-500">
            {meta
              ? `${meta.total.toLocaleString()} program(s)`
              : "Manage schemes and enrolled farmers"}
          </p>
        </div>
        <button onClick={() => navigate("/programs/new")} className="btn-primary">
          <PlusIcon width={18} height={18} />
          Add program
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
            placeholder="Search by name or code"
            className="input-field pl-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            maxLength={100}
          />
        </div>
        <Select
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
          className="sm:w-40"
        />
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <Loader message="Loading programs..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {errMsg(error)}
          </div>
        ) : programs.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            No programs found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3 font-semibold">Program</th>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 font-semibold">Enrolled / Limit</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                    >
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => navigate(`/programs/${p.id}`)}
                          className="text-left font-medium text-gray-900 hover:text-primary hover:underline"
                        >
                          {p.name}
                        </button>
                        {p.code && (
                          <div className="text-xs text-gray-500">{p.code}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 capitalize text-gray-700">
                        {p.type || "-"}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                        {limitLabel(p)}
                      </td>
                      <td className="px-5 py-3.5">
                        {p.is_active ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                            <span className="h-1.5 w-1.5 rounded-full bg-success" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/programs/${p.id}`)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                            title="View details"
                          >
                            <EyeIcon width={16} height={16} />
                          </button>
                          <button
                            onClick={() => navigate(`/programs/${p.id}/farmers`)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                            title="Enrolled farmers"
                          >
                            <UsersIcon width={16} height={16} />
                          </button>
                          <button
                            onClick={() => navigate(`/programs/${p.id}/edit`)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                            title="Edit"
                          >
                            <EditIcon width={16} height={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
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
                <span className="font-semibold text-gray-700">{totalPages}</span>
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
