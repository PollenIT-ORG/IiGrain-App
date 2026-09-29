import Portal from "./ui/Portal";
import type { QuestionKind } from "../types";

const CHOICES: { kind: QuestionKind; title: string; detail: string }[] = [
  {
    kind: "mcq",
    title: "Multiple choice",
    detail:
      "The farmer picks one of the answers you write, and each answer carries its own score. The assessment scores itself.",
  },
  {
    kind: "input",
    title: "Input based",
    detail:
      "The farmer fills the answer in. An admin reads it during review and gives it a score.",
  },
];

/** Asks which kind of questions to work with, before a blank assessment or a new question. */
export default function QuestionKindModal({
  title,
  subtitle,
  onPick,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onPick: (kind: QuestionKind) => void;
  onClose: () => void;
}) {
  return (
    <Portal>
      <div className="modal-overlay" onMouseDown={onClose}>
        <div
          className="modal-panel card w-full max-w-lg p-6 sm:p-7"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}

          <div className="mt-5 space-y-3">
            {CHOICES.map((choice) => (
              <button
                key={choice.kind}
                type="button"
                onClick={() => onPick(choice.kind)}
                className="w-full rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <p className="text-sm font-bold text-gray-900">{choice.title}</p>
                <p className="mt-1 text-sm text-gray-500">{choice.detail}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
