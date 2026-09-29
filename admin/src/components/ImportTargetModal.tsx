import Portal from "./ui/Portal";

/**
 * Where an imported spreadsheet lands: in the assessment that is open, or in a
 * template of its own that is named first.
 */
export default function ImportTargetModal({
  assessmentName,
  forProgram,
  canReplace = true,
  onPick,
  onClose,
}: {
  assessmentName: string;
  // A program keeps its own copy, so the wording changes with the scope.
  forProgram: boolean;
  // False once the program has answers, so its assessment can no longer change.
  canReplace?: boolean;
  onPick: (target: "existing" | "new") => void;
  onClose: () => void;
}) {
  const options: { value: "existing" | "new"; title: string; detail: string }[] = [
    {
      value: "existing",
      title: `Add to "${assessmentName}"`,
      detail: forProgram
        ? "The fields come into this program's assessment as it stands. A form that is not there yet is created, and nothing already in it is removed."
        : "The questions come into this template as it stands. A category that is not there yet is created, and nothing already in it is removed.",
    },
    {
      value: "new",
      title: "Make a new template",
      detail:
        forProgram && canReplace
          ? "You give it a name, and the file fills it. This program then answers its own copy of that template, so what it holds now is replaced."
          : forProgram
            ? "You give it a name, and the file fills it. It appears in the Assessments list for other programs. This program has answers already, so its own assessment stays as it is."
            : "You give it a name, and the file fills it. It appears in the Assessments list, ready for any program.",
    },
  ];

  return (
    <Portal>
      <div className="modal-overlay" onMouseDown={onClose}>
        <div
          className="modal-panel card w-full max-w-lg p-6 sm:p-7"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-bold text-gray-900">Where should the file go?</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            The same file can fill what is open here, or start a template of its own.
          </p>

          <div className="mt-5 space-y-3">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPick(option.value)}
                className="w-full rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-primary"
              >
                <p className="text-sm font-bold text-gray-900">{option.title}</p>
                <p className="mt-1 text-sm text-gray-500">{option.detail}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
