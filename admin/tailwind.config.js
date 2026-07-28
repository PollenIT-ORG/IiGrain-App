/** @type {import('tailwindcss').Config} */
// ─────────────────────────────────────────────
// Farmer App - Shared theme color palette.
// These EXACT values are used by both the admin panel and the mobile app,
// so the brand stays consistent everywhere. Update colors here (and mirror
// them in the app) - never hardcode hex values in components.
// ─────────────────────────────────────────────
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#136F3F",
          dark: "#0E5A31",
        },
        secondary: "#22A16A",
        accent: "#F5A623",
        info: "#207DD2",
        success: "#2BA745",
        warning: "#FFC107",
        danger: "#E53935",
        gray: {
          900: "#212829",
          700: "#495057",
          500: "#ADB5BD",
          300: "#DEE2E6",
          100: "#F5F7F9",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04)",
        "card-hover":
          "0 4px 12px rgba(16, 24, 40, 0.08), 0 2px 4px rgba(16, 24, 40, 0.04)",
      },
      keyframes: {
        // Left-to-right shimmer sweep used by the brand loader.
        shimmer: {
          "0%": { transform: "translateX(-150%)" },
          "100%": { transform: "translateX(150%)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
