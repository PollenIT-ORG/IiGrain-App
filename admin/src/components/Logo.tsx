import { useGetConfigQuery } from "../store/endpoints/configApi";
import { readCachedBranding } from "../lib/brandingCache";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  withText?: boolean;
  light?: boolean;
}

const imgSizes = { sm: "h-8", md: "h-10", lg: "h-12" };

export default function Logo({ size = "md" }: LogoProps) {
  const { data: config } = useGetConfigQuery();
  // While /config loads, use the cached branding so the custom logo shows with
  // no flash of the default. Once loaded, the fresh value is authoritative.
  const branding = config?.branding ?? readCachedBranding();
  // A custom uploaded logo wins; otherwise fall back to the bundled iiGrain mark.
  const logoUrl = branding?.logoUrl ?? "/logo.png";
  const appName = branding?.appName ?? "iiGrain";

  return (
    <img
      src={logoUrl}
      alt={appName}
      className={`${imgSizes[size]} w-auto max-w-[160px] object-contain`}
    />
  );
}
