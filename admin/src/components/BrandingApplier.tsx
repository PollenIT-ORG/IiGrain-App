import { useEffect } from "react";
import { useGetConfigQuery } from "../store/endpoints/configApi";
import {
  applyFavicon,
  writeCachedBranding,
  readCachedBranding,
} from "../lib/brandingCache";
import { setLocaleSettings } from "../lib/datetime";
import { getSocket } from "../lib/socket";

// Keeps the favicon in step with the organization branding. On first paint it
// uses the cached branding (applied synchronously in main.tsx); once /config
// loads it applies the fresh value and updates the cache, so future refreshes
// show the custom icon instantly with no flash of the default.
export default function BrandingApplier() {
  const { data: config, refetch } = useGetConfigQuery();

  // Settings are saved once and read by everyone, so a change of logo,
  // timezone or clock is pushed to every open tab rather than waiting for a
  // refresh.
  useEffect(() => {
    const socket = getSocket();
    const onChanged = () => {
      void refetch();
    };
    socket.on("config:changed", onChanged);
    return () => {
      socket.off("config:changed", onChanged);
    };
  }, [refetch]);

  useEffect(() => {
    if (!config) return;
    // The clock the whole panel formats with, straight from settings.
    if (config.locale) setLocaleSettings(config.locale);
    const branding = config.branding ?? {
      appName: null,
      logoUrl: null,
      faviconUrl: null,
    };

    // Only touch the DOM/cache when the fresh value differs from what is cached,
    // to avoid a needless favicon swap on every load.
    const cached = readCachedBranding();
    if (cached?.faviconUrl !== branding.faviconUrl) {
      applyFavicon(branding.faviconUrl ?? null);
    }
    writeCachedBranding({
      appName: branding.appName ?? null,
      logoUrl: branding.logoUrl ?? null,
      faviconUrl: branding.faviconUrl ?? null,
    });
  }, [config]);

  return null;
}
