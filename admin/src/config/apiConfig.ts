const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

if (!rawBaseUrl) {
  console.error(
    "[apiConfig] VITE_API_BASE_URL is not set. " +
      "Set it to the full backend URL, e.g. https://api.farmer.tcqitsolution.com/api/v1"
  );
}

export const API_BASE_URL = (
  rawBaseUrl || "http://localhost:5000/api/v1"
).replace(/\/+$/, "");
