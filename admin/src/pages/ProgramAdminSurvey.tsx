import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useListPasProgramsQuery,
  useCreatePasProgramMutation,
  useListPasTemplatesQuery,
  useDeletePasTemplateMutation,
  useListPasContractsQuery,
  useCreatePasContractMutation,
  useDeletePasContractMutation,
  useUploadPasContractMutation,
  useMakePasContractGlobalMutation,
  useMakePasTemplateGlobalMutation,
  type Program,
  type Template,
} from "../store/endpoints/programAdminSurveyApi";
import { useListProgramsQuery } from "../store/endpoints/programsApi";
import { errMsg } from "../lib/errMsg";
import { useAuth } from "../store/useAuth";
import { useLiveData } from "../lib/useLiveData";
import { showSuccess, showError } from "../lib/toast";
import { useConfirmCascadeDelete } from "../lib/confirmDelete";
import { openApiPdf } from "../lib/openPdf";
import { useDialog } from "../components/ui/DialogProvider";
import Select from "../components/ui/Select";
import Loader from "../components/Loader";
import Portal from "../components/ui/Portal";
import ProgramShareModal from "../components/ProgramShareModal";
import { PlusIcon, ShareIcon, EditIcon, TrashIcon, FileIcon, LinkIcon } from "../components/icons";
import { fmtDate as formatDate } from "../lib/datetime";

// Programs themselves live in the Programs module; here we build the surveys
// and contracts, and link them to a program.
type Tab = "surveys" | "contracts";

const NEW_LABEL: Record<Tab, string> = {
  surveys: "New Survey",
  contracts: "New Contract",
};

/** Platform admins maintain the shared Global template and contract. */
function usePlatformAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === "admin" || user?.role === "super_admin";
}

function fmtDate(iso: string | null): string {
  return formatDate(iso);
}

export default function ProgramAdminSurvey() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Anything that is not a known tab (an old ?tab=templates link, a typo) falls
  // back to Surveys instead of rendering an empty page.
  const rawTab = params.get("tab");
  const tab: Tab = rawTab === "contracts" ? "contracts" : "surveys";
  const isPlatformAdmin = usePlatformAdmin();
  const [creating, setCreating] = useState(false);

  // Drop a stale tab value from the URL so a bookmark self-corrects.
  useEffect(() => {
    if (rawTab && rawTab !== "contracts" && rawTab !== "surveys") {
      setParams({}, { replace: true });
    }
  }, [rawTab, setParams]);

  function setTab(t: Tab) {
    setCreating(false);
    setParams(t === "surveys" ? {} : { tab: t });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Surveys</h1>
        <p className="mt-1 text-sm text-gray-500">
          Build a survey and its contract, link them to a program, and share the
          program's survey link. You only see your own surveys and submissions.
        </p>
      </div>

      {/* Tab bar with the New button aligned to the right. */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-300">
        <div className="flex gap-1">
          {(
            [
              ["surveys", "Surveys"],
              ["contracts", "Contracts"],
            ] as Array<[Tab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="btn-primary mb-2"
          onClick={() =>
            // A survey belongs to a program, so a new one starts by choosing
            // which program it is for; contracts stand on their own.
            tab === "surveys" ? navigate("/surveys/new") : setCreating(true)
          }
        >
          <PlusIcon width={16} height={16} />
          {tab === "contracts" && !isPlatformAdmin
            ? "Upload Contract"
            : NEW_LABEL[tab]}
        </button>
      </div>

      {tab === "surveys" && (
        <SurveysTab />
      )}
      {tab === "contracts" && (
        <ContractsTab creating={creating} onCloseCreate={() => setCreating(false)} />
      )}
    </div>
  );
}

// --------------------------------- shared ----------------------------------

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Portal>
      <div className="modal-overlay" onMouseDown={onClose}>
        <div
          className="modal-panel card w-full max-w-xl p-6"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              {subtitle && (
                <p className="mt-0.5 truncate text-sm text-gray-500">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-16 text-center text-sm text-gray-500">
        {text}
      </td>
    </tr>
  );
}

/** A failed request must not look like "nothing here yet". */
function ErrorRow({
  colSpan,
  error,
  onRetry,
}: {
  colSpan: number;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-16 text-center">
        <p className="text-sm font-medium text-danger">
          {errMsg(error) || "Could not load this list."}
        </p>
        <button className="btn-secondary mt-3" onClick={onRetry}>
          Try again
        </button>
      </td>
    </tr>
  );
}

// --------------------------------- Surveys ---------------------------------

function SurveysTab() {
  const navigate = useNavigate();
  const isPlatformAdmin = usePlatformAdmin();
  const {
    data: templates,
    isLoading,
    isError,
    error,
    refetch,
  } = useListPasTemplatesQuery();
  // The link rows tell us which program each survey is attached to.
  const { data: links, isLoading: linksLoading, refetch: refetchLinks } =
    useListPasProgramsQuery();
  // Programs come from the Programs module (100 is the API's page cap).
  const { data: programData } = useListProgramsQuery({ page: 1, limit: 100 });
  const [deleteTemplate] = useDeletePasTemplateMutation();
  const confirmDelete = useConfirmCascadeDelete();
  const [makeTemplateGlobal] = useMakePasTemplateGlobalMutation();
  const { confirm } = useDialog();
  useLiveData(["program_admin_survey"], () => {
    void refetch();
    void refetchLinks();
  });

  const [share, setShare] = useState<Program | null>(null);
  const [linking, setLinking] = useState<Template | null>(null);

  // survey (template) id -> its program link. Only links that point at a real
  // program count; legacy rows without one are shown as not linked.
  const linkByTemplate = useMemo(() => {
    const m = new Map<string, Program>();
    for (const l of links ?? []) if (l.program_id) m.set(l.template_id, l);
    return m;
  }, [links]);

  async function handleMakeGlobal(id: string, tname: string) {
    const ok = await confirm({
      title: "Make this the global survey?",
      message: `"${tname}" becomes the master new surveys are copied from. The current global one becomes an ordinary survey.`,
      confirmLabel: "Make global",
    });
    if (!ok) return;
    try {
      await makeTemplateGlobal(id).unwrap();
      showSuccess("Global survey updated.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete(id: string, tname: string, global: boolean) {
    const ok = await confirmDelete({
      title: "Delete this survey and everything answered on it?",
      message: global
        ? `"${tname}" is the master new surveys are copied from. Until you ` +
          "make another one global there is nothing to copy from, and its " +
          "questions and the answers given to them go now."
        : `"${tname}" goes with its categories and questions, and with the ` +
          "answers producers gave to them. Any program using it is left " +
          "without a survey.",
      summaryPath: `/program-admin-surveys/templates/${id}/deletion-summary`,
    });
    if (!ok) return;
    try {
      await deleteTemplate(id).unwrap();
      showSuccess("Survey deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (isLoading) return <Loader message="Loading surveys..." />;

  return (
    <>
      <p className="text-sm text-gray-500">
        The Global survey is the shared master. Copy it or start blank to make
        your own, then link it to a program to get a shareable link.
      </p>

      <div className="card mt-3 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3 font-semibold">Survey</th>
                <th className="px-5 py-3 font-semibold">Program</th>
                <th className="px-5 py-3 font-semibold">Categories</th>
                <th className="px-5 py-3 font-semibold">Questions</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isError ? (
                <ErrorRow colSpan={5} error={error} onRetry={refetch} />
              ) : !templates?.length ? (
                <EmptyRow colSpan={5} text="No surveys yet." />
              ) : (
                templates.map((t) => {
                  const link = linkByTemplate.get(t.id);
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                    >
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2 font-semibold text-gray-900">
                          {t.name}
                          {t.is_global && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                              Global
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {link ? (
                          link.name
                        ) : (
                          <span className="text-gray-400">Not linked</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {t.category_count ?? 0}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {t.question_count ?? 0}
                      </td>
                      <td className="px-5 py-3.5">
                        {/* Only what this person may actually do. An action
                            they have no right to is not shown at all, greyed
                            out or otherwise - a program administrator has no
                            business seeing the platform team's. */}
                        <div className="flex items-center justify-end gap-1">
                          {!t.is_global && (
                            <button
                              onClick={() => setLinking(t)}
                              title="Set the program and contract for this survey"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-primary/40 hover:text-primary"
                            >
                              <LinkIcon width={15} height={15} />
                              {link ? "Change" : "Link"}
                            </button>
                          )}
                          {link && (
                            <button
                              onClick={() => setShare(link)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-primary/40 hover:text-primary"
                            >
                              <ShareIcon width={15} height={15} />
                              Share
                            </button>
                          )}
                          <button
                            onClick={() =>
                              navigate(`/surveys/surveys/${t.id}`)
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-primary/40 hover:text-primary"
                          >
                            {t.is_global && !isPlatformAdmin ? (
                              "View"
                            ) : (
                              <>
                                <EditIcon width={15} height={15} />
                                Edit
                              </>
                            )}
                          </button>
                          {/* Which survey is the master is the platform
                              team's call, and only their own can take it. */}
                          {isPlatformAdmin && !t.is_global && !t.owner_id && (
                            <button
                              onClick={() => handleMakeGlobal(t.id, t.name)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-primary/40 hover:text-primary"
                            >
                              Make global
                            </button>
                          )}
                          {(!t.is_global || isPlatformAdmin) && (
                            <button
                              onClick={() => handleDelete(t.id, t.name, t.is_global)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-danger/5 hover:text-danger"
                              aria-label="Delete"
                            >
                              <TrashIcon width={15} height={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {linking && (
        <LinkProgramModal
          template={linking}
          link={linkByTemplate.get(linking.id) ?? null}
          programs={linksLoading ? [] : programData?.programs ?? []}
          loading={linksLoading}
          taken={
            new Set(
              (links ?? []).map((l) => l.program_id).filter(Boolean) as string[]
            )
          }
          onClose={() => setLinking(null)}
          onSaved={(saved, justLinked) => {
            setLinking(null);
            // Only worth showing the link when there is a new one to share.
            if (justLinked) setShare(saved);
          }}
        />
      )}

      {share && (
        <ProgramShareModal
          id={share.id}
          name={share.name}
          link={share.link}
          onClose={() => setShare(null)}
        />
      )}
    </>
  );
}

/**
 * Sets which program a survey runs for, and the contract its producers sign.
 * The same thing can be done from the Programs page; this is here so a survey
 * can be finished off without leaving the list.
 */
function LinkProgramModal({
  template,
  link,
  programs,
  loading,
  taken,
  onClose,
  onSaved,
}: {
  template: Template;
  link: Program | null;
  programs: Array<{ id: string; name: string }>;
  loading: boolean;
  taken: Set<string>;
  onClose: () => void;
  onSaved: (saved: Program, justLinked: boolean) => void;
}) {
  const { data: contracts } = useListPasContractsQuery();
  const [attach, { isLoading }] = useCreatePasProgramMutation();
  const [programId, setProgramId] = useState(link?.program_id ?? "");
  const [contractId, setContractId] = useState(link?.contract_template_id ?? "");

  // A program carries one survey, so only the free ones are offered - plus the
  // one this survey already runs for.
  const programOptions = useMemo(
    () =>
      programs
        .filter((p) => !taken.has(p.id) || p.id === link?.program_id)
        .map((p) => ({ value: p.id, label: p.name })),
    [programs, taken, link]
  );

  const contractOptions = useMemo(
    () => [
      { value: "", label: "Global contract (default)" },
      ...(contracts ?? [])
        .filter((c) => !c.is_global)
        .map((c) => ({ value: c.id, label: c.name })),
    ],
    [contracts]
  );

  async function handleSave() {
    if (!programId) return showError("Choose a program.");
    try {
      const saved = await attach({
        programId,
        templateId: template.id,
        contractTemplateId: contractId || null,
        // Setting it here is a deliberate change to that program's survey.
        replace: true,
      }).unwrap();
      showSuccess(link ? "Survey updated." : "Survey linked to the program.");
      onSaved(saved, !link);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <Modal
      title={link ? "Change program or contract" : "Link this survey"}
      subtitle={template.name}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className="label">Program</label>
          <Select
            value={programId}
            onChange={setProgramId}
            options={programOptions}
            placeholder="Choose a program"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            {loading
              ? "Loading programs..."
              : programOptions.length
                ? "The survey link belongs to the program. Programs that already have a survey are not listed."
                : "Every program already has a survey. Free one up from the Programs page first."}
          </p>
        </div>
        <div>
          <label className="label">Contract</label>
          <Select
            value={contractId}
            onChange={setContractId}
            options={contractOptions}
            placeholder="Global contract (default)"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Producers who qualify sign this contract.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={isLoading} onClick={handleSave}>
            {isLoading ? "Saving..." : link ? "Save changes" : "Link survey"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// --------------------------------- Contracts -------------------------------
// -------------------------------- Contracts --------------------------------
// A contract is a legal document: only the platform team writes one. They
// export it as a PDF and send it to a program administrator, who uploads that
// PDF here and attaches it to their programs.

function ContractsTab({
  creating,
  onCloseCreate,
}: {
  creating: boolean;
  onCloseCreate: () => void;
}) {
  const navigate = useNavigate();
  const isPlatformAdmin = usePlatformAdmin();
  const {
    data: contracts,
    isLoading,
    isError,
    error,
    refetch,
  } = useListPasContractsQuery();
  const [createContract, { isLoading: savingNew }] = useCreatePasContractMutation();
  const [uploadContract, { isLoading: uploading }] = useUploadPasContractMutation();
  const [deleteContract] = useDeletePasContractMutation();
  const [makeGlobal] = useMakePasContractGlobalMutation();
  const { confirm } = useDialog();
  useLiveData(["program_admin_survey"], refetch);

  const saving = savingNew || uploading;
  const [name, setName] = useState("");
  const [basedOn, setBasedOn] = useState("global");
  const [file, setFile] = useState<File | null>(null);
  // A program administrator only ever uploads; the platform team can choose to.
  const uploadingPdf = !isPlatformAdmin || basedOn === "upload";
  const fileRef = useRef<HTMLInputElement>(null);

  const hasGlobal = (contracts ?? []).some((c) => c.is_global);
  useEffect(() => {
    if (creating) setBasedOn(hasGlobal ? "global" : "blank");
  }, [creating, hasGlobal]);

  const basedOnOptions = useMemo(() => {
    const opts = hasGlobal
      ? [{ value: "global", label: "The Global contract" }]
      : [];
    opts.push({ value: "blank", label: "A blank contract" });
    // The platform team can also put a finished PDF in, which is what a
    // producer then reads and signs.
    opts.push({ value: "upload", label: "A PDF you upload" });
    for (const c of contracts ?? [])
      if (!c.is_global && c.source === "designed")
        opts.push({ value: c.id, label: `A copy of: ${c.name}` });
    return opts;
  }, [contracts, hasGlobal]);

  function resetForm() {
    setName("");
    setBasedOn(hasGlobal ? "global" : "blank");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit() {
    if (!name.trim()) return showError("Contract name is required.");
    try {
      if (!uploadingPdf) {
        const created = await createContract({ name: name.trim(), basedOn }).unwrap();
        showSuccess("Contract created.");
        resetForm();
        onCloseCreate();
        navigate(`/surveys/contracts/${created.id}`);
        return;
      }
      if (!file) return showError("Choose the contract PDF.");
      await uploadContract({ name: name.trim(), file }).unwrap();
      showSuccess("Contract uploaded. You can now attach it to a program.");
      resetForm();
      onCloseCreate();
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleMakeGlobal(id: string, cname: string) {
    const ok = await confirm({
      title: "Make this the global contract?",
      message: hasGlobal
        ? `"${cname}" becomes the contract every program falls back to. The current global one becomes an ordinary contract.`
        : `"${cname}" becomes the contract every program falls back to.`,
      confirmLabel: "Make global",
    });
    if (!ok) return;
    try {
      await makeGlobal(id).unwrap();
      showSuccess("Global contract updated.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete(id: string, cname: string, global: boolean) {
    const ok = await confirm({
      title: global ? "Delete the global contract?" : "Delete this contract?",
      message: global
        ? `"${cname}" is what programs fall back to when they have no contract of their own. Until you make another one global, those programs have no contract.`
        : `"${cname}" will be removed. Programs using it must be changed first.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteContract(id).unwrap();
      showSuccess("Contract deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (isLoading) return <Loader message="Loading contracts..." />;

  return (
    <>
      <p className="text-sm text-gray-500">
        {isPlatformAdmin
          ? "Write the contract here, or upload a finished PDF. The one marked Global is what a program falls back to when it has none of its own."
          : "Contracts are written by the platform team. Upload the contract PDF you were sent, then attach it to a program."}
      </p>

      <div className="card mt-3 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3 font-semibold">Contract</th>
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 font-semibold">Created</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isError ? (
                <ErrorRow colSpan={4} error={error} onRetry={refetch} />
              ) : !contracts?.length ? (
                <EmptyRow colSpan={4} text="No contracts yet." />
              ) : (
                contracts.map((c) => {
                  const uploaded = c.source === "uploaded";
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                    >
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2 font-semibold text-gray-900">
                          {c.name}
                          {c.is_global && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                              Global
                            </span>
                          )}
                        </span>
                        {uploaded && c.pdf_name && (
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {c.pdf_name}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {uploaded ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            Uploaded PDF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                            Written
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-600">
                        {fmtDate(c.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {/* The platform team opens an uploaded PDF as the
                              file it is, and a written one in the editor.
                              Everyone else reads the document on the page. */}
                          {isPlatformAdmin && uploaded && c.pdf_url && (
                            <button
                              onClick={() =>
                                void openApiPdf(
                                  `/program-admin-surveys/contracts/${c.id}/pdf`,
                                  c.pdf_name || `${c.name}.pdf`
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-primary/40 hover:text-primary"
                            >
                              <FileIcon width={15} height={15} />
                              View PDF
                            </button>
                          )}
                          {isPlatformAdmin && !uploaded && (
                            <button
                              onClick={() =>
                                navigate(`/surveys/contracts/${c.id}`)
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-primary/40 hover:text-primary"
                            >
                              <EditIcon width={15} height={15} />
                              Edit
                            </button>
                          )}
                          {!isPlatformAdmin && (
                            <button
                              onClick={() =>
                                navigate(`/surveys/contracts/${c.id}`)
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-primary/40 hover:text-primary"
                            >
                              <FileIcon width={15} height={15} />
                              View
                            </button>
                          )}
                          {/* Which contract programs fall back to is the
                              platform team's call, and only their own
                              contracts can take that place. */}
                          {isPlatformAdmin && !c.is_global && !c.owner_id && (
                            <button
                              onClick={() => handleMakeGlobal(c.id, c.name)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-primary/40 hover:text-primary"
                            >
                              Make global
                            </button>
                          )}
                          {(isPlatformAdmin || (uploaded && !c.is_global)) && (
                            <button
                              onClick={() => handleDelete(c.id, c.name, c.is_global)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-danger/5 hover:text-danger"
                              aria-label="Delete"
                            >
                              <TrashIcon width={15} height={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <Modal
          title={isPlatformAdmin ? "Create a contract" : "Upload a contract"}
          onClose={() => {
            resetForm();
            onCloseCreate();
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Contract name</label>
              <input
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={150}
                placeholder="e.g. Kharif 2026 Program Contract"
                autoFocus
              />
            </div>

            {isPlatformAdmin && (
              <div>
                <label className="label">New contract based on</label>
                <Select value={basedOn} onChange={setBasedOn} options={basedOnOptions} />
              </div>
            )}

            {uploadingPdf && (
              <div>
                <label className="label">Contract PDF</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="input-field file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  {isPlatformAdmin
                    ? "Producers read and sign exactly this document. Max 10 MB."
                    : "Upload the PDF the platform team sent you. Producers read and sign exactly this document. Max 10 MB."}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                className="btn-secondary"
                onClick={() => {
                  resetForm();
                  onCloseCreate();
                }}
              >
                Cancel
              </button>
              <button className="btn-primary" disabled={saving} onClick={handleSubmit}>
                {saving
                  ? uploadingPdf
                    ? "Uploading..."
                    : "Creating..."
                  : uploadingPdf
                    ? "Upload contract"
                    : "Create contract"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
