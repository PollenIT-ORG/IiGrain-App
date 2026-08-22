/**
 * A switch for an on/off setting that saves the moment it is flipped, rather
 * than sitting in a form waiting for Save.
 *
 * It is a button with role="switch" rather than a styled checkbox, so there is
 * no native box to hide and nothing for a global input rule to interfere with.
 * The track size, knob position and transitions are inline: they are what makes
 * it read as a switch at all, so they must not depend on a utility class being
 * generated. Colour comes from the theme, never a hardcoded hex.
 */
const TRACK_W = 44;
const TRACK_H = 24;
const KNOB = 18;
const PAD = (TRACK_H - KNOB) / 2;

export default function Toggle({
  checked,
  onChange,
  disabled = false,
  busy = false,
  label,
  title,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Shows the in-flight state and blocks a second click while saving. */
  busy?: boolean;
  /** Read out to assistive tech. Not drawn, so rows stay tight. */
  label: string;
  /** Hover text, used to explain why the switch is unavailable. */
  title?: string;
}) {
  const locked = disabled || busy;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={locked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full
        outline-none ring-offset-2 focus-visible:ring-2
        focus-visible:ring-primary/40 ${
          checked ? "bg-primary" : "bg-gray-300"
        } ${locked ? "opacity-50" : "hover:opacity-90"}`}
      style={{
        width: TRACK_W,
        height: TRACK_H,
        padding: 0,
        border: "none",
        transition: "background-color 200ms ease",
        cursor: locked ? "not-allowed" : "pointer",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: PAD,
          left: PAD,
          width: KNOB,
          height: KNOB,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(16,24,40,0.25)",
          // The slide itself. Inline so it survives a stale CSS build.
          transform: `translateX(${checked ? TRACK_W - KNOB - PAD * 2 : 0}px)`,
          transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </button>
  );
}
