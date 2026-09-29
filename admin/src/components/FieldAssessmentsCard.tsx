import { useNavigate } from "react-router-dom";
import { useListSubmissionsQuery } from "../store/endpoints/programsApi";
import { useHere } from "../lib/returnTo";
import { fmtDateTime } from "../lib/datetime";
import Loader from "./Loader";
import type { Submission } from "../types";

const ROLE_LABEL: Record<Submission["authorRole"], string> = {
  farmer: "Farmer",
  assessor: "Assessor",
};

function StatusBadge({ status }: { status: Submission["reviewStatus"] }) {
  return status === "approved" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      Approved
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">
      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
      In review
    </span>
  );
}

/** What a field has been assessed on, by the farmer and by the assessor. */
export default function FieldAssessmentsCard({
  fieldId,
  programId,
}: {
  fieldId: string;
  programId?: string;
}) {
  const navigate = useNavigate();
  const here = useHere();
  const { data, isLoading } = useListSubmissionsQuery(
    { fieldId, programId, limit: 50 },
    { skip: !fieldId }
  );
  const submissions = data?.submissions ?? [];
  // Both sides in: their answers can be read next to each other.
  const canCompare =
    submissions.some((s) => s.authorRole === "farmer") &&
    submissions.some((s) => s.authorRole === "assessor");

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Submitted assessments
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            What the farmer and the assessor sent in for this field. Open one to score it and
            approve it.
          </p>
        </div>
        {canCompare && (
          <button
            onClick={() =>
              navigate(
                programId
                  ? `/programs/${programId}/fields/${fieldId}/comparison`
                  : `/fields/${fieldId}/comparison`,
                { state: here }
              )
            }
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Compare farmer and assessor
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="md" />
        </div>
      ) : submissions.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-gray-500">
          Nothing has been submitted for this field yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-6 py-3">Filled in by</th>
                <th className="px-6 py-3">Program</th>
                <th className="px-6 py-3">Answered</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Submitted</th>
                <th className="px-6 py-3 text-right">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map((s) => (
                <tr key={s.assessmentId} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <p className="font-medium text-gray-900">{ROLE_LABEL[s.authorRole]}</p>
                    {s.authorName && <p className="text-xs text-gray-500">{s.authorName}</p>}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">{s.programName ?? "-"}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    {s.answered} of {s.totalQuestions}
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status={s.reviewStatus} />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">{fmtDateTime(s.submittedAt)}</td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() =>
                        navigate(
                          programId
                            ? `/programs/${programId}/submissions/${s.assessmentId}`
                            : `/submissions/${s.assessmentId}`,
                          { state: here }
                        )
                      }
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {s.reviewStatus === "approved" ? "View" : "Review"}
                    </button>
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
