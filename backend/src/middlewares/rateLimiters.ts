import rateLimit, { type Options } from "express-rate-limit";
import type { RequestHandler } from "express";
import env from "../config/env.js";

const passthrough: RequestHandler = (_req, _res, next) => next();

// Small factory so every limiter shares the same headers and message shape and
// only differs in window, count and wording.
function makeLimiter(
  windowMs: number,
  max: number,
  message: string,
  extra: Partial<Options> = {}
): RequestHandler {
  if (!env.rateLimit.enabled) return passthrough;
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message, code: "TOO_MANY_REQUESTS" },
    ...extra,
  });
}

// Failed sign-ins only (successful logins are skipped), so a real user who mistypes
// a few times is fine but automated password guessing is stopped.
export const loginLimiter = makeLimiter(
  15 * 60 * 1000,
  10,
  "Too many failed sign-in attempts. Please wait a few minutes and try again.",
  { skipSuccessfulRequests: true }
);

// The Enrollment ID lookup answers a question about somebody else's account, so
// it is the tightest limit here. Successful calls count too: a caller working
// through IDs would otherwise get a free pass every time one happened to exist.
export const enrollmentLookupLimiter = makeLimiter(
  15 * 60 * 1000,
  8,
  "Too many Enrollment ID checks. Please wait a few minutes and try again."
);

// Guards the 6-digit codes (verify-otp, reset-password) against guessing. Only
// failed attempts count.
export const codeAttemptLimiter = makeLimiter(
  15 * 60 * 1000,
  10,
  "Too many incorrect codes. Please wait a few minutes and request a new one.",
  { skipSuccessfulRequests: true }
);

// Requesting codes (sign-in OTP, registration) sends email/SMS, so cap how often
// it can be triggered from one client.
export const requestCodeLimiter = makeLimiter(
  10 * 60 * 1000,
  5,
  "Too many code requests. Please wait a few minutes before trying again."
);

export const forgotPasswordLimiter: RequestHandler = env.rateLimit.enabled
  ? rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message:
          "Too many password reset requests. Please try again in a few minutes.",
        code: "TOO_MANY_REQUESTS",
      },
    })
  : passthrough;

// The email-availability check is public and reveals whether an account exists,
// so throttle it to discourage bulk address harvesting.
export const emailCheckLimiter: RequestHandler = env.rateLimit.enabled
  ? rateLimit({
      windowMs: 5 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: "Too many email checks. Please try again in a few minutes.",
        code: "TOO_MANY_REQUESTS",
      },
    })
  : passthrough;

export const importLimiter: RequestHandler = env.rateLimit.enabled
  ? rateLimit({
      windowMs: 5 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message:
          "Too many import attempts. Please wait a few minutes and try again.",
        code: "TOO_MANY_REQUESTS",
      },
    })
  : passthrough;

// The website contact form is unauthenticated, so cap how often one client can
// post. Generous enough that a genuine visitor never notices.
export const contactLimiter = makeLimiter(
  60 * 60 * 1000,
  5,
  "Too many messages sent. Please wait a while before sending another."
);

// The standalone survey submit is public and creates an account plus emails, so
// cap it per client while staying generous for a genuine producer.
export const surveySubmitLimiter = makeLimiter(
  60 * 60 * 1000,
  8,
  "Too many survey submissions. Please wait a while and try again."
);
