import { useNavigate, useParams } from "react-router-dom";
import {
  useGetFarmQuery,
  useResetFarmMutation,
  useDeleteFarmMutation,
} from "../store/endpoints/farmsApi";
import { useListFieldsQuery } from "../store/endpoints/fieldsApi";
import { showSuccess, showError } from "../lib/toast";
import { useConfirmCascadeDelete } from "../lib/confirmDelete";
import { useDialog } from "../components/ui/DialogProvider";
import Loader from "../components/Loader";
import {
  ChevronLeftIcon,
  EditIcon,
  RefreshIcon,
  TrashIcon,
} from "../components/icons";
import FarmMonitoringCard from "../components/fieldMonitoring/FarmMonitoringCard";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

function formatArea(area: string | null): string {
  if (!area) return "-";
  const n = Number(area);
  return Number.isNaN(n) ? "-" : `${n.toLocaleString()} acres`;
}

export default function FarmDetail() {
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const { id = "" } = useParams();

  const { data: farm, isLoading, isError, error } = useGetFarmQuery(id, {
    skip: !id,
  });

  const { data: fieldsData, isFetching: fieldsLoading } = useListFieldsQuery(
    { page: 1, limit: 100, farmId: id },
    { skip: !id }
  );
  const fields = fieldsData?.fields ?? [];

  const [resetFarm, { isLoading: resetting }] = useResetFarmMutation();
  const [deleteFarm, { isLoading: deleting }] = useDeleteFarmMutation();
  const confirmDelete = useConfirmCascadeDelete();

  async function handleReset() {
    if (!farm) return;
    const ok = await confirm({
      title: "Reset farm?",
      message: `This clears "${farm.name}"'s editable data. This cannot be undone.`,
      confirmLabel: "Reset",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await resetFarm(farm.id).unwrap();
      showSuccess("Farm reset.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete() {
    if (!farm) return;
    const ok = await confirmDelete({
      title: "Delete this farm and everything on it?",
      message:
        `"${farm.name}" goes with its fields and everything recorded on ` +
        "them, including their place in any program.",
      summaryPath: `/farms/${farm.id}/deletion-summary`,
    });
    if (!ok) return;
    try {
      await deleteFarm(farm.id).unwrap();
      showSuccess("Farm deleted.");
      navigate("/farms");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (isLoading) {
    return <Loader variant="fullPage" message="Loading farm..." />;
  }
  if (isError || !farm) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/farms")}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to farms
        </button>
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          {errMsg(error) || "Farm not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate("/farms")}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to farms
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{farm.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              {farm.org_name && (
                <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {farm.org_name}
                </span>
              )}
              {farm.is_active ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
                  Inactive
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/farms/${farm.id}/edit`)}
              className="btn-secondary"
            >
              <EditIcon width={16} height={16} />
              Edit farm
            </button>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="btn-secondary"
            >
              <RefreshIcon width={16} height={16} />
              Reset
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-danger"
            >
              <TrashIcon width={16} height={16} />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Details
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Owner" value={farm.owner_name || farm.owner_email} />
          <Detail label="Owner email" value={farm.owner_email} />
          <Detail label="Organization" value={farm.org_name} />
          <Detail label="Business Entity" value={farm.business_entity} />
          <Detail label="Area" value={formatArea(farm.area_acres)} />
          <Detail label="Location" value={farm.location} />
        </dl>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-300 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Fields ({fields.length})
          </h2>
        </div>
        {fieldsLoading ? (
          <Loader message="Loading fields..." />
        ) : fields.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-500">
            This farm has no fields.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3 font-semibold">Field</th>
                  <th className="px-5 py-3 font-semibold">Crop</th>
                  <th className="px-5 py-3 font-semibold">Area</th>
                  <th className="px-5 py-3 text-right font-semibold">View</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {f.name}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">
                      {f.crop || "-"}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                      {formatArea(f.area_acres)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => navigate(`/fields/${f.id}`)}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FarmMonitoringCard farmId={id ?? ""} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900">{value || "-"}</dd>
    </div>
  );
}
