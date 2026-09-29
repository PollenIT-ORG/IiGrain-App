import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useListPasProgramsQuery,
  useGetPasContractQuery,
  useUpdatePasContractMutation,
  type ContractClause,
} from "../store/endpoints/programAdminSurveyApi";
import { errMsg } from "../lib/errMsg";
import { useForward, useTrail } from "../lib/returnTo";
import { useAuth } from "../store/useAuth";
import { useGetCurrentOrganizationQuery } from "../store/endpoints/organizationsApi";
import { useLiveData } from "../lib/useLiveData";
import { showSuccess, showError } from "../lib/toast";
import { useDialog } from "../components/ui/DialogProvider";
import Loader from "../components/Loader";
import Breadcrumbs, { type Crumb } from "../components/ui/Breadcrumbs";
import ContractPdfPreview from "../components/ContractPdfPreview";
import { PlusIcon, TrashIcon, ChevronLeftIcon } from "../components/icons";
import { fmtDate } from "../lib/datetime";

// Edit one contract template: the intro line and its numbered clauses. The
// global contract is shown read-only.
export default function ProgramContractEditor() {
  const { id = "" } = useParams();
  const trail = useTrail();
  return (
    <ContractEditor
      id={id}
      parents={
        trail ?? [
          { label: "Surveys", to: "/surveys" },
          { label: "Contracts", to: "/surveys?tab=contracts" },
        ]
      }
    />
  );
}

/**
 * One contract's wording: the intro and its numbered clauses.
 *
 * It is the page behind /surveys/contracts/:id, and the same component opens
 * over the Programs list when a contract is picked or created for a program.
 * Leave `parents` out when it is embedded.
 */
export function ContractEditor({
  id,
  parents,
}: {
  id: string;
  parents?: Crumb[];
}) {
  const { confirm } = useDialog();
  const { user } = useAuth();
  const isPlatformAdmin =
    user?.role === "admin" || user?.role === "super_admin";
  // Letterhead details for the exported PDF.
  const { data: org } = useGetCurrentOrganizationQuery();
  const { data, isLoading, isError, error, refetch } = useGetPasContractQuery(id, {
    skip: !id,
  });
  const [save, { isLoading: saving }] = useUpdatePasContractMutation();
  useLiveData(["program_admin_survey"], refetch);

  const [name, setName] = useState("");
  const [intro, setIntro] = useState("");
  const [clauses, setClauses] = useState<ContractClause[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setIntro(data.intro ?? "");
    setClauses(data.clauses);
    setDirty(false);
  }, [data]);

  // The global contract is the shared master: platform admins maintain it,
  // program administrators must copy it first.
  const readOnly = (data?.is_global ?? false) && !isPlatformAdmin;

  function setClause(i: number, patch: Partial<ContractClause>) {
    setClauses((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
    setDirty(true);
  }

  function addClause() {
    setClauses((prev) => [
      ...prev,
      { heading: `${prev.length + 1}. New clause`, body: "" },
    ]);
    setDirty(true);
  }

  async function removeClause(i: number) {
    const ok = await confirm({
      title: "Remove this clause?",
      message: clauses[i]?.heading || "This clause will be removed.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setClauses((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= clauses.length) return;
    setClauses((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  }

  async function handleSave() {
    if (!name.trim()) return showError("Contract name is required.");
    const cleaned = clauses.map((c) => ({
      heading: c.heading.trim(),
      body: c.body.trim(),
    }));
    if (cleaned.some((c) => !c.heading || !c.body))
      return showError("Every clause needs a heading and some text.");
    try {
      await save({
        id,
        body: { name: name.trim(), intro: intro.trim() || null, clauses: cleaned },
      }).unwrap();
      showSuccess("Contract saved.");
      setDirty(false);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  /**
   * Opens a print-ready copy of the contract, typeset as a real agreement, so
   * the admin can save it as a PDF and send it to a program administrator.
   */
  function handleExportPdf() {
    const esc = (v: string) =>
      v.replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c
      );

    const orgName = org?.name?.trim() || "iiGrain";
    const today = fmtDate(new Date());
    const ref = `${(org?.code || "IIG").toUpperCase()}-CON-${id.slice(0, 8).toUpperCase()}`;

    // Numbers come from the clause list, so a renumbered contract stays correct.
    const clauseHtml = clauses
      .map((c, i) => {
        // Strip a leading "1." the admin may have typed - the number is added here.
        const heading = c.heading.replace(/^\s*\d+[.)]\s*/, "");
        return `<section class="clause">
          <h2><span class="num">${i + 1}.</span>${esc(heading)}</h2>
          <p>${esc(c.body).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br/>")}</p>
        </section>`;
      })
      .join("");

    const contactBits = [org?.address, org?.contact_email, org?.contact_phone]
      .map((v) => (v ?? "").trim())
      .filter(Boolean)
      .map(esc)
      .join(" &nbsp;•&nbsp; ");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)} - ${esc(orgName)}</title>
<style>
  @page { size: A4; margin: 18mm 18mm 16mm; }
  *{ box-sizing:border-box; }
  body{
    margin:0; color:#1a1d1e; background:#fff;
    font-family:"Georgia","Times New Roman",serif; font-size:10.5pt; line-height:1.65;
  }
  .sheet{ max-width:190mm; margin:0 auto; }

  /* Letterhead */
  .letterhead{
    display:flex; align-items:flex-start; justify-content:space-between; gap:20px;
    border-bottom:2px solid #136F3F; padding-bottom:10px;
  }
  .brand{ display:flex; align-items:center; gap:10px; }
  .brand img{ height:34px; width:auto; }
  .brand .org{ font-family:Arial,Helvetica,sans-serif; font-size:15pt; font-weight:700; color:#136F3F; letter-spacing:-0.2px; }
  .meta{ text-align:right; font-family:Arial,Helvetica,sans-serif; font-size:7.8pt; color:#5b6467; line-height:1.5; }
  .meta b{ color:#1a1d1e; }
  .contact{
    font-family:Arial,Helvetica,sans-serif; font-size:7.5pt; color:#6b7477;
    padding-top:5px; border-bottom:1px solid #d9dedf; padding-bottom:6px;
  }

  /* Title block */
  h1{
    font-family:Arial,Helvetica,sans-serif; text-align:center;
    font-size:13pt; letter-spacing:1.6px; text-transform:uppercase;
    margin:18px 0 3px;
  }
  .subtitle{ text-align:center; font-size:9.5pt; color:#5b6467; margin:0 0 14px; font-style:italic; }

  .recital{ text-align:justify; margin:0 0 11px; }

  /* Clauses */
  .clause{ break-inside:avoid; page-break-inside:avoid; margin:0 0 10px; }
  .clause h2{
    font-family:Arial,Helvetica,sans-serif; font-size:10pt; margin:0 0 5px;
    text-transform:uppercase; letter-spacing:.4px;
  }
  .clause h2 .num{ display:inline-block; min-width:22px; }
  .clause p{ margin:0 0 6px; text-align:justify; padding-left:22px; }

  /* Execution block - kept compact so it stays with the clauses. */
  .execution{ margin-top:16px; page-break-inside:avoid; break-inside:avoid; }
  .execution h3{
    font-family:Arial,Helvetica,sans-serif; font-size:9.5pt; text-transform:uppercase;
    letter-spacing:1px; margin:0 0 3px; border-top:1px solid #1a1d1e; padding-top:9px;
  }
  .execution .note{ font-size:9pt; color:#5b6467; margin:0 0 6px; }
  .role{
    font-family:Arial,Helvetica,sans-serif; font-size:8pt; text-transform:uppercase;
    letter-spacing:1px; color:#5b6467; margin:10px 0 30px;
  }
  .fields{ display:flex; gap:26px; align-items:flex-end; }
  .field{ flex:1; }
  .field.sig{ flex:1.7; }
  .fill{ border-bottom:1px solid #1a1d1e; height:0; margin-bottom:5px; }
  .cap{ font-family:Arial,Helvetica,sans-serif; font-size:7.8pt; color:#5b6467; }

  /* In the normal flow, not fixed: a fixed footer overlaps the signature lines
     when the content runs close to the bottom of the page. */
  .docfooter{
    margin-top:12px; padding-top:5px; border-top:1px solid #e4e8e9;
    font-family:Arial,Helvetica,sans-serif; font-size:7.2pt; color:#8a9295;
    display:flex; justify-content:space-between; gap:16px;
    page-break-inside:avoid; break-inside:avoid;
  }
</style></head><body>
<div class="sheet">
  <div class="letterhead">
    <div class="brand">
      ${org?.logo_url ? `<img src="${esc(org.logo_url)}" alt="" />` : ""}
      <span class="org">${esc(orgName)}</span>
    </div>
    <div class="meta">
      <div><b>Document</b> ${esc(ref)}</div>
      <div><b>Issued</b> ${esc(today)}</div>
      <div><b>Version</b> 1.0</div>
    </div>
  </div>
  ${contactBits ? `<div class="contact">${contactBits}</div>` : ""}

  <h1>${esc(name)}</h1>
  <p class="subtitle">Program participation agreement</p>

  ${intro ? `<p class="recital">${esc(intro)}</p>` : ""}
  <p class="recital">
    This Agreement is entered into between <b>${esc(orgName)}</b> (the "Program Operator")
    and the undersigned producer (the "Producer"), and takes effect on the date of signature
    below. By signing, the Producer confirms they have read, understood and accept the terms set out
    in this Agreement.
  </p>

  ${clauseHtml}

  <div class="execution">
    <h3>Execution</h3>
    <p class="note">
      Signed by the Producer on the date shown. An electronic signature has the
      same effect as a handwritten one.
    </p>
    <div class="role">The Producer</div>
    <div class="fields">
      <div class="field sig">
        <div class="fill"></div><div class="cap">Signature</div>
      </div>
      <div class="field">
        <div class="fill"></div><div class="cap">Full name</div>
      </div>
      <div class="field">
        <div class="fill"></div><div class="cap">Date</div>
      </div>
    </div>
  </div>

  <div class="docfooter">
    <span>${esc(orgName)} &nbsp;•&nbsp; ${esc(name)}</span>
    <span>${esc(ref)}</span>
  </div>
</div>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) return showError("Please allow pop-ups to export the PDF.");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  if (isLoading) return <Loader variant="fullPage" message="Loading contract..." />;
  if (isError || !data) {
    return (
      <div className="space-y-4">
        {parents && <Breadcrumbs items={[...parents, { label: "Contract" }]} />}
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          {errMsg(error) || "Contract not found."}
        </div>
      </div>
    );
  }

  // A contract is legal wording: the platform team writes it, everyone else
  // reads it. An uploaded PDF has no wording to edit either, so both are shown
  // as the document a producer signs rather than as a form.
  if (!isPlatformAdmin || data.source === "uploaded") {
    return (
      <ContractReadView
        id={id}
        name={data.name}
        isGlobal={data.is_global}
        uploaded={data.source === "uploaded"}
        parents={parents}
      />
    );
  }

  return (
    <div className="space-y-5">
      {parents && <Breadcrumbs items={[...parents, { label: data.name }]} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Embedded, the sheet's own header already names the contract. */}
          {parents && (
            <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
          )}
          {data.is_global && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              Global
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* The admin exports the wording as a PDF and emails it to the
              program administrator, who uploads it for their programs. */}
          <button className="btn-secondary" onClick={handleExportPdf}>
            Export PDF
          </button>
          {!readOnly && (
            <button
              className="btn-primary disabled:opacity-60"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          )}
        </div>
      </div>

      {readOnly ? (
        <div className="rounded-lg border border-info/30 bg-info/5 p-4 text-sm text-gray-700">
          This is the shared Global contract and cannot be edited. Copy it (or
          start blank) from the Contracts tab to make your own editable version.
        </div>
      ) : (
        data.is_global && (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm text-gray-700">
            You are editing the shared <strong>Global</strong> contract. It is
            what every program signs unless they pick their own.
          </div>
        )
      )}

      {parents && (
        <ContractUsageCard
          contractId={id}
          isGlobal={data.is_global}
          crumbs={[...parents, { label: data.name }]}
        />
      )}

      <div className="card space-y-4 p-5">
        <div>
          <label className="label">Contract name</label>
          <input
            className="input-field"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            maxLength={150}
            disabled={readOnly}
          />
        </div>
        <div>
          <label className="label">Intro (shown above the clauses)</label>
          <textarea
            rows={2}
            className="input-field resize-none"
            value={intro}
            onChange={(e) => {
              setIntro(e.target.value);
              setDirty(true);
            }}
            maxLength={2000}
            disabled={readOnly}
            placeholder="e.g. Please read this through before signing."
          />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900">
            Clauses{" "}
            <span className="font-normal text-gray-400">({clauses.length})</span>
          </p>
          {!readOnly && (
            <button className="btn-secondary" onClick={addClause}>
              <PlusIcon width={16} height={16} />
              Add clause
            </button>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {clauses.map((c, i) => (
            <div key={i} className="rounded-lg border border-gray-300 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gray-100 text-xs font-bold text-gray-500">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    className="input-field font-semibold"
                    value={c.heading}
                    onChange={(e) => setClause(i, { heading: e.target.value })}
                    maxLength={200}
                    disabled={readOnly}
                    placeholder="Clause heading"
                  />
                  <textarea
                    rows={3}
                    className="input-field resize-none"
                    value={c.body}
                    onChange={(e) => setClause(i, { body: e.target.value })}
                    maxLength={5000}
                    disabled={readOnly}
                    placeholder="Clause text"
                  />
                </div>
                {!readOnly && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronLeftIcon width={14} height={14} className="rotate-90" />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === clauses.length - 1}
                      className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ChevronLeftIcon width={14} height={14} className="-rotate-90" />
                    </button>
                    <button
                      onClick={() => removeClause(i)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 hover:bg-danger/5 hover:text-danger"
                      aria-label="Remove clause"
                    >
                      <TrashIcon width={14} height={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {clauses.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">
              No clauses yet. Add the first one.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The contract as a document.
 *
 * Drawn on the page rather than opened in the browser's viewer, so there is no
 * toolbar or download bar around it - a program administrator reads the exact
 * pages their producers will be asked to sign, and nothing more.
 */
function ContractReadView({
  id,
  name,
  isGlobal,
  uploaded,
  parents,
}: {
  id: string;
  name: string;
  isGlobal: boolean;
  uploaded: boolean;
  parents?: Crumb[];
}) {
  return (
    <div className="space-y-5">
      {parents && <Breadcrumbs items={[...parents, { label: name }]} />}

      <div className="flex flex-wrap items-center gap-3">
        {parents && <h1 className="text-2xl font-bold text-gray-900">{name}</h1>}
        {isGlobal && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            Global
          </span>
        )}
        {uploaded && (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            Uploaded PDF
          </span>
        )}
      </div>

      <div className="rounded-lg border border-info/30 bg-info/5 p-4 text-sm text-gray-700">
        This is the contract your producers read and sign. Its wording is set by
        the platform team.
      </div>

      {parents && (
        <ContractUsageCard
          contractId={id}
          isGlobal={isGlobal}
          crumbs={[...parents, { label: name }]}
        />
      )}

      <ContractPdfPreview contractId={id} className="h-[38rem]" />
    </div>
  );
}

function ContractUsageCard({
  contractId,
  isGlobal,
  crumbs,
}: {
  contractId: string;
  isGlobal: boolean;
  crumbs: Crumb[];
}) {
  const forward = useForward(crumbs);
  const { data: links, isLoading } = useListPasProgramsQuery();
  const used = (links ?? []).filter(
    (l) =>
      l.program_id &&
      (l.contract_template_id === contractId ||
        (isGlobal && !l.contract_template_id))
  );

  return (
    <div className="card p-5">
      <p className="text-sm font-bold text-gray-900">
        Used by programs{" "}
        <span className="font-normal text-gray-400">({used.length})</span>
      </p>
      {isLoading ? (
        <p className="mt-1 text-sm text-gray-500">Loading programs...</p>
      ) : used.length === 0 ? (
        <p className="mt-1 text-sm text-gray-500">
          No program uses this contract yet.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-300/70 rounded-lg border border-gray-300">
          {used.map((l) => (
            <li
              key={l.id}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link
                to={`/programs/${l.program_id}`}
                state={forward}
                className="font-semibold text-gray-900 hover:text-primary hover:underline"
              >
                {l.name}
              </Link>
              <Link
                to={`/surveys/surveys/${l.template_id}`}
                state={forward}
                className="text-sm text-gray-500 hover:text-primary hover:underline"
              >
                Survey: {l.template_name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
