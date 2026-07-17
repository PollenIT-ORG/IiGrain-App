import nodemailer, { type Transporter } from "nodemailer";
import env from "../config/env.js";
import logger from "../utils/logger.js";
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

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth:
        env.smtp.user || env.smtp.pass
          ? { user: env.smtp.user, pass: env.smtp.pass }
          : undefined,
    });
  }
  return transporter;
}

interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail({
  to,
  subject,
  text,
  html,
}: SendMailParams): Promise<boolean> {
  if (!env.smtp.enabled) {
    logger.info(
      `[SMTP disabled] Email not sent. Would have sent to <${to}>:\n` +
        `   Subject: ${subject}\n` +
        `   Body: ${text}`
    );
    return true;
  }

  try {
    const from = `"${env.smtp.fromName}" <${env.smtp.fromEmail}>`;
    await getTransporter().sendMail({ from, to, subject, text, html });
    logger.info(`Email sent to <${to}> - "${subject}"`);
    return true;
  } catch (err) {
    logger.error(`Failed to send email to <${to}>`, err);
    return false;
  }
}

function send(to: string, content: EmailContent): Promise<boolean> {
  return sendMail({ to, subject: content.subject, text: content.text, html: content.html });
}

/** Prints the code to the terminal when SMTP is off, so dev/testing still works. */
function logCode(title: string, to: string, code: string): void {
  logger.info(
    "\n" +
      "┌────────────────────────────────────────────┐\n" +
      `│  ${title.padEnd(42)}│\n` +
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
  if (!env.smtp.enabled) {
    logCode("Verify email (SMTP off)", params.to, params.code);
    return true;
  }
  return send(params.to, verifyEmailEmail({ fullName: params.fullName, code: params.code }));
}

export async function sendSignInCodeEmail(to: string, code: string): Promise<boolean> {
  if (!env.smtp.enabled) {
    logCode("Sign-in code (SMTP off)", to, code);
    return true;
  }
  return send(to, signInCodeEmail(code));
}

export async function sendResetPasswordEmail(to: string, code: string): Promise<boolean> {
  if (!env.smtp.enabled) {
    logCode("Password reset code (SMTP off)", to, code);
    return true;
  }
  return send(to, resetPasswordEmail(code));
}

export async function sendWelcomeEmail(params: {
  to: string;
  fullName: string | null;
  password: string;
}): Promise<boolean> {
  if (!env.smtp.enabled) {
    logger.info(
      `[SMTP disabled] Welcome email for <${params.to}> - temporary password: ${params.password}`
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
