import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// No dev proxy - the app talks to the backend DIRECTLY using the full URL from
// VITE_API_BASE_URL (see src/config/apiConfig.ts). This keeps dev and production
// behaving the same way (a proxy would only exist in dev and break in prod).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
  },
  // Workers are emitted as .js modules. Servers commonly do not know the .mjs
  // extension and send it as application/octet-stream, which browsers refuse
  // to run as a module script.
  worker: {
    format: "es",
  },
});
