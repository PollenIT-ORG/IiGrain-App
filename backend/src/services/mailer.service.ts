import nodemailer, { type Transporter } from "nodemailer";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import {
  getEmailConfig,
  type EmailConfig,
  type SmtpConfig,
} from "./emailSettings.service.js";
import type { EmailProvider } from "../models/emailSettings.model.js";
import {
  verifyEmailEmail,
  signInCodeEmail,
  resetPasswordEmail,
  welcomeUserEmail,
  passwordChangedEmail,
  newProgramEmail,
  enrolledInProgramEmail,
  assessorAssignedEmail,
  visitStartedEmail,
  assessmentSubmittedEmail,
  assessmentSubmittedNoticeEmail,
  type EmailContent,
} from "./emailTemplates.js";

// One transport per set of SMTP settings. Changing them in the panel changes
// the key, so the next send builds a new one and the old one is dropped.
let transport: { key: string; t: Transporter } | null = null;

function smtpTransport(smtp: SmtpConfig): Transporter {
  const key = `${smtp.host}:${smtp.port}:${smtp.secure}:${smtp.user}:${smtp.pass}`;
  if (!transport || transport.key !== key) {
    transport = {
      key,
      t: nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth:
          smtp.user || smtp.pass
            ? { user: smtp.user, pass: smtp.pass }
            : undefined,
      }),
    };
  }
  return transport.t;
}

interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** What went wrong, as the provider said it - worth passing on, not swallowing. */
function reason(err: unknown): string {
  const e = err as { response?: string; message?: string };
  return (e?.response || e?.message || "Unknown error").toString().trim();
}

async function viaSmtp(config: EmailConfig, params: SendMailParams): Promise<void> {
  if (!config.smtp) throw new Error("SMTP is not configured.");
  await smtpTransport(config.smtp).sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

/**
 * Resend takes the same message over HTTPS, which gets through where port 587
 * is blocked - and gives the platform somewhere to fall back to.
 */
async function viaResend(
  config: EmailConfig,
  params: SendMailParams
): Promise<void> {
  if (!config.resendKey) throw new Error("Resend is not configured.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(resendRefusal(res.status, await res.text(), config));
  }
}

/**
 * Resend answers with JSON, and the sentence inside it is the part worth
 * reading - showing the raw body puts braces and quotes in front of an admin
 * who only needs to know what to fix.
 */
function resendRefusal(
  status: number,
  body: string,
  config: EmailConfig
): string {
  let message = "";
  try {
    message = (JSON.parse(body) as { message?: string }).message ?? "";
  } catch {
    message = body.slice(0, 200).trim();
  }
  if (!message) return `refused the message (${status}).`;

  // Its most common refusal, said plainly and with the fix.
  if (/domain is not verified/i.test(message)) {
    const domain = config.fromEmail.split("@")[1] ?? config.fromEmail;
    return (
      `the sender domain ${domain} is not verified. Add and verify it at ` +
      "resend.com/domains, or send from a domain already verified there."
    );
  }
  if (/API key is invalid/i.test(message)) {
    return "the API key was not accepted. Check the key saved here.";
  }
  return message.replace(/\s+/g, " ").trim();
}

function providerName(p: EmailProvider): string {
  return p === "smtp" ? "SMTP" : "Resend";
}

function canSend(config: EmailConfig, p: EmailProvider): boolean {
  return p === "smtp" ? config.smtp !== null : config.resendKey !== null;
}

/**
 * Sends through the provider chosen in settings and, if that one will not take
 * the message, through the other - a monthly allowance running out should not
 * stop a producer being invited.
 *
 * Returns what happened, so a caller that wants to tell the admin can.
 */
export async function deliver(
  params: SendMailParams & { only?: EmailProvider }
): Promise<{ sent: boolean; provider?: EmailProvider; error?: string }> {
  const config = await getEmailConfig();
  const both: EmailProvider[] = [
    config.primary,
    config.primary === "smtp" ? "resend" : "smtp",
  ];
  // A test of one provider is a test of that provider, with no quiet
  // fallback covering for it.
  const order = params.only
    ? [params.only]
    : config.fallbackEnabled
      ? both
      : both.slice(0, 1);
  const usable = order.filter((p) => canSend(config, p));

  if (usable.length === 0) {
    logger.info(
      `📭 [No email provider configured] Not sent to <${params.to}>:\n` +
        `   Subject: ${params.subject}\n` +
        `   Body: ${params.text}`
    );
    return { sent: false, error: "No email provider is configured." };
  }

  const failures: string[] = [];
  for (const provider of usable) {
    try {
      if (provider === "smtp") await viaSmtp(config, params);
      else await viaResend(config, params);
      logger.info(
        `📧 Email sent to <${params.to}> via ${providerName(provider)} - "${params.subject}"`
      );
      return { sent: true, provider };
    } catch (err) {
      const why = reason(err);
      failures.push(`${providerName(provider)}: ${why}`);
      logger.error(
        `${providerName(provider)} could not send to <${params.to}>: ${why}`
      );
    }
  }
  return { sent: false, error: failures.join(" | ") };
}

export async function sendMail(params: SendMailParams): Promise<boolean> {
  const { sent } = await deliver(params);
  return sent;
}

function send(to: string, content: EmailContent): Promise<boolean> {
  return sendMail({ to, subject: content.subject, text: content.text, html: content.html });
}

/** True when there is nowhere to send from, so codes go to the terminal instead. */
async function noProvider(): Promise<boolean> {
  const config = await getEmailConfig();
  return !config.smtp && !config.resendKey;
}

/** Prints the code to the terminal when nothing is set up, so dev still works. */
function logCode(title: string, to: string, code: string): void {
  logger.info(
    "\n" +
      "┌────────────────────────────────────────────┐\n" +
      `│  🔐  ${title.padEnd(38)}│\n` +
      "├────────────────────────────────────────────┤\n" +
      `│  Email : ${to.padEnd(34)}│\n` +
      `│  Code  : ${code.padEnd(34)}│\n` +
      `│  Valid : ${`${env.otp.expiryMinutes} minutes`.padEnd(34)}│\n` +
      "└────────────────────────────────────────────┘"
  );
}

export async function sendVerifyEmail(params: {
  to: string;
  fullName: string | null;
  code: string;
}): Promise<boolean> {
  if (await noProvider()) {
    logCode("Verify email (no provider)", params.to, params.code);
    return true;
  }
  return send(params.to, verifyEmailEmail({ fullName: params.fullName, code: params.code }));
}

export async function sendSignInCodeEmail(to: string, code: string): Promise<boolean> {
  if (await noProvider()) {
    logCode("Sign-in code (no provider)", to, code);
    return true;
  }
  return send(to, signInCodeEmail(code));
}

export async function sendResetPasswordEmail(to: string, code: string): Promise<boolean> {
  if (await noProvider()) {
    logCode("Password reset code (no provider)", to, code);
    return true;
  }
  return send(to, resetPasswordEmail(code));
}

export async function sendWelcomeEmail(params: {
  to: string;
  fullName: string | null;
  password: string;
}): Promise<boolean> {
  if (await noProvider()) {
    logger.info(
      `📭 [No email provider] Welcome email for <${params.to}> - temporary password: ${params.password}`
    );
    return true;
  }
  return send(
    params.to,
    welcomeUserEmail({
      fullName: params.fullName,
      email: params.to,
      password: params.password,
    })
  );
}

export async function sendPasswordChangedEmail(params: {
  to: string;
  fullName: string | null;
}): Promise<boolean> {
  return send(params.to, passwordChangedEmail({ fullName: params.fullName }));
}

export async function sendNewProgramEmail(params: {
  to: string;
  fullName: string | null;
  programName: string;
  startDate: string | null;
  endDate: string | null;
}): Promise<boolean> {
  return send(params.to, newProgramEmail(params));
}

export async function sendEnrolledEmail(params: {
  to: string;
  fullName: string | null;
  programName: string;
  fieldNames: string[];
}): Promise<boolean> {
  return send(params.to, enrolledInProgramEmail(params));
}

export async function sendAssessorAssignedEmail(params: {
  to: string;
  fullName: string | null;
  assessorName: string | null;
  programName?: string | null;
}): Promise<boolean> {
  return send(params.to, assessorAssignedEmail(params));
}

export async function sendVisitStartedEmail(params: {
  to: string;
  fullName: string | null;
  assessorName: string | null;
  fieldName: string;
}): Promise<boolean> {
  return send(params.to, visitStartedEmail(params));
}

export async function sendAssessmentSubmittedEmail(params: {
  to: string;
  fullName: string | null;
  fieldName: string;
  answered: number;
  totalQuestions: number;
  percentage: number;
}): Promise<boolean> {
  return send(params.to, assessmentSubmittedEmail(params));
}

export async function sendAssessmentSubmittedNoticeEmail(params: {
  to: string;
  fullName: string | null;
  farmerName: string;
  fieldName: string;
  percentage: number;
}): Promise<boolean> {
  return send(params.to, assessmentSubmittedNoticeEmail(params));
}
