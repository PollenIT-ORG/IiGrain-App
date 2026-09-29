import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { useGetProgramQuery } from "../store/endpoints/programsApi";
import {
  useListPasProgramsQuery,
  useListPasTemplatesQuery,
  useListPasContractsQuery,
  useCreatePasTemplateMutation,
  useCreatePasProgramMutation,
  useUpdatePasProgramMutation,
  useDeletePasProgramMutation,
  useSetPasProgramLockMutation,
  useUploadPasContractMutation,
  type Program as SurveyLink,
} from "../store/endpoints/programAdminSurveyApi";
import { errMsg } from "../lib/errMsg";
import { useAuth } from "../store/useAuth";
import { useDialog } from "../components/ui/DialogProvider";
import { useLiveData } from "../lib/useLiveData";
import { useTrail } from "../lib/returnTo";
import { useProgramCrumbs } from "../lib/useProgramCrumbs";
import { showSuccess, showError } from "../lib/toast";
import Select from "../components/ui/Select";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import Loader from "../components/Loader";
import ContractPdfPreview from "../components/ContractPdfPreview";
import { SurveyEditor } from "./ProgramTemplateEditor";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon,
} from "../components/icons";

// Setting a program's survey up, on a page of its own rather than in a dialog:
// the questions and the contract are real work, and there is a lot of it.
//
// A survey belongs to a program, so this always starts from one. There is no
// "use an existing survey" here - the survey is made for this program.

const STEPS = ["Survey", "Contract", "Share"] as const;
type Step = 0 | 1 | 2;

// 10 MB, the same as the server accepts.
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export default function ProgramSurveySetup() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const { user } = useAuth();
  const isPlatformAdmin =
    user?.role === "admin" || user?.role === "super_admin";

  const { data: program, isLoading: loadingProgram, isError } = useGetProgramQuery(
    id,
    { skip: !id }
  );
  const { link, setFresh } = useProgramSurveyLink(id);
  const trail = useTrail();
  const programCrumbs = useProgramCrumbs(id);

  const [step, setStep] = useState<Step>(0);
  // Once a survey exists there is nothing to fill in on the first step - it
  // becomes the questions themselves.
  const hasSurvey = Boolean(link);

  useEffect(() => {
    if (isError) {
      showError("Program not found.");
      navigate("/programs");
    }
  }, [isError, navigate]);

  if (loadingProgram) {
    return <Loader variant="fullPage" message="Loading program..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[
            ...(trail
              ? [...trail, { label: program?.name ?? "Program", to: `/programs/${id}` }]
              : programCrumbs),
            { label: "Survey and contract" },
          ]}
        />
        <h1 className="text-2xl font-bold text-gray-900">
          {hasSurvey ? "The survey" : "Set up the survey"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{program?.name}</p>
      </div>

      <Steps
        labels={STEPS}
        current={step}
        reachable={(i) => i === 0 || hasSurvey}
        onPick={(i) => setStep(i as Step)}
      />

      {step === 0 && (
        <SurveyStep
          programId={id}
          link={link}
          onCreated={setFresh}
          onRemoved={() => {
            setFresh(null);
            setStep(0);
          }}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <ContractStep
          link={link}
          isPlatformAdmin={isPlatformAdmin}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && <ShareStep link={link} programId={id} />}
    </div>
  );
}

export function useProgramSurveyLink(programId: string) {
  const {
    data: links,
    isLoading: loading,
    refetch: refetchLinks,
  } = useListPasProgramsQuery();
  useLiveData(["program_admin_survey"], refetchLinks);

  // The link as the list knows it, or the one just created - the list takes a
  // moment to come back and the questions should not wait for it.
  const [fresh, setFresh] = useState<SurveyLink | null>(null);
  const link = useMemo(
    () => (links ?? []).find((l) => l.program_id === programId) ?? fresh,
    [links, programId, fresh]
  );
  return { link, setFresh, loading };
}

export function Steps({
  labels,
  current,
  reachable: canReach,
  onPick,
}: {
  labels: readonly string[];
  current: number;
  reachable: (i: number) => boolean;
  onPick: (i: number) => void;
}) {
  return (
    <ol className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-1">
      {labels.map((label, i) => {
        const active = i === current;
        const reachable = canReach(i);
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onPick(i)}
              className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                active ? "bg-primary/5" : "hover:bg-gray-100"
              } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  active
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-sm font-semibold ${
                  active ? "text-primary" : "text-gray-700"
                }`}
              >
                {label}
              </span>
            </button>
            {i < labels.length - 1 && (
              <ChevronRightIcon
                width={16}
                height={16}
                className="hidden shrink-0 text-gray-300 sm:block"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------- Step 1: survey -----------------------------

export function SurveyStep({
  programId,
  link,
  onCreated,
  onRemoved,
  onNext,
}: {
  programId: string;
  link: SurveyLink | null;
  onCreated: (link: SurveyLink) => void;
  onRemoved: () => void;
  onNext: () => void;
}) {
  const { data: templates } = useListPasTemplatesQuery();
  const [createTemplate, { isLoading: creating }] = useCreatePasTemplateMutation();
  const [attach, { isLoading: attaching }] = useCreatePasProgramMutation();
  const [detach, { isLoading: removing }] = useDeletePasProgramMutation();
  const [setLock, { isLoading: locking }] = useSetPasProgramLockMutation();
  const { confirm } = useDialog();

  const [name, setName] = useState("");
  const [basedOn, setBasedOn] = useState("global");
  const [nameError, setNameError] = useState<string | null>(null);

  const hasGlobal = (templates ?? []).some((t) => t.is_global);
  useEffect(() => {
    setBasedOn(hasGlobal ? "global" : "blank");
  }, [hasGlobal]);

  // What a new survey can start from: the shared one, nothing, or a copy of
  // another survey already on the platform.
  const basedOnOptions = useMemo(() => {
    const opts = hasGlobal
      ? [{ value: "global", label: "The Global survey" }]
      : [];
    opts.push({ value: "blank", label: "A blank survey" });
    for (const t of templates ?? [])
      if (!t.is_global) opts.push({ value: t.id, label: `A copy of: ${t.name}` });
    return opts;
  }, [templates, hasGlobal]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Survey name is required.");
      return;
    }
    if (trimmed.length < 2) {
      setNameError("Survey name is too short.");
      return;
    }
    setNameError(null);
    try {
      const created = await createTemplate({
        name: trimmed,
        basedOn: hasGlobal ? basedOn : basedOn === "global" ? "blank" : basedOn,
      }).unwrap();
      // Attached at once, so the survey belongs to this program from the
      // moment it exists and its questions are this program's questions.
      const attached = await attach({
        programId,
        templateId: created.id,
        contractTemplateId: null,
        replace: true,
      }).unwrap();
      onCreated(attached);
      showSuccess("Survey created. Add its categories and questions.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleRemove() {
    if (!link) return;
    const ok = await confirm({
      title: "Remove this survey?",
      message:
        `"${link.template_name}" will no longer be this program's survey and its ` +
        "link will stop working. Submissions already made are kept, and you can " +
        "build a new survey afterwards.",
      confirmLabel: "Remove survey",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await detach(link.id).unwrap();
      onRemoved();
      showSuccess("Survey removed from this program.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  const locked = link?.locked_at !== null && link?.locked_at !== undefined;

  async function handleLock() {
    if (!link) return;
    const ok = await confirm({
      title: locked ? "Unlock this survey?" : "Lock this survey?",
      message: locked
        ? "Its questions can be changed again, and farmers cannot start the assessment until it is locked again."
        : "Its questions can no longer be changed, and farmers can start this program's assessment.",
      confirmLabel: locked ? "Unlock survey" : "Lock survey",
    });
    if (!ok) return;
    try {
      const updated = await setLock({ id: link.id, locked: !locked }).unwrap();
      onCreated(updated);
      showSuccess(locked ? "Survey unlocked." : "Survey locked. Farmers can start the assessment.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (link) {
    return (
      <>
        <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {link.template_name}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
              {locked
                ? "This survey is locked. Its questions are fixed and farmers can start the assessment."
                : "The questions producers answer for this program. Lock it when it is ready, so farmers can start the assessment."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button className="btn-secondary" disabled={locking} onClick={() => void handleLock()}>
              {locking ? "Saving..." : locked ? "Unlock survey" : "Lock survey"}
            </button>
            {/* A program can drop its survey and start again; what producers
                have already sent in stays. */}
            <button
              className="btn-secondary text-danger hover:border-danger/40"
              disabled={removing}
              onClick={handleRemove}
            >
              <TrashIcon width={16} height={16} />
              {removing ? "Removing..." : "Remove survey"}
            </button>
          </div>
        </div>
        <SurveyEditor id={link.template_id} />
        <div className="flex justify-end">
          <button className="btn-primary" onClick={onNext}>
            Continue to the contract
            <ChevronRightIcon width={16} height={16} />
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="card space-y-5 p-6">
      <div>
        <h2 className="text-base font-bold text-gray-900">Name the survey</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          This is the survey for this program. Its questions come next.
        </p>
      </div>
      <div>
        <label className="label" htmlFor="survey-name">
          Survey name <span className="text-danger">*</span>
        </label>
        <input
          id="survey-name"
          className={`input-field ${nameError ? "input-error" : ""}`}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
          }}
          maxLength={150}
          placeholder="e.g. Kharif 2026 Eligibility"
          autoFocus
        />
        {nameError && <p className="field-error">{nameError}</p>}
      </div>
      <div>
        <label className="label">New survey based on</label>
        <Select value={basedOn} onChange={setBasedOn} options={basedOnOptions} />
        <p className="mt-1.5 text-xs text-gray-500">
          Start from the shared survey or a copy of another one - its categories
          and questions come with it, and you can change them all on the next
          screen.
        </p>
      </div>
      <div className="flex justify-end">
        <button
          className="btn-primary"
          disabled={creating || attaching}
          onClick={handleCreate}
        >
          {creating || attaching ? "Creating..." : "Create survey"}
          <ChevronRightIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
}

// ------------------------------ Step 2: contract ----------------------------

export function ContractStep({
  link,
  isPlatformAdmin,
  onBack,
  onNext,
}: {
  link: SurveyLink | null;
  isPlatformAdmin: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const { data: contracts } = useListPasContractsQuery();
  const [save, { isLoading: saving }] = useUpdatePasProgramMutation();
  const [uploadContract, { isLoading: uploading }] =
    useUploadPasContractMutation();

  const [mode, setMode] = useState<"pick" | "upload">("pick");
  const [contractId, setContractId] = useState(link?.contract_template_id ?? "");
  const [newName, setNewName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const globalContract = useMemo(
    () => (contracts ?? []).find((c) => c.is_global) ?? null,
    [contracts]
  );

  const options = useMemo(
    () => [
      { value: "", label: "Global contract (default)" },
      ...(contracts ?? [])
        .filter((c) => !c.is_global)
        .map((c) => ({ value: c.id, label: c.name })),
    ],
    [contracts]
  );

  // What is being shown below the dropdown: the chosen one, or the shared one
  // that a program falls back to.
  const shown = contractId || globalContract?.id || "";

  async function attachContract(id: string | null) {
    if (!link) return;
    try {
      await save({ id: link.id, body: { contractTemplateId: id } }).unwrap();
      showSuccess("Contract set for this program.");
      onNext();
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleUpload() {
    const name = newName.trim();
    if (!name) return showError("Contract name is required.");
    if (name.length < 2) return showError("Contract name is too short.");
    if (!file) return showError("Choose the contract PDF.");
    if (!/\.pdf$/i.test(file.name))
      return showError("The contract must be a PDF.");
    if (file.size > MAX_PDF_BYTES)
      return showError("That PDF is over 10 MB. Upload a smaller one.");
    try {
      const created = await uploadContract({ name, file }).unwrap();
      setContractId(created.id);
      setMode("pick");
      setNewName("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      showSuccess("Contract uploaded.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <>
      <div className="card space-y-5 p-6">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            The contract they sign
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Sent to a producer once they qualify. Choose one you already have,
            or put in the PDF you were sent.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("pick")}
            className={`flex-1 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors ${
              mode === "pick"
                ? "border-primary bg-primary/5 text-primary"
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            Choose an existing contract
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`flex-1 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors ${
              mode === "upload"
                ? "border-primary bg-primary/5 text-primary"
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            Upload a contract PDF
          </button>
        </div>

        {mode === "pick" ? (
          <div>
            <label className="label">Contract</label>
            <Select
              value={contractId}
              onChange={setContractId}
              options={options}
              placeholder="Global contract (default)"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              {isPlatformAdmin
                ? "The wording of each one is written in the Surveys module."
                : "Contracts are written by the platform team. Choose the one for this program, or upload the PDF you were sent."}
            </p>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-gray-300 bg-gray-50 p-4">
            <div>
              <label className="label" htmlFor="setup-contract-name">
                Contract name
              </label>
              <input
                id="setup-contract-name"
                className="input-field"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={150}
                placeholder="e.g. Kharif 2026 Participation Agreement"
              />
            </div>
            <div>
              <label className="label" htmlFor="setup-contract-pdf">
                Contract PDF
              </label>
              <input
                id="setup-contract-pdf"
                ref={fileRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  setFile(picked);
                  if (picked && !newName.trim())
                    setNewName(picked.name.replace(/\.pdf$/i, ""));
                }}
                className="input-field file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Producers read and sign exactly this document. Max 10 MB.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-primary py-2"
                disabled={uploading}
                onClick={handleUpload}
              >
                {uploading ? "Uploading..." : "Upload contract"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* The document itself, right under the choice that was made. */}
      {shown && (
        <div className="card space-y-3 p-5">
          <p className="text-sm font-bold text-gray-900">
            What the producer signs
          </p>
          <ContractPdfPreview contractId={shown} className="h-[34rem]" />
        </div>
      )}

      <div className="flex justify-between gap-3">
        <button className="btn-secondary" onClick={onBack}>
          <ChevronLeftIcon width={16} height={16} />
          Back to the survey
        </button>
        <button
          className="btn-primary"
          disabled={saving || !link}
          onClick={() => attachContract(contractId || null)}
        >
          {saving ? "Saving..." : "Save contract and finish"}
          <ChevronRightIcon width={16} height={16} />
        </button>
      </div>
    </>
  );
}

// -------------------------------- Step 3: share -----------------------------

export function ShareStep({
  link,
  programId,
}: {
  link: SurveyLink | null;
  programId: string;
}) {
  const navigate = useNavigate();
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  if (!link) {
    return (
      <div className="card px-5 py-16 text-center text-sm text-gray-500">
        Create the survey first.
      </div>
    );
  }

  function copyLink() {
    void navigator.clipboard
      .writeText(link!.link)
      .then(() => {
        setCopied(true);
        showSuccess("Survey link copied.");
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => showError("Could not copy. Copy it manually."));
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "program-survey-qr.png";
    a.click();
  }

  return (
    <div className="card space-y-5 p-6">
      <div>
        <h2 className="text-base font-bold text-gray-900">
          The survey is ready
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Share this link with producers, or send it to farmers already on the
          platform from the program.
        </p>
      </div>

      <div>
        <label className="label">Survey link</label>
        <div className="flex gap-2">
          <input
            readOnly
            value={link.link}
            className="input-field flex-1 text-gray-600"
          />
          <button onClick={copyLink} className="btn-secondary shrink-0">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-5 rounded-lg border border-gray-300 p-4">
        <div ref={qrRef} className="rounded-lg bg-white p-2">
          <QRCodeCanvas value={link.link} size={104} level="M" marginSize={0} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">QR code</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Print it or add it to a flyer. Scanning opens this program's survey.
          </p>
          <button onClick={downloadQr} className="btn-secondary mt-3 py-2 text-sm">
            Download QR
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          className="btn-secondary"
          onClick={() => navigate(`/programs/${programId}`)}
        >
          View submissions
        </button>
        <button
          className="btn-primary"
          onClick={() => navigate(`/programs/${programId}`)}
        >
          Done
        </button>
      </div>
    </div>
  );
}
