import { useState } from "react";
import Portal from "./ui/Portal";
import type { QuestionKind } from "../types";

const KIND_OPTIONS: { kind: QuestionKind; title: string; detail: string }[] = [
  {
    kind: "mcq",
    title: "Multiple choice",
    detail: "The farmer picks one of the answers you write, and each answer carries its own score.",
  },
  {
    kind: "input",
    title: "Input based",
    detail: "Each category is one form the farmer fills in, and an admin scores the answers in review.",
  },
];

// What happens to a template that is already there when a program picks it.
const USE_OPTIONS = [
  {
    value: "program",
    title: "Use it as it is",
    detail:
      "No changes planned. The program takes this template as it stands, under the name you give it here.",
  },
  {
    value: "template",
    title: "I will make changes to it",
    detail:
      "The program's assessment starts as a copy of it under the name you give it here, and you change it for this program. The original stays as it is.",
  },
];

export interface AssessmentSourceChoice {
  // Set when a template of this name should be made first.
  name?: string;
  kind?: QuestionKind;
}

/**
 * What a program's assessment starts from: a blank template of a chosen kind,
 * or a template that is already there, used as it is or copied under a new name.
 * Either way the program answers its own copy, so no other program is touched.
 */
export default function AssessmentSourceModal({
  mode,
  sourceName,
  saving,
  warning,
  onConfirm,
  onClose,
}: {
  mode: "blank" | "existing";
  sourceName?: string;
  saving: boolean;
  warning?: string | null;
  onConfirm: (choice: AssessmentSourceChoice) => void;
  onClose: () => void;
}) {
  const isBlank = mode === "blank";
  const [kind, setKind] = useState<QuestionKind>("mcq");
  const [asCopy, setAsCopy] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Give the assessment a name of at least two characters.");
      return;
    }
    if (trimmed.length > 150) {
      setError("The name must be 150 characters or fewer.");
      return;
    }
    if (!isBlank && trimmed.toLowerCase() === (sourceName ?? "").trim().toLowerCase()) {
      setError("That name is already taken by the template itself. Give this program's assessment its own name.");
      return;
    }
    onConfirm({ name: trimmed, ...(isBlank ? { kind } : {}) });
  }

  return (
    <Portal>
      <div className="modal-overlay" onMouseDown={onClose}>
        <div
          className="modal-panel card w-full max-w-lg p-6 sm:p-7"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-bold text-gray-900">
            {isBlank ? "Start a blank assessment" : `Use "${sourceName}"`}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {isBlank
              ? "The program always answers its own copy, so changes here never reach another program."
              : "Will you use this template as it is, or change it?"}
          </p>

          {isBlank ? (
            <div className="mt-5 space-y-3">
              <p className="text-sm font-medium text-gray-700">What kind of questions</p>
              {KIND_OPTIONS.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => setKind(option.kind)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    kind === option.kind
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-primary"
                  }`}
                >
                  <p className="text-sm font-bold text-gray-900">{option.title}</p>
                  <p className="mt-1 text-sm text-gray-500">{option.detail}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {USE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setAsCopy(option.value === "template");
                    setError(null);
                  }}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    asCopy === (option.value === "template")
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-primary"
                  }`}
                >
                  <p className="text-sm font-bold text-gray-900">{option.title}</p>
                  <p className="mt-1 text-sm text-gray-500">{option.detail}</p>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4">
            <label className="label" htmlFor="assessment-template-name">
              Assessment name <span className="text-danger">*</span>
            </label>
            <input
              id="assessment-template-name"
              className={`input-field ${error ? "input-error" : ""}`}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Kharif field monitoring"
              maxLength={150}
              autoFocus
            />
            {error ? (
              <p className="field-error">{error}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                This program's assessment goes by this name in the Assessments list, and can be used
                for another program too.
              </p>
            )}
          </div>

          {warning && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {warning}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleConfirm} disabled={saving}>
              {saving ? "Saving..." : isBlank ? "Create the assessment" : "Use this template"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
