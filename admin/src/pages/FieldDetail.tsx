import { Fragment } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetFieldQuery,
  useGetFieldSoilQuery,
  useGetFieldDocumentsQuery,
  useGetFieldHistoryQuery,
  useGetAssessmentComparisonQuery,
} from "../store/endpoints/fieldsApi";
import Loader from "../components/Loader";
import {
  ChevronLeftIcon,
  EditIcon,
  FileIcon,
  LeafIcon,
} from "../components/icons";
import type {
  Field,
  FieldStatus,
  FieldSoil,
  FieldDocument,
  FieldHistoryEvent,
  AssessmentComparison,
} from "../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

function StatusBadge({ status }: { status: FieldStatus }) {
  const map = {
    healthy: { cls: "bg-success/10 text-success", dot: "bg-success", label: "Healthy" },
    critical: { cls: "bg-danger/10 text-danger", dot: "bg-danger", label: "Critical" },
    monitor: {
      cls: "bg-yellow-100 text-yellow-700",
      dot: "bg-yellow-500",
      label: "Monitor",
    },
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${map.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
      {map.label}
    </span>
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function FieldDetail() {
  const navigate = useNavigate();
  const { id = "" } = useParams();

  const {
    data: field,
    isLoading,
    isError,
    error,
  } = useGetFieldQuery(id, { skip: !id });

  const { data: soil, isFetching: soilLoading } = useGetFieldSoilQuery(id, {
    skip: !id,
  });
  const { data: documents = [], isFetching: docsLoading } =
    useGetFieldDocumentsQuery(id, { skip: !id });
  const { data: history = [], isFetching: historyLoading } =
    useGetFieldHistoryQuery(id, { skip: !id });
  const { data: comparison, isFetching: comparisonLoading } =
    useGetAssessmentComparisonQuery(id, { skip: !id });

  if (isLoading) {
    return <Loader variant="fullPage" message="Loading field..." />;
  }
  if (isError || !field) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/fields")}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to fields
        </button>
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          {errMsg(error) || "Field not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate("/fields")}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to fields
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{field.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {field.farm_name}
              </span>
              <StatusBadge status={field.status} />
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
          <button
            onClick={() => navigate(`/fields/${field.id}/edit`)}
            className="btn-secondary"
          >
            <EditIcon width={16} height={16} />
            Edit field & soil
          </button>
        </div>
      </div>

      <Overview field={field} />

      <Soil soil={soil ?? null} loading={soilLoading} />

      <Documents
        documents={documents}
        loading={docsLoading}
        formatBytes={formatBytes}
        formatDate={formatDate}
      />

      <Comparison comparison={comparison} loading={comparisonLoading} />

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

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs text-gray-400">-</span>;
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold text-gray-800">
      {score}
    </span>
  );
}

function DiffBadge({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-xs text-gray-400">-</span>;
  if (diff === 0)
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
        0
      </span>
    );
  const up = diff > 0;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
        up ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      {up ? `+${diff}` : diff}
    </span>
  );
}

function SideStatus({
  label,
  side,
}: {
  label: string;
  side: AssessmentComparison["farmer"];
}) {
  return (
    <div className="rounded-lg border border-gray-300 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </span>
        {side.submitted ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Submitted
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
            Pending
          </span>
        )}
      </div>
      <div className="mt-1 text-lg font-bold text-gray-900">
        {side.percentage === null ? "-" : `${side.percentage}%`}
      </div>
    </div>
  );
}

function Comparison({
  comparison,
  loading,
}: {
  comparison: AssessmentComparison | undefined;
  loading: boolean;
}) {
  const hasAny =
    comparison &&
    (comparison.farmer.submitted ||
      comparison.assessor.submitted ||
      comparison.categories.some((c) =>
        c.questions.some(
          (q) => q.farmerScore !== null || q.assessorScore !== null
        )
      ));

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-gray-300 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Assessment Comparison - Farmer vs Assessor
        </h2>
      </div>
      {loading ? (
        <Loader message="Loading comparison..." />
      ) : !comparison || !hasAny ? (
        <div className="px-5 py-12 text-center text-sm text-gray-500">
          No assessment yet for this field.
        </div>
      ) : (
        <div className="p-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <SideStatus label="Farmer" side={comparison.farmer} />
            <SideStatus label="Assessor" side={comparison.assessor} />
          </div>

          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 font-semibold">Question</th>
                  <th className="w-24 px-4 py-3 text-center font-semibold">
                    Farmer
                  </th>
                  <th className="w-24 px-4 py-3 text-center font-semibold">
                    Assessor
                  </th>
                  <th className="w-20 px-4 py-3 text-center font-semibold">
                    Diff
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.categories.map((cat) => (
                  <Fragment key={cat.id}>
                    <tr className="bg-gray-100/60">
                      <td
                        colSpan={4}
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600"
                      >
                        {cat.name}
                      </td>
                    </tr>
                    {cat.questions.map((q) => (
                      <tr
                        key={q.id}
                        className="border-b border-gray-300/70 last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div className="text-gray-900">{q.questionText}</div>
                          {q.questionCode && (
                            <div className="text-xs text-gray-500">
                              {q.questionCode}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ScoreBadge score={q.farmerScore} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ScoreBadge score={q.assessorScore} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <DiffBadge diff={q.difference} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
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
