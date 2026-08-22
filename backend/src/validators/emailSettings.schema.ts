import { z } from "zod";

// The panel and the server check the same things: a host that looks like a
// host, a port in range, an address mail can actually come from.

const hostField = z
  .string()
  .trim()
  .max(200, "Host is too long.")
  .regex(
    /^[a-zA-Z0-9.-]*$/,
    "Enter the server name only, e.g. smtp.example.com."
  );

const emailField = z
  .string()
  .trim()
  .max(200, "Email is too long.")
  .email("Enter a valid email address.");

export const updateEmailSettingsSchema = z
  .object({
    primaryProvider: z.enum(["smtp", "resend"], {
      error: "Choose SMTP or Resend.",
    }),
    fallbackEnabled: z.boolean(),
    fromName: z
      .string()
      .trim()
      .min(1, "Sender name is required.")
      .max(120, "Sender name is too long."),
    fromEmail: emailField,

    smtpEnabled: z.boolean(),
    smtpHost: hostField.optional(),
    smtpPort: z.coerce
      .number()
      .int("Port must be a whole number.")
      .min(1, "Port must be between 1 and 65535.")
      .max(65535, "Port must be between 1 and 65535.")
      .optional(),
    smtpSecure: z.boolean().optional(),
    smtpUser: z.string().trim().max(200, "Username is too long.").optional(),
    // Left out keeps the stored password; "" clears it.
    smtpPass: z.string().max(300, "Password is too long.").optional(),

    resendEnabled: z.boolean(),
    resendApiKey: z.string().trim().max(300, "API key is too long.").optional(),
  })
  .superRefine((v, ctx) => {
    if (v.smtpEnabled && !v.smtpHost) {
      ctx.addIssue({
        code: "custom",
        path: ["smtpHost"],
        message: "SMTP host is required when SMTP is on.",
      });
    }
    if (v.primaryProvider === "smtp" && !v.smtpEnabled) {
      ctx.addIssue({
        code: "custom",
        path: ["primaryProvider"],
        message: "Turn SMTP on to send through it first.",
      });
    }
    if (v.primaryProvider === "resend" && !v.resendEnabled) {
      ctx.addIssue({
        code: "custom",
        path: ["primaryProvider"],
        message: "Turn Resend on to send through it first.",
      });
    }
  });

export const testEmailSchema = z.object({
  to: emailField,
  /** Which one to prove, or leave out to follow the saved order. */
  provider: z.enum(["smtp", "resend"]).optional(),
});

export type UpdateEmailSettingsBody = z.infer<typeof updateEmailSettingsSchema>;
export type TestEmailBody = z.infer<typeof testEmailSchema>;
