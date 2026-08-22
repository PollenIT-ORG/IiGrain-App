import {
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FocusEvent,
} from "react";
import PhoneInputLib, { getCountryCallingCode } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "./phone-input.css";
import Portal from "./Portal";
import { phone as validatePhone } from "../../lib/validation";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  // Fires on blur with the raw text the user typed in the number box, so the
  // caller can flag "typed something that isn't a valid number" even when the
  // library couldn't parse it into a value. Passing this switches OFF the
  // component's built-in validation/error line (the caller renders its own).
  onBlur?: (rawInput: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  // Built-in validation (only when onBlur is NOT passed): validates the number
  // on blur and shows the error itself, so every form gets the same rules.
  required?: boolean;
  // Used in the built-in "<label> is required." message.
  label?: string;
  // An externally-controlled error (e.g. from a submit attempt) - takes
  // precedence over the built-in one.
  error?: string | null;
  // Grey helper text shown under the field when there is no error.
  hint?: string;
}

interface CountryOption {
  value?: string;
  label: string;
}
type FlagIcon = ComponentType<{ country?: string; label?: string }>;

function dialCode(code?: string): string {
  if (!code) return "";
  try {
    return "+" + getCountryCallingCode(code as never);
  } catch {
    return "";
  }
}

// A custom, UI-matching country picker with search - replaces the native OS
// <select> that react-phone-number-input renders by default.
function CountrySelect({
  value,
  onChange,
  options,
  disabled,
  iconComponent: Icon,
}: {
  value?: string;
  onChange: (v?: string) => void;
  options: CountryOption[];
  disabled?: boolean;
  iconComponent?: FlagIcon;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const countries = useMemo(
    () => options.filter((o): o is Required<CountryOption> => Boolean(o.value)),
    [options]
  );
  const q = query.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");
  const filtered = q
    ? countries.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (digits.length > 0 && dialCode(o.value).replace("+", "").includes(digits))
      )
    : countries;

  function toggle() {
    if (disabled) return;
    if (open) return setOpen(false);
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
    setQuery("");
    setOpen(true);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        className="fa-country-btn"
        aria-label="Select country"
      >
        {Icon && <Icon country={value} label={value} />}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && pos && (
        <Portal>
          <button
            className="fixed inset-0 z-40 cursor-default"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-50 w-72 overflow-hidden rounded-lg border border-gray-300 bg-white shadow-card-hover"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="border-b border-gray-300 p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code"
                maxLength={40}
                className="input-field !py-2 text-sm"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">No matches.</p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 ${
                      o.value === value
                        ? "bg-primary/5 font-medium text-primary"
                        : "text-gray-700"
                    }`}
                  >
                    <span className="fa-country-flag">
                      {Icon && <Icon country={o.value} label={o.label} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {dialCode(o.value)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

export default function PhoneInput({
  value,
  onChange,
  onBlur,
  id,
  placeholder = "Enter mobile number",
  disabled = false,
  required = false,
  label = "Mobile number",
  error,
  hint,
}: PhoneInputProps) {
  const [touched, setTouched] = useState(false);

  // When the caller passes onBlur it owns validation/display; otherwise the
  // component validates itself and renders its own error/hint line.
  const managed = Boolean(onBlur);

  // onBlur is wired on the wrapper, not the inner input: React blur bubbles, and
  // firing only when focus leaves the whole control (not when moving between the
  // country button and the number box) gives the caller one clean blur signal
  // with the raw text the user typed.
  function handleBlur(ev: FocusEvent<HTMLDivElement>): void {
    if (ev.currentTarget.contains(ev.relatedTarget as Node | null)) return;
    if (onBlur) {
      const input = ev.currentTarget.querySelector<HTMLInputElement>(
        "input.PhoneInputInput"
      );
      onBlur(input?.value ?? "");
    } else {
      setTouched(true);
    }
  }

  const builtInError =
    !managed && touched ? validatePhone(value, { req: required, label }) : null;
  const shownError = error ?? builtInError;

  return (
    <div onBlur={handleBlur}>
      <PhoneInputLib
        id={id}
        international
        defaultCountry="US"
        countryCallingCodeEditable={false}
        value={value || undefined}
        // Cap at E.164's real ceiling ('+' plus at most 15 digits) so the stored
        // value can't accumulate a wall of digits.
        onChange={(v) => onChange((v ?? "").slice(0, 16))}
        // And cap the visible national-number input so it can't be typed past a
        // real number's length (longest national numbers are ~15 digits).
        numberInputProps={{ maxLength: 18 }}
        placeholder={placeholder}
        disabled={disabled}
        className={`fa-phone-input ${shownError ? "fa-phone-error" : ""}`}
        countrySelectComponent={CountrySelect}
      />
      {!managed &&
        (shownError ? (
          <p className="field-error">{shownError}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-gray-500">{hint}</p>
        ) : null)}
    </div>
  );
}
