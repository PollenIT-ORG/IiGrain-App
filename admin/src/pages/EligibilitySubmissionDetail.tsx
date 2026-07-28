import { useNavigate, useParams } from "react-router-dom";
import {
  useGetSubmissionQuery,
  useListSurveyQuestionsQuery,
  useSetSubmissionCategoryMutation,
  useSendContractMutation,
  useAcceptAndEnrollMutation,
  useDeleteSubmissionMutation,
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  STATUS_LABEL,
  STATUS_STYLE,
  SCALE_LABELS,
  type Category,
} from "../store/endpoints/eligibilityApi";
import { errMsg } from "../lib/errMsg";
import { useLiveData } from "../lib/useLiveData";
import { showSuccess, showError } from "../lib/toast";
import { useDialog } from "../components/ui/DialogProvider";
import Loader from "../components/Loader";
import { ChevronLeftIcon, TrashIcon } from "../components/icons";

const BANDS: Category[] = ["gold", "silver", "bronze"];

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

export default function EligibilitySubmissionDetail() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const { confirm } = useDialog();

  const { data, isLoading, isError, error, refetch } = useGetSubmissionQuery(id, {
    skip: !id,
  });
  const { data: qData } = useListSurveyQuestionsQuery();

  useLiveData(["eligibility"], refetch);

  const [setCategory, { isLoading: savingBand }] =
    useSetSubmissionCategoryMutation();
  const [sendContract, { isLoading: sending }] = useSendContractMutation();
  const [acceptAndEnroll, { isLoading: enrolling }] =
    useAcceptAndEnrollMutation();
  const [deleteSubmission, { isLoading: deleting }] =
    useDeleteSubmissionMutation();

  if (isLoading) return <Loader variant="fullPage" message="Loading submission..." />;

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/eligibility")}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to submissions
        </button>
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          {errMsg(error) || "Submission not found."}
        </div>
      </div>
    );
  }

  const { submission: s, contract } = data;
  const questionText = new Map(
    (qData?.questions ?? []).map((q) => [q.id, q.question_text])
  );

  const busy = savingBand || sending || enrolling || deleting;
  const isEnrolled = s.status === "enrolled";
  const notQualified = s.status === "not_qualified";

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete this submission?",
      message: isEnrolled
        ? `${s.full_name} is already enrolled (${s.enrollment_id}). Deleting removes their survey submission from this list. This cannot be undone.`
        : `${s.full_name}'s survey submission will be removed from the list. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteSubmission(s.id).unwrap();
      showSuccess("Submission deleted.");
      navigate("/eligibility");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function changeBand(band: Category) {
    if (band === s.final_category) return;
    const ok = await confirm({
      title: `Set band to ${CATEGORY_LABEL[band]}?`,
      message:
        "This overrides the band the system calculated, and is what the rest of the flow uses.",
      confirmLabel: "Set band",
    });
    if (!ok) return;
    try {
      await setCategory({ id: s.id, category: band }).unwrap();
      showSuccess(`Band set to ${CATEGORY_LABEL[band]}.`);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function markNotQualified() {
    const ok = await confirm({
      title: "Mark as Not Qualified?",
      message:
        "The workflow stops here and no contract can be sent. You can change this back later.",
      confirmLabel: "Mark Not Qualified",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await setCategory({ id: s.id, category: "not_qualified" }).unwrap();
      showSuccess("Marked as Not Qualified.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleSendContract() {
    const ok = await confirm({
      title: "Send the contract?",
      message: `${s.full_name} will receive an email with a secure link to read and sign the program contract.`,
      confirmLabel: "Send contract",
    });
    if (!ok) return;
    try {
      await sendContract(s.id).unwrap();
      showSuccess("Contract emailed to the producer.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleAccept() {
    const ok = await confirm({
      title: "Accept and issue the Enrollment ID?",
      message:
        "This enrolls the producer and emails them their Enrollment ID with the app link. It cannot be undone.",
      confirmLabel: "Accept and enroll",
    });
    if (!ok) return;
    try {
      const updated = await acceptAndEnroll(s.id).unwrap();
      showSuccess(`Enrolled. Enrollment ID ${updated.enrollment_id} emailed.`);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate("/eligibility")}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to submissions
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{s.full_name}</h1>
            <p className="mt-1 text-sm text-gray-500">{s.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${CATEGORY_STYLE[s.final_category]}`}
            >
              {CATEGORY_LABEL[s.final_category]}
            </span>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[s.status]}`}
            >
              {STATUS_LABEL[s.status]}
            </span>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <TrashIcon width={14} height={14} />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Producer + score */}
      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Details
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Phone" value={s.phone ?? "-"} />
          <Detail label="State" value={s.state} />
          <Detail label="Total acres" value={`${s.total_acres} acres`} />
          <Detail
            label="Score"
            value={`${s.score}${qData?.maxScore ? ` / ${qData.maxScore}` : ""}`}
          />
          <Detail label="System band" value={CATEGORY_LABEL[s.auto_category]} />
          <Detail label="Submitted" value={formatDateTime(s.created_at)} />
          <Detail label="Last reviewed" value={formatDateTime(s.reviewed_at)} />
          <Detail label="Enrollment ID" value={s.enrollment_id ?? "Not issued"} />
        </dl>
      </div>

      {/* Decide the band */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Band
        </h2>
        <p className="mt-2 text-sm text-gray-700">
          The system suggested{" "}
          <span className="font-semibold text-gray-900">
            {CATEGORY_LABEL[s.auto_category]}
          </span>
          . Change it here if you disagree.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {BANDS.map((b) => (
            <button
              key={b}
              onClick={() => changeBand(b)}
              disabled={busy || isEnrolled}
              className={`rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                s.final_category === b
                  ? "border-primary bg-primary text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {CATEGORY_LABEL[b]}
            </button>
          ))}
          <button
            onClick={markNotQualified}
            disabled={busy || isEnrolled || notQualified}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Not Qualified
          </button>
        </div>
        {isEnrolled && (
          <p className="mt-3 text-xs text-gray-500">
            This producer is already enrolled, so the band can no longer be
            changed.
          </p>
        )}
      </div>

      {/* Contract and enrollment */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Contract and enrollment
        </h2>

        {notQualified ? (
          <p className="mt-3 text-sm text-gray-700">
            This producer did not qualify, so no contract can be sent.
          </p>
        ) : (
          <>
            {contract && (
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Sent" value={formatDateTime(contract.created_at)} />
                <Detail label="Link expires" value={formatDateTime(contract.token_expires_at)} />
                <Detail label="Signed" value={formatDateTime(contract.signed_at)} />
                <Detail label="Signed by" value={contract.signed_name ?? "-"} />
                <Detail label="Signed from IP" value={contract.signer_ip ?? "-"} />
                <Detail label="Accepted" value={formatDateTime(contract.accepted_at)} />
              </dl>
            )}

            {contract?.signature_url && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Signature
                </p>
                <img
                  src={contract.signature_url}
                  alt="Signature"
                  className="mt-2 h-24 rounded-lg border border-gray-300 bg-white object-contain p-2"
                />
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              {(s.status === "qualified" || s.status === "contract_sent") && (
                <button
                  onClick={handleSendContract}
                  disabled={busy}
                  className="btn-primary"
                >
                  {sending
                    ? "Sending..."
                    : s.status === "contract_sent"
                      ? "Resend contract"
                      : "Send contract"}
                </button>
              )}

              {s.status === "contract_signed" && (
                <button
                  onClick={handleAccept}
                  disabled={busy}
                  className="btn-primary"
                >
                  {enrolling ? "Enrolling..." : "Accept and issue Enrollment ID"}
                </button>
              )}

              {isEnrolled && (
                <span className="inline-flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-5 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Enrollment ID
                  </span>
                  <span className="font-mono text-lg font-bold text-primary">
                    {s.enrollment_id}
                  </span>
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Answers */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-300 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Survey answers ({s.answers.length})
          </h2>
        </div>
        {s.answers.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">
            No answers recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3 font-semibold">Question</th>
                  <th className="px-5 py-3 font-semibold">Answer</th>
                  <th className="px-5 py-3 text-right font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {s.answers.map((a, i) => (
                  <tr
                    key={`${a.questionId}-${i}`}
                    className="border-b border-gray-300/70 last:border-0"
                  >
                    <td className="px-5 py-3 text-gray-900">
                      {questionText.get(a.questionId) ?? "Question removed"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                          a.answer >= 2
                            ? "bg-success/10 text-success"
                            : a.answer === 1
                              ? "bg-warning/15 text-warning"
                              : "bg-gray-300/60 text-gray-700"
                        }`}
                      >
                        {a.answer} · {SCALE_LABELS[a.answer] ?? "-"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      {a.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}
