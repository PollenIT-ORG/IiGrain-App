import prisma from "../db/prisma.js";

// The one row that says where email goes out from. Read through
// emailSettings.service.ts, which caches it and opens the secrets.

export type EmailProvider = "smtp" | "resend";

export interface EmailSettingsRow {
  primary_provider: EmailProvider;
  fallback_enabled: boolean;
  from_name: string;
  from_email: string;
  smtp_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass_enc: string | null;
  resend_enabled: boolean;
  resend_key_enc: string | null;
  updated_at: Date;
}

export interface EmailSettingsUpdate {
  primaryProvider?: EmailProvider;
  fallbackEnabled?: boolean;
  fromName?: string;
  fromEmail?: string;
  smtpEnabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  /** Sealed; undefined leaves the stored one alone, null clears it. */
  smtpPassEnc?: string | null;
  resendEnabled?: boolean;
  resendKeyEnc?: string | null;
  updatedBy?: string;
}

export async function findEmailSettings(): Promise<EmailSettingsRow | null> {
  const rows = await prisma.$queryRawUnsafe<EmailSettingsRow[]>(
    `SELECT primary_provider, fallback_enabled, from_name, from_email,
            smtp_enabled, smtp_host, smtp_port, smtp_secure, smtp_user,
            smtp_pass_enc, resend_enabled, resend_key_enc, updated_at
       FROM email_settings
      WHERE id = 1;`
  );
  return rows[0] ?? null;
}

/** Only the fields that were given are touched. */
export async function updateEmailSettings(
  p: EmailSettingsUpdate
): Promise<EmailSettingsRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const put = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (p.primaryProvider !== undefined) put("primary_provider", p.primaryProvider);
  if (p.fallbackEnabled !== undefined) put("fallback_enabled", p.fallbackEnabled);
  if (p.fromName !== undefined) put("from_name", p.fromName);
  if (p.fromEmail !== undefined) put("from_email", p.fromEmail);
  if (p.smtpEnabled !== undefined) put("smtp_enabled", p.smtpEnabled);
  if (p.smtpHost !== undefined) put("smtp_host", p.smtpHost);
  if (p.smtpPort !== undefined) put("smtp_port", p.smtpPort);
  if (p.smtpSecure !== undefined) put("smtp_secure", p.smtpSecure);
  if (p.smtpUser !== undefined) put("smtp_user", p.smtpUser);
  if (p.smtpPassEnc !== undefined) put("smtp_pass_enc", p.smtpPassEnc);
  if (p.resendEnabled !== undefined) put("resend_enabled", p.resendEnabled);
  if (p.resendKeyEnc !== undefined) put("resend_key_enc", p.resendKeyEnc);
  if (p.updatedBy !== undefined) {
    // A parameter arrives as text, and the column is a uuid.
    values.push(p.updatedBy);
    sets.push(`updated_by = $${values.length}::uuid`);
  }

  if (sets.length === 0) return findEmailSettings();
  sets.push("updated_at = now()");

  await prisma.$executeRawUnsafe(
    `UPDATE email_settings SET ${sets.join(", ")} WHERE id = 1;`,
    ...values
  );
  return findEmailSettings();
}
