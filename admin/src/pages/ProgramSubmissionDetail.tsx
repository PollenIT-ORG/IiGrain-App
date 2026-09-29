import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useGetPasSubmissionQuery,
  useGetPasTemplateQuery,
  useSetPasCategoryMutation,
  useSendPasContractMutation,
  useAcceptPasEnrollMutation,
  useWithdrawPasSubmissionMutation,
  useDeletePasSubmissionMutation,
  CATEGORY_LABEL,
  STATUS_LABEL,
  STATUS_DOT,
  SCALE_LABELS,
  type Category,
  type Submission,
} from "../store/endpoints/programAdminSurveyApi";
import { CategoryIconChip } from "./survey/SurveyIcons";
import { errMsg } from "../lib/errMsg";
import { useProgramScope } from "../lib/programScope";
import { useReturnTo, useTrail } from "../lib/returnTo";
import { useProgramCrumbs } from "../lib/useProgramCrumbs";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import { useLiveData } from "../lib/useLiveData";
import { showSuccess, showError } from "../lib/toast";
import { openApiPdf } from "../lib/openPdf";
import { useDialog } from "../components/ui/DialogProvider";
import Select from "../components/ui/Select";
import Loader from "../components/Loader";
import { fmtDateTime as formatDateTime } from "../lib/datetime";

// Each score keeps its own colour on the answer cards - red (0) to green (3).
const SCALE_STYLE = [
  { num: "text-danger", border: "border-danger", bg: "bg-danger/5", check: "bg-danger" },
  { num: "text-accent", border: "border-accent", bg: "bg-accent/5", check: "bg-accent" },
  { num: "text-info", border: "border-info", bg: "bg-info/5", check: "bg-info" },
  { num: "text-success", border: "border-success", bg: "bg-success/5", check: "bg-success" },
];

const BAND_PILL: Record<Category, string> = {
  bronze: "bg-orange-50 border-orange-200 text-orange-700",
  silver: "bg-slate-50 border-slate-200 text-slate-600",
  gold: "bg-amber-50 border-amber-200 text-amber-700",
  not_qualified: "bg-rose-50 border-rose-200 text-rose-700",
};

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
  "bg-cyan-100 text-cyan-700",
];
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}
function avatarColor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function esc(v: string): string {
  return v.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c
  );
}
function fmtDateTime(iso: string | null): string {
  return formatDateTime(iso);
}

type Tab = "responses" | "details" | "activity";

export default function ProgramSubmissionDetail() {
  const { id = "", templateId: surveyId } = useParams();
  const { confirm, prompt } = useDialog();
  const { programId, home } = useProgramScope();
  const listPath = surveyId
    ? `/surveys/surveys/${surveyId}`
    : home("/survey-submissions");
  const back = useReturnTo(listPath);
  const programCrumbs = useProgramCrumbs(programId);
  const { data: survey } = useGetPasTemplateQuery(surveyId ?? "", {
    skip: !surveyId,
  });
  const trail = useTrail();
  const parentCrumbs = trail
    ? trail
    : programId
    ? programCrumbs
    : surveyId
      ? [
          { label: "Surveys", to: "/surveys" },
          { label: survey?.template.name ?? "Survey", to: back.path, state: back.state },
        ]
      : [{ label: "Survey Submissions", to: back.path, state: back.state }];
  const backLabel = programId
    ? "Back to program"
    : surveyId
      ? "Back to survey"
      : "Back to Submissions";

  const { data, isLoading, isError, error, refetch } = useGetPasSubmissionQuery(
    id,
    { skip: !id }
  );
  // The questions, categories and score bands come from the program's template.
  const templateId = data?.submission.template_id ?? "";
  const { data: tplData } = useGetPasTemplateQuery(templateId, {
    skip: !templateId,
  });

  useLiveData(["program_admin_survey"], refetch);

  const [setCategory, { isLoading: savingBand }] = useSetPasCategoryMutation();
  const [sendContract, { isLoading: sending }] = useSendPasContractMutation();
  const [acceptAndEnroll, { isLoading: enrolling }] = useAcceptPasEnrollMutation();
  const [withdrawSubmission] = useWithdrawPasSubmissionMutation();
  const [deleteSubmission] = useDeletePasSubmissionMutation();

  const [tab, setTab] = useState<Tab>("responses");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [overrideBand, setOverrideBand] = useState<Category | "">("");
  const [showPanel, setShowPanel] = useState(true);

  const categories = tplData?.categories ?? [];
  const questions = tplData?.questions ?? [];
  const rules = tplData?.scoringRules ?? [];
  const maxScore = useMemo(() => {
    const activeCats = new Set(
      categories.filter((c) => c.is_active).map((c) => c.id)
    );
    return questions
      .filter(
        (q) => q.is_active && q.category_id && activeCats.has(q.category_id)
      )
      .reduce((sum, q) => sum + 3 * q.weight, 0);
  }, [categories, questions]);

  const answerMap = useMemo(() => {
    const m = new Map<string, { answer: number; score: number }>();
    for (const a of data?.submission.answers ?? [])
      m.set(a.questionId, { answer: a.answer, score: a.score });
    return m;
  }, [data]);

  const questionsByCat = useMemo(() => {
    const m = new Map<string, typeof questions>();
    for (const q of questions) {
      if (!q.category_id) continue;
      const list = m.get(q.category_id) ?? [];
      list.push(q);
      m.set(q.category_id, list);
    }
    return m;
  }, [questions]);

  // Only the categories this producer actually answered - i.e. the ones that
  // were active when they took the survey. Categories deactivated later (or not
  // part of their survey) are left out so the breakdown matches what they saw.
  const answeredCategories = useMemo(
    () =>
      categories.filter((c) =>
        (questionsByCat.get(c.id) ?? []).some((q) => answerMap.has(q.id))
      ),
    [categories, questionsByCat, answerMap]
  );

  const catScore = (catId: string) => {
    const qs = questionsByCat.get(catId) ?? [];
    let got = 0;
    let max = 0;
    for (const q of qs) {
      max += 3 * q.weight;
      got += answerMap.get(q.id)?.score ?? 0;
    }
    return { got, max };
  };

  if (isLoading)
    return <Loader variant="fullPage" message="Loading submission..." />;

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={[...parentCrumbs, { label: "View Submission" }]} />
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          {errMsg(error) || "Submission not found."}
        </div>
      </div>
    );
  }

  const s = data.submission;
  const contract = data.contract;
  const busy = savingBand || sending || enrolling;
  const isEnrolled = s.status === "enrolled";
  const notQualified = s.status === "not_qualified";
  const pct = maxScore ? Math.round((s.score / maxScore) * 100) : 0;
  const currentCatId = activeCat ?? answeredCategories[0]?.id ?? null;
  const currentCat =
    answeredCategories.find((c) => c.id === currentCatId) ?? null;
  const currentQs = currentCatId ? questionsByCat.get(currentCatId) ?? [] : [];
  const shownQs = showAll ? currentQs : currentQs.slice(0, 6);

  async function applyBand(band: Category) {
    const notQ = band === "not_qualified";
    // Ask for the reason in a popup. The reason is saved and included in the
    // email the producer receives. Leaving it blank is allowed.
    const entered = await prompt({
      title: notQ
        ? "Mark as Not Qualified"
        : `Set qualification to ${CATEGORY_LABEL[band]}`,
      message: notQ
        ? "The producer will be emailed that they did not qualify. Add a reason to include in that email (optional). The workflow stops here and no contract can be sent."
        : "The producer will be emailed that they qualify. Add a reason to include in that email (optional).",
      label: "Reason (optional)",
      placeholder: notQ
        ? "e.g. Land does not meet the minimum requirement."
        : "e.g. Adjusted band after reviewing soil practices.",
      defaultValue: s.override_reason ?? "",
      multiline: true,
      maxLength: 250,
      confirmLabel: notQ ? "Mark Not Qualified & Email" : "Apply & Email",
      tone: notQ ? "danger" : "primary",
    });
    if (entered === null) return; // cancelled
    try {
      await setCategory({
        id: s.id,
        category: band,
        reason: entered.trim() || undefined,
      }).unwrap();
      showSuccess(
        notQ
          ? "Marked as Not Qualified. The producer has been emailed."
          : `Qualification set to ${CATEGORY_LABEL[band]}. The producer has been emailed.`
      );
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleSendContract() {
    const ok = await confirm({
      title: "Send the contract?",
      message: `${s.full_name} will receive an email with a secure link to read and sign the contract.`,
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
        "This enrolls the producer and emails them their Enrollment ID with the app link.",
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

  async function handleWithdraw() {
    const ok = await confirm({
      title: "Withdraw this submission?",
      message: `${s.full_name}'s submission will be marked as withdrawn.`,
      confirmLabel: "Withdraw",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await withdrawSubmission(s.id).unwrap();
      showSuccess("Submission withdrawn.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete this submission?",
      message: `${s.full_name}'s survey submission will be removed. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteSubmission(s.id).unwrap();
      showSuccess("Submission deleted.");
      back.go();
    } catch (err) {
      showError(errMsg(err));
    }
  }

  function handleDownloadPdf() {
    const catHtml = answeredCategories
      .map((c, ci) => {
        const qs = questionsByCat.get(c.id) ?? [];
        const { got, max } = catScore(c.id);
        const rows = qs
          .map((q, qi) => {
            const a = answerMap.get(q.id);
            const label = a
              ? (q.options && q.options[a.answer]) || SCALE_LABELS[a.answer]
              : "-";
            return `<tr><td>${qi + 1}. ${esc(q.question_text)}</td><td class="c">${a ? a.answer : "-"}</td><td>${esc(label)}</td><td class="r">${a ? a.score : "-"}</td></tr>`;
          })
          .join("");
        return `<h3>${ci + 1}. ${esc(c.name)} <span class="cs">${got} / ${max}</span></h3>
          <table><thead><tr><th>Question</th><th class="c">Value</th><th>Answer</th><th class="r">Score</th></tr></thead><tbody>${rows}</tbody></table>`;
      })
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Submission - ${esc(s.full_name)}</title>
<style>
  *{box-sizing:border-box;font-family:Inter,Arial,sans-serif;color:#212829}
  body{margin:32px;font-size:12px}
  h1{font-size:20px;margin:0 0 2px;color:#136F3F}
  h2{font-size:14px;margin:20px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
  h3{font-size:13px;margin:16px 0 6px;background:#f2f7f4;padding:6px 8px;border-radius:6px}
  h3 .cs{float:right;color:#136F3F}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  th,td{border:1px solid #e2e6ea;padding:5px 8px;text-align:left;vertical-align:top}
  th{background:#f5f7f9;font-size:11px;text-transform:uppercase;color:#666}
  .c{text-align:center;width:50px}.r{text-align:right;width:60px}
  .meta{width:100%;margin:8px 0 4px}.meta td{border:0;padding:2px 12px 2px 0;width:33%}
  .lbl{color:#888;font-size:10px;text-transform:uppercase}
  .band{display:inline-block;padding:3px 10px;border-radius:99px;background:#f2f7f4;color:#136F3F;font-weight:700}
</style></head><body>
  <h1>iiGrain - Survey Submission</h1>
  <table class="meta"><tr>
    <td><div class="lbl">Producer</div><b>${esc(s.full_name)}</b>${s.farm_name ? " - " + esc(s.farm_name) : ""}</td>
    <td><div class="lbl">Email</div>${esc(s.email)}${s.phone ? " / " + esc(s.phone) : ""}</td>
    <td><div class="lbl">Status</div>${esc(STATUS_LABEL[s.status])}</td>
  </tr><tr>
    <td><div class="lbl">Submission ID</div>SUB-${s.id.slice(0, 8).toUpperCase()}</td>
    <td><div class="lbl">Submitted On</div>${esc(fmtDateTime(s.created_at))}</td>
    <td><div class="lbl">Program</div>${esc(s.survey_name)}</td>
  </tr><tr>
    <td><div class="lbl">Land</div>${esc(String(s.total_acres ?? "-"))} acres, ${esc(s.state ?? "-")}</td>
    <td><div class="lbl">Referral</div>${esc(s.referral_source ?? "-")}</td>
    <td><div class="lbl">Total Questions</div>${s.answers.length}</td>
  </tr></table>
  <h2>Overall Qualification: <span class="band">${esc(CATEGORY_LABEL[s.final_category])}</span> &nbsp; Score ${s.score} / ${maxScore} (${pct}%)</h2>
  ${catHtml}
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      showError("Please allow pop-ups to download the PDF.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Breadcrumbs items={[...parentCrumbs, { label: "View Submission" }]} />
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadPdf} className="btn-secondary">
            <IconDownload />
            Download PDF
          </button>
          <button
            onClick={() => setShowPanel((v) => !v)}
            title={showPanel ? "Hide side panel" : "Show side panel"}
            aria-label="Toggle side panel"
            className={`grid h-10 w-10 place-items-center rounded-lg border transition-colors ${
              showPanel
                ? "border-primary/40 bg-primary/5 text-primary"
                : "border-gray-300 text-gray-500 hover:bg-gray-100"
            }`}
          >
            <IconPanel />
          </button>
          <button onClick={() => back.go()} className="btn-secondary">
            <IconArrowLeft />
            {backLabel}
          </button>
        </div>
      </div>

      <div
        className={`grid gap-5 xl:items-start ${showPanel ? "xl:grid-cols-[1fr_340px]" : "xl:grid-cols-1"}`}
      >
        {/* Main column */}
        <div className="min-w-0 space-y-5">
          {/* Producer header - producer info on the left, meta grid on the
              right; they sit side by side when there is room (panel hidden). */}
          <div className="card flex flex-col gap-6 p-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <span
                className={`grid h-16 w-16 shrink-0 place-items-center rounded-full text-lg font-bold ${avatarColor(s.email || s.full_name)}`}
              >
                {initials(s.full_name)}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl font-bold text-gray-900">
                    {s.full_name}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s.status]}`} />
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
                {s.farm_name && (
                  <p className="mt-0.5 text-sm text-gray-500">{s.farm_name}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1.5">
                    <IconMail />
                    {s.email}
                  </span>
                  {s.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <IconPhone />
                      {s.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* min-w-0 (not shrink-0) so a long program name wraps inside the
                card instead of widening it and pushing the side panel off. */}
            <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Meta label="Submission ID" value={`SUB-${s.id.slice(0, 8).toUpperCase()}`} />
              <Meta label="Submitted On" value={fmtDateTime(s.created_at)} />
              <Meta label="Program" value={s.survey_name} />
              <Meta label="Total Questions" value={String(s.answers.length)} />
              <Meta label="Referral" value={s.referral_source || "-"} />
              <Meta label="Land" value={`${s.total_acres ?? "-"} acres`} />
            </div>
          </div>

          {/* Tabs - the tab bar sticks flush under the app header (the -top-6
              offsets the scroll area's top padding) while content scrolls. */}
          <div className="card">
            <div className="sticky -top-6 z-10 flex gap-1 rounded-t-xl border-b border-gray-300 bg-white px-4">
              {(
                [
                  ["responses", "Responses"],
                  ["details", "Producer Details"],
                  ["activity", "Activity Log"],
                ] as Array<[Tab, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                    tab === key
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "responses" && (
              <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
                {/* Category column stretches to full height (divider runs down);
                    the list inside sticks in view while the questions scroll. */}
                <div className="border-b border-gray-300/70 lg:border-b-0 lg:border-r">
                  <div className="p-4 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
                  <p className="mb-3 text-sm font-bold text-gray-900">
                    Categories{" "}
                    <span className="font-normal text-gray-400">
                      (Score by Category)
                    </span>
                  </p>
                  <div className="space-y-1.5">
                    {answeredCategories.map((c, i) => {
                      const { got, max } = catScore(c.id);
                      const active = c.id === currentCatId;
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setActiveCat(c.id);
                            setShowAll(false);
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                            active
                              ? "border-primary/40 bg-primary/5"
                              : "border-transparent hover:bg-gray-100"
                          }`}
                        >
                          <CategoryIconChip icon={c.icon} size={18} className="h-9 w-9 shrink-0 rounded-lg" />
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-sm font-semibold ${active ? "text-primary" : "text-gray-900"}`}
                            >
                              {i + 1}. {c.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {got} / {max}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  </div>
                </div>

                {/* Questions */}
                <div className="p-5">
                  {currentCat && (
                    <div className="flex items-start justify-between gap-4 border-b border-gray-300/70 pb-4">
                      <div className="flex items-start gap-3">
                        <CategoryIconChip icon={currentCat.icon} size={22} className="h-11 w-11 shrink-0 rounded-xl" />
                        <div>
                          <h3 className="font-bold text-gray-900">
                            {answeredCategories.findIndex((c) => c.id === currentCat.id) + 1}.{" "}
                            {currentCat.name}
                          </h3>
                          {currentCat.description && (
                            <p className="mt-0.5 max-w-lg text-sm text-gray-500">
                              {currentCat.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Category Score
                        </p>
                        <p className="text-sm font-bold text-gray-900">
                          {currentCatId ? catScore(currentCatId).got : 0} /{" "}
                          {currentCatId ? catScore(currentCatId).max : 0}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="divide-y divide-gray-300/60">
                    {shownQs.map((q, i) => {
                      const ans = answerMap.get(q.id);
                      return (
                        <div key={q.id} className="py-5">
                          <div className="flex items-start justify-between gap-3">
                            <p className="flex gap-3 font-medium text-gray-900">
                              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gray-100 text-xs font-bold text-gray-500">
                                {i + 1}
                              </span>
                              <span>{q.question_text}</span>
                            </p>
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gray-100 text-sm font-bold text-gray-700">
                              {ans?.answer ?? "-"}
                            </span>
                          </div>
                          <div className="ml-9 mt-3 grid grid-cols-2 gap-3">
                            {[0, 1, 2, 3].map((value) => {
                              const selected = ans?.answer === value;
                              const c = SCALE_STYLE[value];
                              const label =
                                (q.options && q.options[value]) ||
                                SCALE_LABELS[value];
                              return (
                                <div
                                  key={value}
                                  className={`relative rounded-xl border p-3 text-center ${
                                    selected
                                      ? `${c.border} ${c.bg}`
                                      : "border-gray-300 bg-white"
                                  }`}
                                >
                                  {selected && (
                                    <span
                                      className={`absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full text-white ${c.check}`}
                                    >
                                      <IconCheck />
                                    </span>
                                  )}
                                  <span
                                    className={`block text-lg font-extrabold ${c.num}`}
                                  >
                                    {value}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-gray-500">
                                    {label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {currentQs.length > 6 && (
                    <div className="pt-3 text-center">
                      <button
                        onClick={() => setShowAll((v) => !v)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                      >
                        {showAll
                          ? "Show fewer"
                          : `Show all ${currentQs.length} questions`}
                        <IconChevronDown flip={showAll} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "details" && (
              <div className="space-y-6 p-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Meta label="Full name" value={s.full_name} />
                  <Meta label="Email" value={s.email} />
                  <Meta label="Phone" value={s.phone ?? "-"} />
                  <Meta label="Farm / business" value={s.farm_name ?? "-"} />
                  <Meta label="State" value={s.state ?? "-"} />
                  <Meta label="Total acres" value={`${s.total_acres ?? "-"}`} />
                  <Meta label="Referral source" value={s.referral_source ?? "-"} />
                  <Meta label="Source" value={s.survey_name} />
                  <Meta label="Enrollment ID" value={s.enrollment_id ?? "Not issued"} />
                </div>

                {contract && (
                  <div className="border-t border-gray-200 pt-6">
                    <p className="text-sm font-bold text-gray-900">Contract</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Meta label="Sent" value={fmtDateTime(contract.created_at)} />
                      <Meta label="Link expires" value={fmtDateTime(contract.token_expires_at)} />
                      <Meta label="Signed on" value={fmtDateTime(contract.signed_at)} />
                      <Meta label="Signed by" value={contract.signed_name ?? "-"} />
                      <Meta label="Signed from IP" value={contract.signer_ip ?? "-"} />
                      <Meta label="Accepted on" value={fmtDateTime(contract.accepted_at)} />
                    </div>

                    {/* The signed copy: the contract the producer read with a
                        signature page carrying their details and signature. */}
                    {contract.signed_pdf_url && (
                      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            Signed contract PDF
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            The contract as signed, with the producer's details
                            and signature.
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            void openApiPdf(
                              `/program-admin-surveys/submissions/${s.id}/signed-pdf`,
                              `signed-contract-${s.full_name}.pdf`
                            )
                          }
                          className="btn-secondary shrink-0"
                        >
                          <IconDownload />
                          Download PDF
                        </button>
                      </div>
                    )}

                    {contract.signature_url && (
                      <div className="mt-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Signature
                        </p>
                        <img
                          src={contract.signature_url}
                          alt="Producer signature"
                          className="mt-2 h-28 rounded-lg border border-gray-300 bg-white object-contain p-2"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "activity" && (
              <div className="p-6">
                <Timeline s={s} contractCreated={contract?.created_at ?? null} contractSigned={contract?.signed_at ?? null} />
              </div>
            )}
          </div>
        </div>

        {/* Right panel - sticks in view while the responses scroll. */}
        {showPanel && (
        <div className="space-y-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
          {/* Overall qualification */}
          <div className="card p-5">
            <p className="text-sm font-bold text-gray-900">
              Overall Qualification{" "}
              <span className="font-normal text-gray-400">(Current)</span>
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className={`grid h-14 w-14 place-items-center rounded-full border ${BAND_PILL[s.final_category]}`}>
                <IconMedal />
              </span>
              <div>
                <p className="text-2xl font-extrabold uppercase text-gray-900">
                  {CATEGORY_LABEL[s.final_category]}
                </p>
                <p className="text-xs text-gray-500">Current Category</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-gray-300/70 pt-4 text-sm">
              <span className="text-gray-500">Total Score</span>
              <span className="font-semibold text-gray-900">
                {s.score} / {maxScore} ({pct}%)
              </span>
            </div>
            {s.override_reason && (
              <div className="mt-3 rounded-lg border border-gray-300/70 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Override Reason
                </p>
                <p className="mt-1 text-sm text-gray-700">{s.override_reason}</p>
              </div>
            )}
            {rules.length > 0 && (
              <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Category Thresholds
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["bronze", "silver", "gold"] as Category[]).map((b) => {
                    const r = rules.find((x) => x.category === b);
                    // Bands are already percentages of the max score - show them
                    // directly (gold's open-ended top is capped at 100).
                    const lo = r ? Math.min(100, Math.round(r.min_score)) : 0;
                    const hi = r ? Math.min(100, Math.round(r.max_score)) : 0;
                    return (
                      <div
                        key={b}
                        className={`rounded-lg border px-2 py-1.5 text-center ${BAND_PILL[b]} ${s.final_category === b ? "ring-2 ring-offset-1 ring-current" : ""}`}
                      >
                        <p className="text-[10px] font-bold uppercase">
                          {CATEGORY_LABEL[b]}
                        </p>
                        <p className="text-[11px]">
                          {r ? `${lo}-${hi}%` : "-"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Override qualification */}
          <div className="card p-5">
            <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
              Override Qualification
            </p>
            <label className="label mt-4">Select Qualification</label>
            <Select
              value={overrideBand || s.final_category}
              onChange={(v) => setOverrideBand(v as Category)}
              options={(["bronze", "silver", "gold", "not_qualified"] as Category[]).map(
                (b) => ({ value: b, label: CATEGORY_LABEL[b] })
              )}
              disabled={busy || isEnrolled}
            />
            <p className="mt-1.5 text-xs text-gray-500">
              You can override the system recommendation if needed.
            </p>

            <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-500">
              <IconMail />
              <span>
                Applying a qualification opens a box to add a reason, then emails
                the producer their result with that reason.
              </span>
            </p>

            <div className="mt-4 space-y-2">
              <button
                onClick={() =>
                  applyBand((overrideBand || s.final_category) as Category)
                }
                disabled={busy || isEnrolled}
                className="btn-primary w-full disabled:opacity-60"
              >
                <IconCheckCircle />
                Mark as Qualified
              </button>
              <button
                onClick={() => applyBand("not_qualified")}
                disabled={busy || isEnrolled || notQualified}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-danger/40 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconXCircle />
                Mark as Not Qualified
              </button>

              {s.status === "contract_signed" ? (
                <button
                  onClick={handleAccept}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
                >
                  <IconMail />
                  Accept &amp; Enroll
                </button>
              ) : (
                <button
                  onClick={handleSendContract}
                  disabled={busy || notQualified || isEnrolled}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IconMail />
                  <span className="text-left">
                    {s.status === "contract_sent" ? "Resend Contract" : "Send Contract"}
                    <span className="block text-[11px] font-normal text-gray-400">
                      Send enrollment contract to producer
                    </span>
                  </span>
                </button>
              )}

              {s.status !== "withdrawn" && !isEnrolled && (
                <button
                  onClick={handleWithdraw}
                  disabled={busy}
                  className="w-full rounded-lg py-2 text-xs font-medium text-gray-500 hover:text-danger"
                >
                  Withdraw submission
                </button>
              )}
              <button
                onClick={handleDelete}
                className="w-full rounded-lg py-1 text-xs font-medium text-gray-400 hover:text-danger"
              >
                Delete submission
              </button>
            </div>
          </div>

          {/* History */}
          <div className="card p-5">
            <p className="text-sm font-bold text-gray-900">History</p>
            <div className="mt-4">
              <Timeline
                s={s}
                contractCreated={contract?.created_at ?? null}
                contractSigned={contract?.signed_at ?? null}
                compact
              />
            </div>
            <button
              onClick={() => setTab("activity")}
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              View full activity log
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 break-words text-sm font-medium text-gray-900">
        {value}
      </p>
    </div>
  );
}

function Timeline({
  s,
  contractCreated,
  contractSigned,
  compact,
}: {
  s: Submission;
  contractCreated: string | null;
  contractSigned: string | null;
  compact?: boolean;
}) {
  const events: Array<{ when: string | null; title: string; note?: string }> = [
    { when: s.created_at, title: "Submission received", note: s.survey_name },
  ];
  if (s.reviewed_at)
    events.push({
      when: s.reviewed_at,
      title: "Reviewed by the team",
      note: s.override_reason ? `Reason: ${s.override_reason}` : undefined,
    });
  if (contractCreated)
    events.push({ when: contractCreated, title: "Contract sent" });
  if (contractSigned)
    events.push({ when: contractSigned, title: "Contract signed" });
  if (s.status === "enrolled" && s.enrollment_id)
    events.push({ when: s.reviewed_at, title: `Enrolled - ${s.enrollment_id}` });
  if (s.status === "withdrawn")
    events.push({ when: s.reviewed_at, title: "Withdrawn" });

  return (
    <ol className="relative">
      {events.map((e, i) => (
        <li
          key={i}
          className={`relative flex gap-3 ${
            i < events.length - 1 ? (compact ? "pb-4" : "pb-5") : ""
          }`}
        >
          {/* Connecting line - runs from this dot down to the next one. Sits
              behind the dot, which carries a white ring so the line never
              shows through it. */}
          {i < events.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute left-[5px] top-2 bottom-0 w-px bg-gray-300"
            />
          )}
          <span className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary ring-4 ring-white" />
          <div className="-mt-0.5 min-w-0">
            <p className="text-xs text-gray-500">{fmtDateTime(e.when)}</p>
            <p className="text-sm font-medium text-gray-900">{e.title}</p>
            {e.note && <p className="text-xs text-gray-500">{e.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

// --- icons ---------------------------------------------------------------
function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
  );
}
function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
  );
}
function IconMail() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>
  );
}
function IconPhone() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
  );
}
function IconCheck() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  );
}
function IconCheckCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
  );
}
function IconXCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></svg>
  );
}
function IconMedal() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" /><path d="M11 12 5.12 2.2M13 12l5.88-9.8M8 7h8" /><circle cx="12" cy="17" r="5" /><path d="M12 18v-2h-.5" /></svg>
  );
}
function IconChevronDown({ flip }: { flip?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={flip ? "rotate-180" : ""}><path d="m6 9 6 6 6-6" /></svg>
  );
}
function IconPanel() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" /></svg>
  );
}
