// Caches the organization branding in localStorage so a refresh can apply the
// custom logo/favicon instantly, before the /config network request finishes.
// This removes the flash where the default branding shows for a moment.

export interface CachedBranding {
  appName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
}

const KEY = "app_branding";

export function readCachedBranding(): CachedBranding | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as CachedBranding;
    return {
      appName: b.appName ?? null,
      logoUrl: b.logoUrl ?? null,
      faviconUrl: b.faviconUrl ?? null,
    };
  } catch {
    return null;
  }
}

export function writeCachedBranding(b: CachedBranding): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    // storage full or unavailable - ignore, the query will still apply branding
  }
}

// Applies the favicon synchronously from a URL (or the built-in default when
// null). Safe to call before React renders.
export function applyFavicon(faviconUrl: string | null): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  if (faviconUrl) {
    link.type = "image/png";
    link.href = faviconUrl;
  } else {
    link.type = "image/svg+xml";
    link.href = "/favicon.svg";
  }
}
