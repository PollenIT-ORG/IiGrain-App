import dotenv from "dotenv";
import type { AppEnv } from "../types/index.js";

dotenv.config();

interface GetEnvOptions {
  required?: boolean;
  default?: string;
}

function getEnv(
  key: string,
  { required = false, default: fallback }: GetEnvOptions = {}
): string {
  const value = process.env[key];

  if (value === undefined || value === "") {
    if (required) {
      throw new Error(
        `Missing required environment variable: "${key}". ` +
          `Check your .env file (see .env.example for the template).`
      );
    }
    return fallback ?? "";
  }

  return value;
}

function getBool(key: string, fallback = false): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  return ["true", "1", "yes", "on"].includes(raw.trim().toLowerCase());
}

function getNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (trimmed === "" || trimmed === "/") return "";
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, "");
}

const env: AppEnv = {
  nodeEnv: getEnv("NODE_ENV", { default: "development" }),
  port: parseInt(getEnv("PORT", { default: "5000" }), 10),
  corsOrigin: getEnv("CORS_ORIGIN", { default: "*" }),
  apiPrefix: normalizePrefix(getEnv("API_PREFIX", { default: "/api/v1" })),

  databaseUrl: getEnv("DATABASE_URL", { required: true }),
  dbSync: getBool("DB_SYNC", false),
  dbSeed: getBool("DB_SEED", false),

  saasEnabled: getBool("SAAS_ENABLED", false),

  superAdmin: {
    email: getEnv("SUPER_ADMIN_EMAIL", { default: "superadmin@farmerapp.com" }),
    password: getEnv("SUPER_ADMIN_PASSWORD", { default: "ChangeMe!123" }),
    fullName: getEnv("SUPER_ADMIN_NAME", { default: "Super Admin" }),
  },

  cloudinary: {
    cloudName: getEnv("CLOUDINARY_CLOUD_NAME", { required: true }),
    apiKey: getEnv("CLOUDINARY_API_KEY", { required: true }),
    apiSecret: getEnv("CLOUDINARY_API_SECRET", { required: true }),
  },

  jwt: {
    secret: getEnv("JWT_SECRET", { required: true }),
    expiresIn: getEnv("JWT_EXPIRES_IN", { default: "15m" }),
  },

  refreshToken: {
    expiryDays: getNumber("REFRESH_TOKEN_EXPIRY_DAYS", 7),
  },

  otp: {
    length: getNumber("OTP_LENGTH", 6),
    expiryMinutes: getNumber("OTP_EXPIRY_MINUTES", 10),
  },

  smtp: {
    enabled: getBool("SMTP_ENABLED", false),
    host: getEnv("SMTP_HOST", { default: "" }),
    port: getNumber("SMTP_PORT", 587),
    secure: getBool("SMTP_SECURE", false),
    user: getEnv("SMTP_USER", { default: "" }),
    pass: getEnv("SMTP_PASS", { default: "" }),
    fromName: getEnv("SMTP_FROM_NAME", { default: "Farmer App" }),
    fromEmail: getEnv("SMTP_FROM_EMAIL", { default: "no-reply@farmerapp.com" }),
  },

  // Base URL used for links in emails. Leave empty to send emails without
  // call-to-action buttons rather than links that go nowhere.
  appUrl: getEnv("APP_URL", { default: "" }).replace(/\/+$/, ""),

  rateLimit: {
    enabled: getEnv("RATE_LIMIT_ENABLED", { default: "true" }) !== "false",
    windowMs: parseInt(
      getEnv("RATE_LIMIT_WINDOW_MS", { default: "900000" }),
      10
    ),
    max: parseInt(getEnv("RATE_LIMIT_MAX", { default: "100" }), 10),
  },

  isProduction: false,
  isDevelopment: false,
};

env.isProduction = env.nodeEnv === "production";
env.isDevelopment = env.nodeEnv === "development";

export default env;
