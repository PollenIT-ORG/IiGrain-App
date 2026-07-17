import env from "../config/env.js";

const COLORS = {
  primary: "#136F3F",
  primaryDark: "#0E5A31",
  primarySoft: "#E7F1EC",
  gray900: "#212829",
  gray700: "#495057",
  gray500: "#ADB5BD",
  gray300: "#DEE2E6",
  gray100: "#F5F7F9",
  white: "#FFFFFF",
  warningBg: "#FFF8E6",
  warningBorder: "#FFC107",
  warningText: "#8A6D00",
};

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const appName = (): string => env.smtp.fromName || "Farmer App";

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function link(path = ""): string {
  return env.appUrl ? `${env.appUrl}${path}` : "";
}

function layout(bodyHtml: string, preheader = ""): string {
  const name = esc(appName());
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${COLORS.gray100};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:${COLORS.gray100};max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.gray100};padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
            <tr>
              <td style="background:${COLORS.primary};border-radius:12px 12px 0 0;padding:20px 28px;">
                <span style="color:${COLORS.white};font-size:18px;font-weight:700;letter-spacing:0.2px;">${name}</span>
              </td>
            </tr>
            <tr>
              <td style="background:${COLORS.white};border:1px solid ${COLORS.gray300};border-top:none;border-radius:0 0 12px 12px;padding:28px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;text-align:center;">
                <span style="color:${COLORS.gray500};font-size:12px;">
                  &copy; ${new Date().getFullYear()} ${name}. All rights reserved.
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 12px;color:${COLORS.gray900};font-size:20px;">${text}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;color:${COLORS.gray700};font-size:14px;line-height:1.6;">${text}</p>`;
}

/** Renders nothing when APP_URL is unset, so emails never carry dead links. */
function button(label: string, href: string): string {
  if (!href) return "";
  return `<p style="margin:20px 0 0;"><a href="${href}" style="display:inline-block;background:${COLORS.primary};color:${COLORS.white};text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px;">${label}</a></p>`;
}

function warning(html: string): string {
  return `<div style="background:${COLORS.warningBg};border:1px solid ${COLORS.warningBorder};border-radius:8px;padding:12px 14px;margin:18px 0;color:${COLORS.warningText};font-size:13px;line-height:1.5;">${html}</div>`;
}

function code(value: string): string {
  return `<div style="background:${COLORS.primarySoft};border-radius:10px;padding:18px 0;margin:4px 0 8px;text-align:center;">
      <div style="font-size:30px;font-weight:700;letter-spacing:6px;color:${COLORS.primary};">${esc(value)}</div>
    </div>`;
}

/** A bordered key/value card, matching the detail rows used across the app. */
function details(rows: Array<{ label: string; value: string; mono?: boolean }>): string {
  const cells = rows
    .map(
      (r, i) => `<tr>
        <td style="padding:12px 14px;${i < rows.length - 1 ? `border-bottom:1px solid ${COLORS.gray300};` : ""}">
          <div style="color:${COLORS.gray500};font-size:12px;">${esc(r.label)}</div>
          <div style="color:${COLORS.gray900};font-size:14px;font-weight:600;${r.mono ? "font-family:monospace;" : ""}">${esc(r.value)}</div>
        </td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid ${COLORS.gray300};border-radius:8px;margin:8px 0 4px;">${cells}</table>`;
}

const greet = (fullName: string | null): string =>
  `Hi ${esc(fullName?.trim() || "there")},`;

const ignoreNote = "If you didn't request this, you can ignore this email.";

/* Sign-up: verify the email address. */
export function verifyEmailEmail(params: {
  fullName: string | null;
  code: string;
}): EmailContent {
  const app = appName();
  const mins = env.otp.expiryMinutes;
  const body = `
    ${h1(`Welcome to ${esc(app)}`)}
    ${p(`${greet(params.fullName)} thanks for signing up. Enter this code in the app to verify your email and activate your account.`)}
    ${code(params.code)}
    ${p(`The code expires in ${mins} minutes.`)}
    ${warning(ignoreNote)}
  `;
  const text =
    `Welcome to ${app}\n\n` +
    `Thanks for signing up. Your verification code is ${params.code}.\n` +
    `It expires in ${mins} minutes.\n\n` +
    `${ignoreNote}\n`;
  return {
    subject: `Verify your email - ${app}`,
    html: layout(body, `Your verification code is ${params.code}`),
    text,
  };
}

/* Passwordless sign-in code. */
export function signInCodeEmail(codeValue: string): EmailContent {
  const app = appName();
  const mins = env.otp.expiryMinutes;
  const body = `
    ${h1("Your sign-in code")}
    ${p(`Use this code to sign in to ${esc(app)}. It expires in ${mins} minutes.`)}
    ${code(codeValue)}
    ${warning(`Never share this code with anyone. ${ignoreNote}`)}
  `;
  const text =
    `Your ${app} sign-in code is ${codeValue}. It expires in ${mins} minutes.\n\n` +
    `Never share this code with anyone. ${ignoreNote}\n`;
  return {
    subject: `${codeValue} is your sign-in code`,
    html: layout(body, `Your sign-in code is ${codeValue}`),
    text,
  };
}

/* Forgot password: the reset code. */
export function resetPasswordEmail(codeValue: string): EmailContent {
  const app = appName();
  const mins = env.otp.expiryMinutes;
  const body = `
    ${h1("Reset your password")}
    ${p(`We received a request to reset your ${esc(app)} password. Enter this code to choose a new one.`)}
    ${code(codeValue)}
    ${p(`The code expires in ${mins} minutes.`)}
    ${warning(`If you didn't ask to reset your password, ignore this email and your password stays the same.`)}
  `;
  const text =
    `Reset your ${app} password\n\n` +
    `Your reset code is ${codeValue}. It expires in ${mins} minutes.\n\n` +
    `If you didn't ask to reset your password, ignore this email and your password stays the same.\n`;
  return {
    subject: `Reset your ${app} password`,
    html: layout(body, `Your password reset code is ${codeValue}`),
    text,
  };
}

/* An admin created the account: credentials + a nudge to change the password. */
export function welcomeUserEmail(params: {
  fullName: string | null;
  email: string;
  password: string;
}): EmailContent {
  const app = appName();
  const body = `
    ${h1(`Welcome to ${esc(app)}`)}
    ${p(`${greet(params.fullName)} an account has been created for you. Sign in with the details below.`)}
    ${details([
      { label: "Email", value: params.email },
      { label: "Temporary password", value: params.password, mono: true },
    ])}
    ${warning(
      `<strong>Change this password right away.</strong> Use <em>Forgot password</em> on the sign-in screen, or update it from your <em>Profile</em> once you're in.`
    )}
    ${button("Sign in", link("/login"))}
  `;
  const text =
    `Welcome to ${app}\n\n` +
    `An account has been created for you.\n\n` +
    `Email: ${params.email}\n` +
    `Temporary password: ${params.password}\n\n` +
    `Change this password right away - use "Forgot password" on the sign-in screen, ` +
    `or update it from your Profile once you're in.\n` +
    (link("/login") ? `\nSign in: ${link("/login")}\n` : "");
  return {
    subject: `Your ${app} account is ready`,
    html: layout(body, "Your account details are inside"),
    text,
  };
}

/* Security confirmation after a password change or reset. */
export function passwordChangedEmail(params: {
  fullName: string | null;
}): EmailContent {
  const app = appName();
  const body = `
    ${h1("Your password was changed")}
    ${p(`${greet(params.fullName)} your ${esc(app)} password was just changed. If this was you, nothing else to do.`)}
    ${warning(
      `If you didn't make this change, reset your password immediately using <em>Forgot password</em>, and contact support.`
    )}
    ${button("Sign in", link("/login"))}
  `;
  const text =
    `Your ${app} password was changed.\n\n` +
    `If this was you, nothing else to do.\n\n` +
    `If you didn't make this change, reset your password immediately using ` +
    `"Forgot password", and contact support.\n`;
  return {
    subject: `Your ${app} password was changed`,
    html: layout(body, "Password change confirmation"),
    text,
  };
}

const dateLine = (start: string | null, end: string | null): string =>
  start && end ? `${start} to ${end}` : start ? `Starts ${start}` : end ? `Ends ${end}` : "";

/* A new program is open in the farmer's organization. */
export function newProgramEmail(params: {
  fullName: string | null;
  programName: string;
  startDate: string | null;
  endDate: string | null;
}): EmailContent {
  const when = dateLine(params.startDate, params.endDate);
  const rows = [{ label: "Program", value: params.programName }];
  if (when) rows.push({ label: "Dates", value: when });

  const body = `
    ${h1("A new program is open")}
    ${p(`${greet(params.fullName)} a new program has been added and you can enrol your fields in it.`)}
    ${details(rows)}
    ${p("Open the app to pick which fields you want to enrol.")}
    ${button("View program", link("/programs"))}
  `;
  const text =
    `A new program is open\n\n` +
    `Program: ${params.programName}\n` +
    (when ? `Dates: ${when}\n` : "") +
    `\nOpen the app to pick which fields you want to enrol.\n`;
  return {
    subject: `New program available: ${params.programName}`,
    html: layout(body, `${params.programName} is open for enrolment`),
    text,
  };
}

/* Enrolment confirmed (self-enrolled or added by an admin). */
export function enrolledInProgramEmail(params: {
  fullName: string | null;
  programName: string;
  fieldNames: string[];
}): EmailContent {
  const fields = params.fieldNames.length
    ? params.fieldNames.join(", ")
    : "your selected fields";
  const body = `
    ${h1("You're enrolled")}
    ${p(`${greet(params.fullName)} your enrolment is confirmed.`)}
    ${details([
      { label: "Program", value: params.programName },
      { label: "Fields", value: fields },
    ])}
    ${p("You can start the assessment for these fields from the app.")}
    ${button("Open app", link(""))}
  `;
  const text =
    `You're enrolled\n\n` +
    `Program: ${params.programName}\n` +
    `Fields: ${fields}\n\n` +
    `You can start the assessment for these fields from the app.\n`;
  return {
    subject: `You're enrolled in ${params.programName}`,
    html: layout(body, `Enrolment confirmed for ${params.programName}`),
    text,
  };
}

/* An assessor has been assigned to the farmer. */
export function assessorAssignedEmail(params: {
  fullName: string | null;
  assessorName: string | null;
  programName?: string | null;
}): EmailContent {
  const who = params.assessorName?.trim() || "An assessor";
  const rows = [{ label: "Assessor", value: who }];
  if (params.programName) rows.push({ label: "Program", value: params.programName });

  const body = `
    ${h1("An assessor has been assigned")}
    ${p(`${greet(params.fullName)} ${esc(who)} will handle the assessment for your fields. They may visit your farm in person.`)}
    ${details(rows)}
    ${button("Open app", link(""))}
  `;
  const text =
    `An assessor has been assigned\n\n` +
    `Assessor: ${who}\n` +
    (params.programName ? `Program: ${params.programName}\n` : "") +
    `\nThey will handle the assessment for your fields, and may visit your farm in person.\n`;
  return {
    subject: `${who} is your assessor`,
    html: layout(body, "An assessor has been assigned to your fields"),
    text,
  };
}

/* The assessor has started travelling to a specific field. */
export function visitStartedEmail(params: {
  fullName: string | null;
  assessorName: string | null;
  fieldName: string;
}): EmailContent {
  const who = params.assessorName?.trim() || "Your assessor";
  const body = `
    ${h1("Your assessor is on the way")}
    ${p(`${greet(params.fullName)} ${esc(who)} has started a visit to ${esc(params.fieldName)}. You can follow their location live in the app.`)}
    ${details([
      { label: "Assessor", value: who },
      { label: "Field", value: params.fieldName },
    ])}
    ${button("Track the visit", link(""))}
  `;
  const text =
    `Your assessor is on the way\n\n` +
    `${who} has started a visit to ${params.fieldName}.\n` +
    `You can follow their location live in the app.\n`;
  return {
    subject: `${who} is on the way to ${params.fieldName}`,
    html: layout(body, `Visit started for ${params.fieldName}`),
    text,
  };
}

/* Receipt to the farmer after they submit a field assessment. */
export function assessmentSubmittedEmail(params: {
  fullName: string | null;
  fieldName: string;
  answered: number;
  totalQuestions: number;
  percentage: number;
}): EmailContent {
  const body = `
    ${h1("Assessment submitted")}
    ${p(`${greet(params.fullName)} we've received your assessment for ${esc(params.fieldName)}. Your answers are now locked and your assessor can review them.`)}
    ${details([
      { label: "Field", value: params.fieldName },
      { label: "Answered", value: `${params.answered} of ${params.totalQuestions}` },
      { label: "Score", value: `${params.percentage}%` },
    ])}
    ${button("View in app", link(""))}
  `;
  const text =
    `Assessment submitted\n\n` +
    `Field: ${params.fieldName}\n` +
    `Answered: ${params.answered} of ${params.totalQuestions}\n` +
    `Score: ${params.percentage}%\n\n` +
    `Your answers are now locked and your assessor can review them.\n`;
  return {
    subject: `Assessment submitted for ${params.fieldName}`,
    html: layout(body, `We received your assessment for ${params.fieldName}`),
    text,
  };
}

/* Tells the assigned assessor that a farmer submitted an assessment. */
export function assessmentSubmittedNoticeEmail(params: {
  fullName: string | null;
  farmerName: string;
  fieldName: string;
  percentage: number;
}): EmailContent {
  const body = `
    ${h1("A farmer submitted an assessment")}
    ${p(`${greet(params.fullName)} ${esc(params.farmerName)} has submitted a self-assessment. It's ready for your review.`)}
    ${details([
      { label: "Farmer", value: params.farmerName },
      { label: "Field", value: params.fieldName },
      { label: "Farmer's score", value: `${params.percentage}%` },
    ])}
    ${button("Review it", link(""))}
  `;
  const text =
    `A farmer submitted an assessment\n\n` +
    `Farmer: ${params.farmerName}\n` +
    `Field: ${params.fieldName}\n` +
    `Farmer's score: ${params.percentage}%\n\n` +
    `It's ready for your review.\n`;
  return {
    subject: `${params.farmerName} submitted an assessment for ${params.fieldName}`,
    html: layout(body, `${params.fieldName} is ready for review`),
    text,
  };
}
