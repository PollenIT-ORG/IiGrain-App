import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUrlSearchSync } from "../lib/useUrlSearchSync";
import {
  useListFieldsQuery,
  useDeleteFieldMutation,
} from "../store/endpoints/fieldsApi";
import { useListFarmsQuery } from "../store/endpoints/farmsApi";
import { showSuccess, showError } from "../lib/toast";
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
import type { Field } from "../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const PAGE_SIZE = 10;

const BOUNDARY_OPTIONS = [
  { value: "", label: "Any boundary" },
  { value: "true", label: "Boundary marked" },
  { value: "false", label: "Not marked" },
];

const ACTIVE_OPTIONS = [
  { value: "", label: "Active / inactive" },
  { value: "true", label: "Active only" },
  { value: "false", label: "Inactive only" },
];

function formatArea(area: string | null): string {
  if (!area) return "-";
  const n = Number(area);
  return Number.isNaN(n) ? "-" : `${n.toLocaleString()} acres`;
}

export default function Fields() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [farmId, setFarmId] = useState("");
  const [isActive, setIsActive] = useState("");
  const [hasBoundary, setHasBoundary] = useState("");
  useUrlSearchSync(setSearchInput);

  const { data, isLoading, isFetching, isError, error } = useListFieldsQuery({
    page,
    limit: PAGE_SIZE,
    farmId: farmId || undefined,
    isActive:
      isActive === "true" ? true : isActive === "false" ? false : undefined,
    hasBoundary:
      hasBoundary === "true" ? true : hasBoundary === "false" ? false : undefined,
    search: search || undefined,
  });
  const fields = data?.fields ?? [];
  const meta = data?.meta ?? null;

  const { data: farmsData } = useListFarmsQuery({ page: 1, limit: 100 });
  const FARM_OPTIONS = [
    { value: "", label: "All farms" },
    ...(farmsData?.farms ?? []).map((f) => ({
      value: f.id,
      label: f.name,
    })),
  ];

  const [deleteField] = useDeleteFieldMutation();
  const confirmDelete = useConfirmCascadeDelete();

  useEffect(() => {
    setPage(1);
  }, [farmId, isActive, hasBoundary, search]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function handleDelete(field: Field) {
    const ok = await confirmDelete({
      title: "Delete this field and its record?",
      message:
        `"${field.name}" goes with its soil records, documents, assessments ` +
        "and its place in any program.",
      summaryPath: `/fields/${field.id}/deletion-summary`,
    });
    if (!ok) return;
    try {
      await deleteField(field.id).unwrap();
      showSuccess("Field deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fields</h1>
          <p className="mt-1 text-sm text-gray-500">
            {meta
              ? `${meta.total.toLocaleString()} field(s)`
              : "Manage fields within farms"}
          </p>
        </div>
        <button onClick={() => navigate("/fields/new")} className="btn-primary">
          <PlusIcon width={18} height={18} />
          Add field
        </button>
      </div>

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon
            width={18}
            height={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search by name, crop, or location"
            className="input-field pl-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            maxLength={100}
          />
        </div>
        <Select
          value={farmId}
          onChange={setFarmId}
          options={FARM_OPTIONS}
          className="sm:w-48"
        />
        <Select
          value={isActive}
          onChange={setIsActive}
          options={ACTIVE_OPTIONS}
          className="sm:w-40"
        />
        <Select
          value={hasBoundary}
          onChange={setHasBoundary}
          options={BOUNDARY_OPTIONS}
          className="sm:w-44"
        />
      </div>

      <div className="card overflow-hidden">
        {isLoading || isFetching ? (
          <Loader message="Loading fields..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {errMsg(error)}
          </div>
        ) : fields.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            No fields found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3 font-semibold">Field</th>
                    <th className="px-5 py-3 font-semibold">Farm</th>
                    <th className="px-5 py-3 font-semibold">Crop / Season</th>
                    <th className="px-5 py-3 font-semibold">Area</th>
                    <th className="px-5 py-3 font-semibold">Boundary</th>
                    <th className="px-5 py-3 font-semibold">Active</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f) => (
                    <tr
                      key={f.id}
                      className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                    >
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => navigate(`/fields/${f.id}`)}
                          className="text-left font-medium text-gray-900 hover:text-primary hover:underline"
                        >
                          {f.name}
                        </button>
                        {f.location && (
                          <div className="text-xs text-gray-500">{f.location}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {f.farm_name}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        <div>{f.crop || "-"}</div>
                        {f.season && (
                          <div className="text-xs text-gray-500">{f.season}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                        {formatArea(f.area_acres)}
                      </td>
                      <td className="px-5 py-3.5">
                        {f.boundary ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            Marked
                          </span>
                        ) : (
                          <span className="whitespace-nowrap text-xs text-gray-500">
                            Not marked
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {f.is_active ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-500" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/fields/${f.id}`)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                            title="View details"
                          >
                            <EyeIcon width={16} height={16} />
                          </button>
                          <button
                            onClick={() => navigate(`/fields/${f.id}/edit`)}
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
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
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
