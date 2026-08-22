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

// Logo shown in the header of every email.
const EMAIL_LOGO_URL =
  "https://res.cloudinary.com/dmcdeuw12/image/upload/v1785131103/farmer_branding/email_logo.png";

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
              <td style="background:${COLORS.white};border:1px solid ${COLORS.gray300};border-bottom:none;border-radius:12px 12px 0 0;padding:20px 28px;">
                <img src="${EMAIL_LOGO_URL}" alt="${name}" height="36" style="height:36px;width:auto;display:block;border:0;" />
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

/**
 * The setup checklist. Built as a table with inline styles rather than list
 * markup, because that is what survives Outlook and the webmail clients.
 */
function checklist(steps: Array<{ label: string; done: boolean }>): string {
  const rows = steps
    .map((s) => {
      const mark = s.done
        ? `<span style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:9px;background:${COLORS.primary};color:${COLORS.white};text-align:center;font-size:11px;font-weight:700;">&#10003;</span>`
        : `<span style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:9px;border:2px solid ${COLORS.gray300};"></span>`;
      return `<tr>
        <td style="padding:5px 10px 5px 0;width:24px;vertical-align:top;">${mark}</td>
        <td style="padding:5px 0;color:${s.done ? COLORS.gray900 : COLORS.gray700};font-size:14px;line-height:1.5;${s.done ? "font-weight:600;" : ""}">${esc(s.label)}</td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:10px 0 4px;">${rows}</table>`;
}

/** A small bold line used to head a group inside the body. */
function subHead(text: string): string {
  return `<div style="margin:18px 0 0;color:${COLORS.gray900};font-size:15px;font-weight:700;">${esc(text)}</div>`;
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

/* Survey email verification: the one-time code a producer enters to confirm
   the email address they started the eligibility survey with. */
export function surveyOtpEmail(codeValue: string): EmailContent {
  const app = appName();
  const mins = env.otp.expiryMinutes;
  const body = `
    ${h1("Verify your email")}
    ${p(`Enter this code to verify your email and continue your ${esc(app)} eligibility survey. It expires in ${mins} minutes.`)}
    ${code(codeValue)}
    ${warning(`Never share this code with anyone. ${ignoreNote}`)}
  `;
  const text =
    `Your ${app} survey verification code is ${codeValue}. It expires in ${mins} minutes.\n\n` +
    `Never share this code with anyone. ${ignoreNote}\n`;
  return {
    subject: `${codeValue} is your verification code`,
    html: layout(body, `Your verification code is ${codeValue}`),
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

/* ------------------------------------------------------------------------- */
/* Eligibility survey and enrollment (public website flow)                     */
/* ------------------------------------------------------------------------- */

const BAND_LABEL: Record<string, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  not_qualified: "Not Qualified",
};

// The status link is only sent for the standalone survey (magic-link tracking).
// For the website flow it stays undefined and no button is shown.
function statusButton(link?: string): string {
  return link ? button("Check your status", esc(link)) : "";
}
function statusLine(link?: string): string {
  return link ? `\nCheck your status any time: ${link}\n` : "";
}

/**
 * Which program, and which survey of that program, an email is about. Every
 * message in the survey flow carries both, so a producer taking part in more
 * than one always knows what they are reading.
 */
function programRows(params: {
  programName?: string | null;
  surveyName?: string | null;
}): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  if (params.programName) rows.push({ label: "Program", value: params.programName });
  if (params.surveyName) rows.push({ label: "Survey", value: params.surveyName });
  return rows;
}

function programLines(params: {
  programName?: string | null;
  surveyName?: string | null;
}): string {
  return programRows(params)
    .map((r) => `${r.label}: ${r.value}\n`)
    .join("");
}

/* Invite a lead to take the eligibility survey. */
export function surveyInviteEmail(params: {
  link: string;
  programName?: string | null;
  surveyName?: string | null;
}): EmailContent {
  const app = appName();
  const rows = programRows(params);
  const body = `
    ${h1("Check if your farm qualifies")}
    ${p(`${esc(app)} runs a regenerative agriculture program for grain producers. Take a short eligibility survey to see whether your farm qualifies - it only takes a few minutes and your result is instant.`)}
    ${rows.length ? details(rows) : ""}
    ${button("Start the survey", esc(params.link))}
    ${p("You can save your progress and come back any time using the same email.")}
  `;
  const text =
    `Check if your farm qualifies\n\n` +
    `${app} runs a regenerative agriculture program for grain producers. Take a short eligibility survey to see whether your farm qualifies:\n${params.link}\n\n` +
    programLines(params) +
    `\nYou can save your progress and come back any time using the same email.\n`;
  return {
    subject: params.programName
      ? `You're invited to check your eligibility for ${params.programName}`
      : `You're invited to check your eligibility for the ${app} program`,
    html: layout(body, "Take the eligibility survey to see if your farm qualifies"),
    text,
  };
}

/* Receipt sent the moment the survey is submitted. */
export function surveyReceivedEmail(params: {
  fullName: string | null;
  link?: string;
  programName?: string | null;
  surveyName?: string | null;
}): EmailContent {
  const rows = programRows(params);
  const body = `
    ${h1("We have your survey")}
    ${p(`${greet(params.fullName)} thank you for completing the eligibility survey. Our team is reviewing your answers and will be in touch about the next steps.`)}
    ${rows.length ? details(rows) : ""}
    ${statusButton(params.link)}
  `;
  const text =
    `We have your survey\n\n` +
    `Thank you for completing the eligibility survey. Our team is reviewing your answers and will be in touch about the next steps.\n` +
    programLines(params) +
    statusLine(params.link);
  return {
    subject: params.programName
      ? `We have received your survey for ${params.programName}`
      : "We have received your eligibility survey",
    html: layout(body, "Your eligibility survey has been received"),
    text,
  };
}

/* The producer qualified. Wording follows the program document. */
export function surveyQualifiedEmail(params: {
  fullName: string | null;
  category: string;
  link?: string;
  reason?: string | null;
  programName?: string | null;
  surveyName?: string | null;
}): EmailContent {
  const band = BAND_LABEL[params.category] ?? params.category;
  const note = params.reason?.trim();
  const body = `
    ${h1("You qualify to enroll")}
    ${p(`${greet(params.fullName)} congratulations, you qualify to enroll in the program. A Greenfield representative will reach out for further enrollment steps.`)}
    ${details([...programRows(params), { label: "Your band", value: band }])}
    ${note ? details([{ label: "Note from our team", value: note }]) : ""}
    ${p("You are recorded as a Prospective Producer. You are not enrolled yet: enrollment happens once you sign the program contract and receive your Enrollment ID.")}
    ${statusButton(params.link)}
  `;
  const text =
    `You qualify to enroll\n\n` +
    `Congratulations, you qualify to enroll in the program. A Greenfield representative will reach out for further enrollment steps.\n\n` +
    programLines(params) +
    `Your band: ${band}\n` +
    (note ? `Note from our team: ${note}\n` : "") +
    `\nYou are recorded as a Prospective Producer. Enrollment happens once you sign the program contract and receive your Enrollment ID.\n` +
    statusLine(params.link);
  return {
    subject: params.programName
      ? `You qualify for ${params.programName}`
      : "You qualify for the program",
    html: layout(body, "You qualify to enroll in the program"),
    text,
  };
}

/* The producer did not qualify. The workflow stops here. */
export function surveyNotQualifiedEmail(params: {
  fullName: string | null;
  link?: string;
  reason?: string | null;
  programName?: string | null;
  surveyName?: string | null;
}): EmailContent {
  const note = params.reason?.trim();
  const rows = programRows(params);
  const body = `
    ${h1("Your survey result")}
    ${p(`${greet(params.fullName)} sorry, based on your responses, you are not qualified to enroll in this program.`)}
    ${rows.length ? details(rows) : ""}
    ${note ? details([{ label: "Reason", value: note }]) : ""}
    ${p("Farms change over time, so you are welcome to apply again if your situation changes.")}
    ${statusButton(params.link)}
  `;
  const text =
    `Your survey result\n\n` +
    `Sorry, based on your responses, you are not qualified to enroll in this program.\n` +
    programLines(params) +
    (note ? `Reason: ${note}\n` : "") +
    `\nFarms change over time, so you are welcome to apply again if your situation changes.\n` +
    statusLine(params.link);
  return {
    subject: params.programName
      ? `Your survey result for ${params.programName}`
      : "Your eligibility survey result",
    html: layout(body, "Your eligibility survey result"),
    text,
  };
}

/* Secure link to read and sign the program contract. */
export function contractToSignEmail(params: {
  fullName: string | null;
  link: string;
  expiresAt: Date;
  expiresLabel?: string;
  programName?: string | null;
  surveyName?: string | null;
}): EmailContent {
  const expiry = params.expiresLabel ?? params.expiresAt.toDateString();
  const body = `
    ${h1("Your contract is ready to sign")}
    ${p(`${greet(params.fullName)} the next step is the program contract. Open the link below to read it and sign it online. Nothing needs to be printed or posted.`)}
    ${button("Read and sign the contract", esc(params.link))}
    ${details([...programRows(params), { label: "Link valid until", value: expiry }])}
    ${warning("Do not share this link. It is unique to you.")}
  `;
  const text =
    `Your contract is ready to sign\n\n` +
    `The next step is the program contract. Open this link to read and sign it:\n${params.link}\n\n` +
    programLines(params) +
    `Link valid until: ${expiry}\n\nDo not share this link, it is unique to you.\n`;
  return {
    subject: params.programName
      ? `Your contract for ${params.programName} is ready to sign`
      : "Your program contract is ready to sign",
    html: layout(body, "Read and sign your program contract"),
    text,
  };
}

/* Contract accepted: the Enrollment ID and how to use it. */
export function enrollmentWelcomeEmail(params: {
  fullName: string | null;
  enrollmentId: string;
  appLink?: string;
  programName?: string | null;
}): EmailContent {
  // The survey is behind them at this point: this email is about the program.
  const rows = [
    ...(params.programName
      ? [{ label: "Program", value: params.programName }]
      : []),
    { label: "Enrollment ID", value: params.enrollmentId, mono: true },
  ];
  const body = `
    ${h1("Welcome to the program")}
    ${p(`${greet(params.fullName)} your contract has been accepted and you are now enrolled as a Farmer/Producer.`)}
    ${details(rows)}
    ${p("Install the mobile app and enter this Enrollment ID the first time you register. After that you log in normally with your email and password.")}
    ${params.appLink ? button("Get the app", esc(params.appLink)) : ""}
    ${warning("Your Enrollment ID is personal to you. Please do not share it.")}
  `;
  const text =
    `Welcome to the program\n\n` +
    `Your contract has been accepted and you are now enrolled as a Farmer/Producer.\n\n` +
    (params.programName ? `Program: ${params.programName}\n` : "") +
    `Enrollment ID: ${params.enrollmentId}\n\n` +
    `Install the mobile app and enter this Enrollment ID the first time you register. After that you log in with your email and password.\n` +
    (params.appLink ? `\nGet the app: ${params.appLink}\n` : "") +
    `\nYour Enrollment ID is personal to you. Please do not share it.\n`;
  return {
    subject: params.programName
      ? `You are enrolled in ${params.programName} - your Enrollment ID is ${params.enrollmentId}`
      : `You are enrolled - your Enrollment ID is ${params.enrollmentId}`,
    html: layout(body, "You are enrolled. Here is your Enrollment ID."),
    text,
  };
}

/**
 * Sent straight after the enrollment welcome, so the producer knows what to do
 * next. The first step is already ticked; the rest are what they complete in
 * the app.
 */
export function farmSetupEmail(params: {
  fullName: string | null;
  programName?: string | null;
  classification?: string | null;
  year: number;
  appLink?: string;
}): EmailContent {
  const firstName = (params.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const band = params.classification
    ? BAND_LABEL[params.classification] ?? null
    : null;

  const steps = [
    { label: "Account Activated", done: true },
    { label: "Complete Producer Profile", done: false },
    { label: "Add Your Farms", done: false },
    { label: "Add Your Fields", done: false },
    { label: "Map Field Boundaries", done: false },
    { label: `Complete ${params.year} Program Information`, done: false },
  ];

  const rows = [
    ...(params.programName
      ? [{ label: "Program", value: params.programName }]
      : []),
    ...(band ? [{ label: "Classification", value: band.toUpperCase() }] : []),
  ];

  const body = `
    ${h1(`Welcome, ${esc(firstName)}`)}
    ${p("You are enrolled. Here is what is left to set up, and you can do all of it from the app.")}
    ${subHead("Complete your farm setup")}
    ${checklist(steps)}
    ${rows.length ? details(rows) : ""}
    ${params.appLink ? button("Open the app", esc(params.appLink)) : ""}
  `;

  const text =
    `Welcome, ${firstName}\n\n` +
    "You are enrolled. Here is what is left to set up, and you can do all of " +
    "it from the app.\n\n" +
    "Complete your farm setup\n" +
    steps.map((s) => `${s.done ? "[x]" : "[ ]"} ${s.label}`).join("\n") +
    "\n\n" +
    (params.programName ? `Program: ${params.programName}\n` : "") +
    (band ? `Classification: ${band.toUpperCase()}\n` : "") +
    (params.appLink ? `\nOpen the app: ${params.appLink}\n` : "");

  return {
    subject: params.programName
      ? `Complete your farm setup for ${params.programName}`
      : "Complete your farm setup",
    html: layout(body, "Your next steps to finish setting up your farm."),
    text,
  };
}

/**
 * For someone who already has an account, joining a further program. They do
 * not register again and they have already set up their farms and fields, so
 * this says only what changed: the ID for this program, and that they can log
 * in and enrol.
 */
export function returningEnrollmentEmail(params: {
  fullName: string | null;
  enrollmentId: string;
  programName?: string | null;
  classification?: string | null;
  appLink?: string;
}): EmailContent {
  const firstName = (params.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const band = params.classification
    ? BAND_LABEL[params.classification] ?? null
    : null;

  const rows = [
    ...(params.programName
      ? [{ label: "Program", value: params.programName }]
      : []),
    { label: "Enrollment ID", value: params.enrollmentId, mono: true },
    ...(band ? [{ label: "Classification", value: band.toUpperCase() }] : []),
  ];

  const forProgram = params.programName
    ? `for ${esc(params.programName)}`
    : "for this program";

  const body = `
    ${h1(`Welcome back, ${esc(firstName)}`)}
    ${p(`Your Enrollment ID ${forProgram} has been generated.`)}
    ${details(rows)}
    ${p("You already have an account, so there is nothing to register again. Log in to the app and enrol in the program.")}
    ${params.appLink ? button("Open the app", esc(params.appLink)) : ""}
  `;

  const forProgramText = params.programName
    ? `for ${params.programName}`
    : "for this program";

  const text =
    `Welcome back, ${firstName}\n\n` +
    `Your Enrollment ID ${forProgramText} has been generated.\n\n` +
    (params.programName ? `Program: ${params.programName}\n` : "") +
    `Enrollment ID: ${params.enrollmentId}\n` +
    (band ? `Classification: ${band.toUpperCase()}\n` : "") +
    "\nYou already have an account, so there is nothing to register again. " +
    "Log in to the app and enrol in the program.\n" +
    (params.appLink ? `\nOpen the app: ${params.appLink}\n` : "");

  return {
    subject: params.programName
      ? `Your Enrollment ID for ${params.programName}`
      : "Your Enrollment ID has been generated",
    html: layout(body, "Your Enrollment ID for this program is ready."),
    text,
  };
}

/** The message the Email settings screen sends to prove a provider works. */
export function testEmailContent(provider?: "smtp" | "resend"): EmailContent {
  const via = provider === "resend" ? "Resend" : provider === "smtp" ? "SMTP" : "";
  const app = appName();
  const through = via ? ` sent through ${via}` : "";
  const body = `
    ${h1("Email is working")}
    ${p(`This is a test message${esc(through)}.`)}
    ${p(`If you are reading it, email from ${esc(app)} is reaching people.`)}
  `;
  return {
    subject: `Test email from ${app}`,
    text:
      `This is a test message${through}.

` +
      `If you are reading it, email from ${app} is reaching people.
`,
    html: layout(body, "Test email"),
  };
}
