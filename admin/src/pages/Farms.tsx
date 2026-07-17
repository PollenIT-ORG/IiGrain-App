import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useListFarmsQuery,
  useDeleteFarmMutation,
} from "../store/endpoints/farmsApi";
import { useListOrganizationsQuery } from "../store/endpoints/organizationsApi";
import { showSuccess, showError } from "../lib/toast";
import { useDialog } from "../components/ui/DialogProvider";
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
import type { Farm } from "../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function formatArea(area: string | null): string {
  if (!area) return "-";
  const n = Number(area);
  if (Number.isNaN(n)) return "-";
  return `${n.toLocaleString()} acres`;
}

export default function Farms() {
  const navigate = useNavigate();
  const { confirm } = useDialog();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [orgId, setOrgId] = useState("");

  const { data, isLoading, isError, error } = useListFarmsQuery({
    page,
    limit: PAGE_SIZE,
    status: status || undefined,
    orgId: orgId || undefined,
    search: search || undefined,
  });
  const farms = data?.farms ?? [];
  const meta = data?.meta ?? null;

  const { data: orgsData } = useListOrganizationsQuery({ page: 1, limit: 100 });
  const ORG_OPTIONS = [
    { value: "", label: "All organizations" },
    ...(orgsData?.organizations ?? []).map((o) => ({
      value: o.id,
      label: o.name,
    })),
  ];

  const [deleteFarm] = useDeleteFarmMutation();

  useEffect(() => {
    setPage(1);
  }, [status, orgId, search]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function handleDelete(farm: Farm) {
    const ok = await confirm({
      title: "Delete farm?",
      message: `"${farm.name}" will be removed. This can be restored later if needed.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteFarm(farm.id).unwrap();
      showSuccess("Farm deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Farms</h1>
          <p className="mt-1 text-sm text-gray-500">
            {meta
              ? `${meta.total.toLocaleString()} farm(s)`
              : "Manage farms and their owners"}
          </p>
        </div>
        <button
          onClick={() => navigate("/farms/new")}
          className="btn-primary"
        >
          <PlusIcon width={18} height={18} />
          Add farm
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
            placeholder="Search by name, location, or owner"
            className="input-field pl-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            maxLength={100}
          />
        </div>

        <Select
          value={orgId}
          onChange={setOrgId}
          options={ORG_OPTIONS}
          className="sm:w-52"
        />

        <Select
          value={status}
          onChange={(v) => setStatus(v as "" | "active" | "inactive")}
          options={STATUS_OPTIONS}
          className="sm:w-40"
        />
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <Loader message="Loading farms..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {errMsg(error)}
          </div>
        ) : farms.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            No farms found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3 font-semibold">Farm</th>
                    <th className="px-5 py-3 font-semibold">Owner</th>
                    <th className="px-5 py-3 font-semibold">Organization</th>
                    <th className="px-5 py-3 font-semibold">Area</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {farms.map((f) => (
                    <tr
                      key={f.id}
                      className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                    >
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => navigate(`/farms/${f.id}`)}
                          className="text-left font-medium text-gray-900 hover:text-primary hover:underline"
                        >
                          {f.name}
                        </button>
                        {f.location && (
                          <div className="text-xs text-gray-500">
                            {f.location}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {f.owner_name || f.owner_email || "-"}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {f.org_name || (
                          <span className="text-gray-400">Not assigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                        {formatArea(f.area_acres)}
                      </td>
                      <td className="px-5 py-3.5">
                        {f.is_active ? (
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
                            onClick={() => navigate(`/farms/${f.id}`)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                            title="View details"
                          >
                            <EyeIcon width={16} height={16} />
                          </button>
                          <button
                            onClick={() => navigate(`/farms/${f.id}/edit`)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                            title="Edit"
                          >
                            <EditIcon width={16} height={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(f)}
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
