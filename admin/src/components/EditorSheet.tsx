import { useEffect, type ReactNode } from "react";
import Portal from "./ui/Portal";

/**
 * A wide sheet that holds a whole editor over the page that opened it.
 *
 * Used from Programs so a survey or contract can be built without leaving the
 * program being set up. It closes only from its own header, never on a stray
 * click on the backdrop - there is a form inside and half-typed clauses should
 * survive a misplaced click.
 */
export default function EditorSheet({
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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Portal>
      <div className="modal-overlay">
        <div className="modal-panel card flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden p-0">
          <div className="flex items-start justify-between gap-4 border-b border-gray-300 px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-gray-900">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 truncate text-sm text-gray-500">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close editor"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-5">
            {children}
          </div>
        </div>
      </div>
    </Portal>
  );
}
