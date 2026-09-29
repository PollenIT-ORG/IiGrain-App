import type { ReactNode } from "react";
import Portal from "./ui/Portal";
import { isOriginalTemplate } from "../lib/assessmentScope";
import { QUESTION_KIND_LABELS } from "../lib/questionTypes";
import type { AssessmentImportResult, AssessmentTemplate } from "../types";

const PILL = "rounded-full px-2 py-0.5 text-xs font-semibold";

export function TemplateBadges({ template }: { template: AssessmentTemplate }) {
  return (
    <>
      {template.is_global && <span className={`${PILL} bg-primary/10 text-primary`}>Global</span>}
      {template.kind && (
        <span className={`${PILL} bg-emerald-50 text-emerald-700`}>
          {QUESTION_KIND_LABELS[template.kind]}
        </span>
      )}
      {isOriginalTemplate(template) && <span className={`${PILL} bg-blue-50 text-blue-700`}>Original</span>}
      {template.program_id !== null && (
        <span className={`${PILL} bg-gray-100 text-gray-600`}>
          Program: {template.program_name ?? "another program"}
        </span>
      )}
      {template.locked && <span className={`${PILL} bg-amber-50 text-amber-700`}>Locked</span>}
      {!template.is_active && <span className={`${PILL} bg-gray-100 text-gray-500`}>Switched off</span>}
    </>
  );
}

export function ReasonNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {children}
    </div>
  );
}

export function AssessmentModal({
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
        <div className="modal-panel card w-full max-w-xl p-6" onMouseDown={(e) => e.stopPropagation()}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              {subtitle && <p className="mt-0.5 truncate text-sm text-gray-500">{subtitle}</p>}
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

/** What an import left out and why, row by row as the spreadsheet numbers them. */
export function ImportResultModal({ result, onClose }: { result: AssessmentImportResult; onClose: () => void }) {
  const hidden = result.skipped - result.problems.length;
  return (
    <AssessmentModal
      title="Import finished"
      subtitle={`${result.created} question(s) added, ${result.skipped} row(s) skipped`}
      onClose={onClose}
    >
      <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
        {result.problems.map((p) => (
          <li key={`${p.where}-${p.message}`} className="rounded-lg border border-gray-200 px-3 py-2">
            <span className="font-semibold text-gray-900">{p.where}:</span>{" "}
            <span className="text-gray-700">{p.message}</span>
          </li>
        ))}
      </ul>
      {hidden > 0 && <p className="mt-3 text-xs text-gray-500">{hidden} more row(s) were skipped for similar reasons.</p>}
      <div className="mt-5 flex justify-end">
        <button className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </AssessmentModal>
  );
}
