import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";
import env from "../config/env.js";

const passthrough: RequestHandler = (_req, _res, next) => next();

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
