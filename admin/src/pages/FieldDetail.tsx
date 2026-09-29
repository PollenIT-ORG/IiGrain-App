import { useNavigate, useParams } from "react-router-dom";
import {
  useGetFieldQuery,
  useGetFieldSoilQuery,
  useGetFieldDocumentsQuery,
  useGetFieldHistoryQuery,
  useResetFieldMutation,
  useDeleteFieldMutation,
} from "../store/endpoints/fieldsApi";
import { showSuccess, showError } from "../lib/toast";
import { useConfirmCascadeDelete } from "../lib/confirmDelete";
import { useProgramScope } from "../lib/programScope";
import { useHere } from "../lib/returnTo";
import { useProgramCrumbs } from "../lib/useProgramCrumbs";
import { useDialog } from "../components/ui/DialogProvider";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import Loader from "../components/Loader";
import FieldAssessmentsCard from "../components/FieldAssessmentsCard";
import BoundaryMap from "../components/ui/BoundaryMap";
import { boundaryToRing, validateRing } from "../lib/geo";
import {
  EditIcon,
  FileIcon,
  LeafIcon,
  RefreshIcon,
  TrashIcon,
} from "../components/icons";
import { fmtDateTime } from "../lib/datetime";
import type {
  Field,
  FieldSoil,
  FieldDocument,
  FieldHistoryEvent,
} from "../types";

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

function formatBytes(bytes: number | null): string {
  if (bytes === null || Number.isNaN(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  // A plain calendar date carries no time to convert.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return fmtDateTime(iso, iso);
}

export default function FieldDetail() {
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const { id = "" } = useParams();
  const { programId, to, home } = useProgramScope();
  const listPath = home("/fields");
  const here = useHere();
  const programCrumbs = useProgramCrumbs(programId);
  const parentCrumbs = programId ? programCrumbs : [{ label: "Fields", to: "/fields" }];

  const {
    data: field,
    isLoading,
    isError,
    error,
  } = useGetFieldQuery(id, { skip: !id });

  const [resetField, { isLoading: resetting }] = useResetFieldMutation();
  const [deleteField, { isLoading: deleting }] = useDeleteFieldMutation();
  const confirmDelete = useConfirmCascadeDelete();

  async function handleReset() {
    if (!field) return;
    const ok = await confirm({
      title: "Reset field?",
      message: `This clears "${field.name}"'s editable data. This cannot be undone.`,
      confirmLabel: "Reset",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await resetField(field.id).unwrap();
      showSuccess("Field reset.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete() {
    if (!field) return;
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
      navigate(listPath);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  const { data: soil, isFetching: soilLoading } = useGetFieldSoilQuery(id, {
    skip: !id,
  });
  const { data: documents = [], isFetching: docsLoading } =
    useGetFieldDocumentsQuery(id, { skip: !id });
  const { data: history = [], isFetching: historyLoading } =
    useGetFieldHistoryQuery(id, { skip: !id });

  if (isLoading) {
    return <Loader variant="fullPage" message="Loading field..." />;
  }
  if (isError || !field) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={[...parentCrumbs, { label: "Field" }]} />
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          {errMsg(error) || "Field not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs className="mb-2" items={[...parentCrumbs, { label: field.name }]} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{field.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {field.farm_name}
              </span>
              {field.is_active ? (
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
              onClick={() => navigate(to(`/fields/${field.id}/edit`), { state: here })}
              className="btn-secondary"
            >
              <EditIcon width={16} height={16} />
              Edit field & soil
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

      <Overview field={field} />

      <Soil soil={soil ?? null} loading={soilLoading} />

      <Boundary field={field} formatDate={formatDate} />

      <FieldAssessmentsCard fieldId={field.id} programId={programId} />

      <Documents
        documents={documents}
        loading={docsLoading}
        formatBytes={formatBytes}
        formatDate={formatDate}
      />

      <History history={history} loading={historyLoading} formatDate={formatDate} />
    </div>
  );
}

function Overview({ field }: { field: Field }) {
  return (
    <div className="card p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Overview
      </h2>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Crop" value={field.crop} />
        <Detail label="Season" value={field.season} />
        <Detail label="Area" value={formatArea(field.area_acres)} />
        <Detail label="Irrigation" value={field.irrigation} />
        <Detail label="Location" value={field.location} />
        <Detail label="Sowing date" value={field.sowing_date} />
        <Detail label="Expected harvest" value={field.expected_harvest} />
      </dl>
    </div>
  );
}

function Soil({ soil, loading }: { soil: FieldSoil | null; loading: boolean }) {
  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center gap-2">
        <LeafIcon width={18} height={18} className="text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Soil
        </h2>
      </div>
      {loading ? (
        <Loader message="Loading soil..." />
      ) : !soil ? (
        <p className="text-sm text-gray-500">
          No soil record yet. Use “Edit field &amp; soil” to add one.
        </p>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="pH" value={soil.ph} />
            <Detail label="Organic matter (%)" value={soil.organic_matter} />
            <Detail label="Moisture (%)" value={soil.moisture} />
            <Detail label="Texture" value={soil.texture} />
            <Detail label="Nitrogen (N)" value={soil.nitrogen} />
            <Detail label="Phosphorus (P)" value={soil.phosphorus} />
            <Detail label="Potassium (K)" value={soil.potassium} />
            <Detail label="Tested on" value={soil.tested_on} />
          </dl>
          {soil.notes && (
            <div className="mt-4">
              <Detail label="Notes" value={soil.notes} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Documents({
  documents,
  loading,
  formatBytes,
  formatDate,
}: {
  documents: FieldDocument[];
  loading: boolean;
  formatBytes: (b: number | null) => string;
  formatDate: (s: string | null) => string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Documents ({documents.length})
        </h2>
        <span className="text-xs text-gray-400">Read-only • uploaded by farmer</span>
      </div>
      {loading ? (
        <Loader message="Loading documents..." />
      ) : documents.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-gray-500">
          No documents uploaded for this field.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 font-semibold">Size</th>
                <th className="px-5 py-3 font-semibold">Uploaded</th>
                <th className="px-5 py-3 text-right font-semibold">Open</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 font-medium text-gray-900">
                      <FileIcon
                        width={16}
                        height={16}
                        className="shrink-0 text-gray-400"
                      />
                      {d.name}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700">
                    {d.mime_type || "-"}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                    {formatBytes(d.size_bytes)}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                    {formatDate(d.created_at)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end">
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Boundary({
  field,
  formatDate,
}: {
  field: Field;
  formatDate: (iso: string | null) => string;
}) {
  const ring = boundaryToRing(field.boundary);
  const check = validateRing(ring);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-gray-300 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Boundary
        </h2>
        {ring.length > 0 && (
          <p className="text-xs text-gray-500">
            {ring.length} points, {check.areaAcres.toFixed(2)} acres, marked{" "}
            {formatDate(field.boundary_updated_at)}
          </p>
        )}
      </div>
      {ring.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-gray-500">
          No boundary marked for this field yet.
        </div>
      ) : (
        <div className="p-5">
          <BoundaryMap value={field.boundary} onChange={() => {}} readOnly height={320} />
        </div>
      )}
    </div>
  );
}

function History({
  history,
  loading,
  formatDate,
}: {
  history: FieldHistoryEvent[];
  loading: boolean;
  formatDate: (s: string | null) => string;
}) {
  return (
    <div className="card p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
        History
      </h2>
      {loading ? (
        <Loader message="Loading history..." />
      ) : history.length === 0 ? (
        <p className="text-sm text-gray-500">No activity recorded yet.</p>
      ) : (
        <ol className="relative space-y-5 border-l border-gray-300 pl-6">
          {history.map((h, i) => (
            <li key={`${h.type}-${h.at}-${i}`} className="relative">
              <span className="absolute -left-[1.6rem] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-white" />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-gray-900">{h.title}</p>
                {h.detail && (
                  <p className="text-sm text-gray-600">{h.detail}</p>
                )}
                <p className="text-xs text-gray-400">{formatDate(h.at)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
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
