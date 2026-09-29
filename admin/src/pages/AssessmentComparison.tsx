import { useParams } from "react-router-dom";
import { useGetAssessmentComparisonQuery } from "../store/endpoints/fieldsApi";
import { useProgramScope } from "../lib/programScope";
import { useProgramCrumbs } from "../lib/useProgramCrumbs";
import { useReturnTo } from "../lib/returnTo";
import { fmtDateTime } from "../lib/datetime";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import Loader from "../components/Loader";
import type { ComparisonSide } from "../types";

function SideCard({ title, side }: { title: string; side: ComparisonSide }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
      {side.submitted ? (
        <>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {side.percentage === null ? "Submitted" : `${side.percentage}%`}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{fmtDateTime(side.submittedAt)}</p>
        </>
      ) : (
        <p className="mt-1 text-lg font-semibold text-gray-400">Not submitted</p>
      )}
    </div>
  );
}

/** How far apart the two sides are on one question. */
function Difference({ value }: { value: number | null }) {
  if (value === null) return <span className="text-sm text-gray-400">-</span>;
  if (value === 0) return <span className="text-sm font-medium text-gray-600">Same</span>;
  const up = value > 0;
  return (
    <span className={`text-sm font-semibold ${up ? "text-success" : "text-danger"}`}>
      {up ? `+${value}` : value}
    </span>
  );
}

/** The farmer's assessment next to the assessor's, question by question. */
export default function AssessmentComparison() {
  const { fieldId = "" } = useParams();
  const { programId, to } = useProgramScope();
  const programCrumbs = useProgramCrumbs(programId);
  const back = useReturnTo(to(`/fields/${fieldId}`));

  const { data, isLoading, isError } = useGetAssessmentComparisonQuery(
    { id: fieldId, programId },
    { skip: !fieldId }
  );

  if (isLoading) return <Loader variant="fullPage" message="Loading comparison..." />;

  if (isError || !data) {
    return (
      <div className="card px-5 py-16 text-center text-sm text-gray-500">
        This comparison could not be loaded.
      </div>
    );
  }

  const answered = data.categories.reduce(
    (n, c) => n + c.questions.filter((q) => q.farmerAnswered && q.assessorAnswered).length,
    0
  );

  return (
    <div className="space-y-5">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[
            ...(programId ? programCrumbs : [{ label: "Fields", to: "/fields" }]),
            { label: data.field.name, to: to(`/fields/${fieldId}`) },
            { label: "Comparison" },
          ]}
        />
        <h1 className="text-2xl font-bold text-gray-900">Farmer and assessor</h1>
        <p className="mt-1 text-sm text-gray-500">
          {data.field.name} - what each side answered, side by side.
        </p>
      </div>

      <div className="card grid gap-4 p-6 sm:grid-cols-3">
        <SideCard title="Farmer" side={data.farmer} />
        <SideCard title="Assessor" side={data.assessor} />
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Answered by both</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{answered}</p>
        </div>
      </div>

      {data.categories.length === 0 ? (
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          Nothing has been answered for this field yet.
        </div>
      ) : (
        data.categories.map((category) => (
          <div key={category.id} className="card overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                {category.name}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Question</th>
                    <th className="px-6 py-3">Farmer</th>
                    <th className="px-6 py-3">Assessor</th>
                    <th className="px-6 py-3 w-28">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {category.questions.map((q) => (
                    <tr key={q.id} className="align-top">
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-900">{q.questionText}</p>
                        {q.questionCode && (
                          <p className="mt-0.5 font-mono text-xs text-gray-400">{q.questionCode}</p>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <p className="text-sm text-gray-900">{q.farmerAnswer ?? "Not answered"}</p>
                        {q.farmerRecords > 1 && (
                          <p className="mt-0.5 text-xs text-gray-500">{q.farmerRecords} records</p>
                        )}
                        <p className="mt-0.5 text-xs text-gray-500">
                          {q.farmerScore === null ? "No score yet" : `${q.farmerScore} of ${q.maxScore}`}
                        </p>
                      </td>
                      <td className="px-6 py-3">
                        <p className="text-sm text-gray-900">
                          {q.assessorAnswer ?? "Not answered"}
                        </p>
                        {q.assessorRecords > 1 && (
                          <p className="mt-0.5 text-xs text-gray-500">{q.assessorRecords} records</p>
                        )}
                        <p className="mt-0.5 text-xs text-gray-500">
                          {q.assessorScore === null
                            ? "No score yet"
                            : `${q.assessorScore} of ${q.maxScore}`}
                        </p>
                      </td>
                      <td className="px-6 py-3">
                        <Difference value={q.difference} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <div className="flex justify-end">
        <button className="btn-secondary" onClick={() => back.go()}>
          Back
        </button>
      </div>
    </div>
  );
}
