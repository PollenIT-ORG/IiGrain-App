import { LeafIcon } from "./icons";

type LoaderSize = "sm" | "md" | "lg";

interface LoaderProps {
  size?: LoaderSize;
  message?: string;
  variant?: "fullPage" | "inline";
}

const BADGE_PX: Record<LoaderSize, number> = { sm: 44, md: 64, lg: 88 };
const LOGO_PX: Record<LoaderSize, number> = { sm: 22, md: 32, lg: 44 };
const RADIUS: Record<LoaderSize, string> = {
  sm: "rounded-xl",
  md: "rounded-2xl",
  lg: "rounded-3xl",
};

export default function Loader({
  size = "md",
  message,
  variant = "inline",
}: LoaderProps) {
  const badge = BADGE_PX[size];

  const spinner = (
    <div
      className="flex flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
      aria-label={message || "Loading"}
    >
      <span
        className={`relative grid place-items-center overflow-hidden bg-primary text-white shadow-card ${RADIUS[size]}`}
        style={{ width: badge, height: badge }}
      >
        <LeafIcon width={LOGO_PX[size]} height={LOGO_PX[size]} />

        <span
          className="pointer-events-none absolute inset-y-0 -inset-x-1/2 animate-shimmer"
          style={{
            background:
              "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%)",
          }}
        />
      </span>

      {message && (
        <p className="text-sm font-medium text-gray-500">{message}</p>
      )}
    </div>
  );

  if (variant === "fullPage") {
    return (
      <div className="grid min-h-screen w-full place-items-center bg-gray-100">
        {spinner}
      </div>
    );
  }

  return (
    <div className="grid w-full place-items-center py-10">{spinner}</div>
  );
}
