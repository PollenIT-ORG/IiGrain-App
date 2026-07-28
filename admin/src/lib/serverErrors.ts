import type { FieldError } from "../store/axiosBaseQuery";

// The error object RTK Query hands back from axiosBaseQuery.
interface ServerError {
  status?: number;
  message?: string;
  fieldErrors?: FieldError[];
}

// Maps a caught server error onto a form's inline error state. It uses the
// backend field-error list when present, and otherwise matches the message text
// against a caller-supplied set of rules so 409/404 conflicts (which have no
// field list) still land on the right input. Returns true if it placed at least
// one inline error; false means the caller should fall back to a toast.
export function applyServerFieldErrors(
  err: unknown,
  setErrors: (updater: (prev: Record<string, string | null>) => Record<string, string | null>) => void,
  messageRules: Array<{ field: string; test: RegExp }> = []
): boolean {
  const e = err as ServerError;
  const next: Record<string, string> = {};

  if (e.fieldErrors?.length) {
    for (const fe of e.fieldErrors) next[fe.field] = fe.message;
  } else if (e.message) {
    for (const rule of messageRules) {
      if (rule.test.test(e.message)) {
        next[rule.field] = e.message;
        break;
      }
    }
  }

  const keys = Object.keys(next);
  if (keys.length === 0) return false;
  setErrors((prev) => ({ ...prev, ...next }));
  return true;
}
