import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// No dev proxy - the app talks to the backend DIRECTLY using the full URL from
// VITE_API_BASE_URL (see src/config/apiConfig.ts). This keeps dev and production
// behaving the same way (a proxy would only exist in dev and break in prod).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
});
