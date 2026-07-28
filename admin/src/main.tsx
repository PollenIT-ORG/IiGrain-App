import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { readCachedBranding, applyFavicon } from "./lib/brandingCache";

// Apply the cached favicon synchronously on refresh so the custom icon shows
// immediately, with no flash of the default while /config loads.
const cached = readCachedBranding();
if (cached?.faviconUrl) applyFavicon(cached.faviconUrl);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
