import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CloseIcon } from "../icons";
import Portal from "./Portal";

type Tone = "primary" | "danger";

interface ConfirmOptions {
  title: string;
  message?: string;
  /** Shown under the message - a list of what is about to go, for instance. */
  details?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}

interface PromptOptions {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  validate?: (value: string) => string | null;
  // Render a multi-line textarea instead of a single-line input.
  multiline?: boolean;
  // Character cap for the input/textarea. Left out, PROMPT_MAX applies, so a
  // prompt box is never unbounded.
  maxLength?: number;
  // Colour of the confirm button.
  tone?: Tone;
}

// What a prompt accepts when the caller names no cap of its own.
const PROMPT_MAX = 500;

interface DialogContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

type ConfirmState = {
  kind: "confirm";
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
};
type PromptState = {
  kind: "prompt";
  opts: PromptOptions;
  resolve: (v: string | null) => void;
};
type DialogState = ConfirmState | PromptState | null;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ kind: "confirm", opts, resolve });
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setState({ kind: "prompt", opts, resolve });
    });
  }, []);

  const close = useCallback(() => setState(null), []);

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {state?.kind === "confirm" && (
        <ConfirmDialog
          opts={state.opts}
          onResult={(v) => {
            state.resolve(v);
            close();
          }}
        />
      )}
      {state?.kind === "prompt" && (
        <PromptDialog
          opts={state.opts}
          onResult={(v) => {
            state.resolve(v);
            close();
          }}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog must be used within a <DialogProvider>.");
  }
  return ctx;
}

function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Portal>
      <div className="modal-overlay" onMouseDown={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          className="modal-panel w-full max-w-md overflow-hidden rounded-xl bg-white shadow-card-hover"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}

function DialogHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-300 px-5 py-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <button
        onClick={onClose}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
        aria-label="Close"
      >
        <CloseIcon width={18} height={18} />
      </button>
    </div>
  );
}

function ConfirmDialog({
  opts,
  onResult,
}: {
  opts: ConfirmOptions;
  onResult: (v: boolean) => void;
}) {
  const tone = opts.tone ?? "primary";
  return (
    <Modal onClose={() => onResult(false)}>
      <DialogHeader title={opts.title} onClose={() => onResult(false)} />
      {(opts.message || opts.details) && (
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {opts.message && (
            <p className="text-sm leading-relaxed text-gray-600">
              {opts.message}
            </p>
          )}
          {opts.details && <div className="mt-3">{opts.details}</div>}
        </div>
      )}
      <div className="flex justify-end gap-2 border-t border-gray-300 px-5 py-3">
        <button className="btn-secondary" onClick={() => onResult(false)}>
          {opts.cancelLabel ?? "Cancel"}
        </button>
        <button
          className={tone === "danger" ? "btn-danger" : "btn-primary"}
          onClick={() => onResult(true)}
          autoFocus
        >
          {opts.confirmLabel ?? "Confirm"}
        </button>
      </div>
    </Modal>
  );
}

function PromptDialog({
  opts,
  onResult,
}: {
  opts: PromptOptions;
  onResult: (v: string | null) => void;
}) {
  const [value, setValue] = useState(opts.defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = value.trim();
    if (opts.validate) {
      const err = opts.validate(trimmed);
      if (err) {
        setError(err);
        return;
      }
    }
    onResult(trimmed);
  }

  return (
    <Modal onClose={() => onResult(null)}>
      <DialogHeader title={opts.title} onClose={() => onResult(null)} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="px-5 py-4">
          {opts.message && (
            <p className="mb-3 text-sm text-gray-600">{opts.message}</p>
          )}
          {opts.label && <label className="label">{opts.label}</label>}
          {opts.multiline ? (
            <textarea
              autoFocus
              rows={3}
              maxLength={opts.maxLength ?? PROMPT_MAX}
              className="input-field resize-none"
              placeholder={opts.placeholder}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
            />
          ) : (
            <input
              autoFocus
              maxLength={opts.maxLength ?? PROMPT_MAX}
              className="input-field"
              placeholder={opts.placeholder}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
            />
          )}
          {(opts.maxLength ?? PROMPT_MAX) > 0 && (
            <p className="mt-1 text-right text-xs text-gray-400">
              {value.length} / {opts.maxLength ?? PROMPT_MAX}
            </p>
          )}
          {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-300 px-5 py-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onResult(null)}
          >
            {opts.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="submit"
            className={opts.tone === "danger" ? "btn-danger" : "btn-primary"}
          >
            {opts.confirmLabel ?? "OK"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
