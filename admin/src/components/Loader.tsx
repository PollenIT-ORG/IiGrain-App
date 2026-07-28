import { LeafIcon } from "./icons";
import { useGetConfigQuery } from "../store/endpoints/configApi";
import { readCachedBranding } from "../lib/brandingCache";

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

  // Use the uploaded branding icon (the favicon, which is square like this badge)
  // if one is set; otherwise the default leaf icon. The cached branding is used
  // while /config loads so the loader does not flash the default first.
  const { data: config } = useGetConfigQuery();
  const branding = config?.branding ?? readCachedBranding();
  const iconUrl = branding?.faviconUrl ?? null;

  const spinner = (
    <div
      className="flex flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
      aria-label={message || "Loading"}
    >
      <span
        className={`relative grid place-items-center overflow-hidden shadow-card ${RADIUS[size]} ${
          iconUrl
            ? "border border-gray-200 bg-white"
            : "bg-primary text-white"
        }`}
        style={{ width: badge, height: badge }}
      >
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            style={{ width: LOGO_PX[size], height: LOGO_PX[size] }}
            className="object-contain"
          />
        ) : (
          <LeafIcon width={LOGO_PX[size]} height={LOGO_PX[size]} />
        )}

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
