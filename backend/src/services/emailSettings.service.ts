import env from "../config/env.js";
import logger from "../utils/logger.js";
import { seal, open, maskTail } from "../utils/secretBox.js";
import {
  findEmailSettings,
  updateEmailSettings,
  type EmailProvider,
  type EmailSettingsUpdate,
} from "../models/emailSettings.model.js";

/**
 * Where email goes out from.
 *
 * The platform team sets this in the admin panel, so a change of provider or a
 * rotated password does not mean editing a file on the server. Two providers
 * can be configured at once: one is tried first and, if it will not take the
 * message, the other one covers for it - which is what saves the flow when a
 * monthly allowance runs out mid-month.
 *
 * Nothing is configured yet on a fresh install, so the values from the
 * environment are used until someone saves settings in the panel.
 */

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface EmailConfig {
  fromName: string;
  fromEmail: string;
  primary: EmailProvider;
  fallbackEnabled: boolean;
  smtp: SmtpConfig | null;
  resendKey: string | null;
}

/** What the panel shows: everything but the secrets themselves. */
export interface PublicEmailSettings {
  primaryProvider: EmailProvider;
  fallbackEnabled: boolean;
  fromName: string;
  fromEmail: string;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  /** A hint that a password is stored, never the password. */
  smtpPassSet: boolean;
  smtpPassHint: string | null;
  resendEnabled: boolean;
  resendKeySet: boolean;
  resendKeyHint: string | null;
  /** True while the panel has saved nothing and the .env values are in use. */
  usingEnvFallback: boolean;
  updatedAt: string | null;
}

// Read on every send, so it is held briefly rather than fetched per email.
let cached: { config: EmailConfig; at: number } | null = null;
const CACHE_MS = 60_000;

export function clearEmailSettingsCache(): void {
  cached = null;
}

function fromEnv(): EmailConfig {
  return {
    fromName: env.smtp.fromName,
    fromEmail: env.smtp.fromEmail,
    primary: "smtp",
    fallbackEnabled: false,
    smtp: env.smtp.enabled
      ? {
          host: env.smtp.host,
          port: env.smtp.port,
          secure: env.smtp.secure,
          user: env.smtp.user,
          pass: env.smtp.pass,
        }
      : null,
    resendKey: null,
  };
}

/** True once someone has actually filled something in from the panel. */
function isConfigured(row: {
  smtp_enabled: boolean;
  smtp_host: string;
  resend_enabled: boolean;
  resend_key_enc: string | null;
}): boolean {
  return (
    (row.smtp_enabled && row.smtp_host.trim() !== "") ||
    (row.resend_enabled && Boolean(row.resend_key_enc))
  );
}

export async function getEmailConfig(): Promise<EmailConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.config;
  try {
    const row = await findEmailSettings();
    if (!row || !isConfigured(row)) {
      const config = fromEnv();
      cached = { config, at: Date.now() };
      return config;
    }
    const pass = open(row.smtp_pass_enc);
    const config: EmailConfig = {
      fromName: row.from_name || env.smtp.fromName,
      fromEmail: row.from_email || env.smtp.fromEmail,
      primary: row.primary_provider,
      fallbackEnabled: row.fallback_enabled,
      smtp:
        row.smtp_enabled && row.smtp_host.trim() !== ""
          ? {
              host: row.smtp_host,
              port: row.smtp_port,
              secure: row.smtp_secure,
              user: row.smtp_user,
              pass: pass ?? "",
            }
          : null,
      resendKey: row.resend_enabled ? open(row.resend_key_enc) : null,
    };
    cached = { config, at: Date.now() };
    return config;
  } catch (err) {
    logger.warn?.("Could not read the email settings; using the environment.", err);
    return fromEnv();
  }
}

export async function getPublicEmailSettings(): Promise<PublicEmailSettings> {
  const row = await findEmailSettings();
  if (!row) {
    const e = fromEnv();
    return {
      primaryProvider: "smtp",
      fallbackEnabled: false,
      fromName: e.fromName,
      fromEmail: e.fromEmail,
      smtpEnabled: Boolean(e.smtp),
      smtpHost: e.smtp?.host ?? "",
      smtpPort: e.smtp?.port ?? 587,
      smtpSecure: e.smtp?.secure ?? false,
      smtpUser: e.smtp?.user ?? "",
      smtpPassSet: Boolean(e.smtp?.pass),
      smtpPassHint: maskTail(e.smtp?.pass ?? null),
      resendEnabled: false,
      resendKeySet: false,
      resendKeyHint: null,
      usingEnvFallback: true,
      updatedAt: null,
    };
  }
  const pass = open(row.smtp_pass_enc);
  const resendKey = open(row.resend_key_enc);
  return {
    primaryProvider: row.primary_provider,
    fallbackEnabled: row.fallback_enabled,
    fromName: row.from_name,
    fromEmail: row.from_email,
    smtpEnabled: row.smtp_enabled,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpSecure: row.smtp_secure,
    smtpUser: row.smtp_user,
    smtpPassSet: Boolean(row.smtp_pass_enc),
    smtpPassHint: maskTail(pass),
    resendEnabled: row.resend_enabled,
    resendKeySet: Boolean(row.resend_key_enc),
    resendKeyHint: maskTail(resendKey),
    usingEnvFallback: !isConfigured(row),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface SaveEmailSettingsInput {
  primaryProvider?: EmailProvider;
  fallbackEnabled?: boolean;
  fromName?: string;
  fromEmail?: string;
  smtpEnabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  /** Left out to keep the stored one; empty string to clear it. */
  smtpPass?: string;
  resendEnabled?: boolean;
  resendApiKey?: string;
}

export async function saveEmailSettings(
  input: SaveEmailSettingsInput,
  actorId: string
): Promise<PublicEmailSettings> {
  const patch: EmailSettingsUpdate = {
    primaryProvider: input.primaryProvider,
    fallbackEnabled: input.fallbackEnabled,
    fromName: input.fromName?.trim(),
    fromEmail: input.fromEmail?.trim(),
    smtpEnabled: input.smtpEnabled,
    smtpHost: input.smtpHost?.trim(),
    smtpPort: input.smtpPort,
    smtpSecure: input.smtpSecure,
    smtpUser: input.smtpUser?.trim(),
    updatedBy: actorId,
  };
  // A blank box means "leave it as it is"; clearing is explicit.
  if (input.smtpPass !== undefined) {
    patch.smtpPassEnc = input.smtpPass === "" ? null : seal(input.smtpPass);
  }
  if (input.resendApiKey !== undefined) {
    patch.resendKeyEnc =
      input.resendApiKey === "" ? null : seal(input.resendApiKey.trim());
  }
  if (input.resendEnabled !== undefined) patch.resendEnabled = input.resendEnabled;

  await updateEmailSettings(patch);
  clearEmailSettingsCache();
  return getPublicEmailSettings();
}
