import type { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError.js";
import { verifyWebsiteToken, type WebsiteJwtPayload } from "../utils/jwt.js";
import { findWebsiteUserById } from "../models/websiteUser.model.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      websiteUser?: WebsiteJwtPayload;
    }
  }
}

// Auth for the public website. A valid signature is not enough: the account is
// re-checked on every request so a deleted account stops working immediately.
export async function authenticateWebsite(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  // Everything goes through next(err). Throwing out of an async middleware is
  // an unhandled rejection in Express 4, and the request hangs instead of 401.
  try {
    const header = req.get("authorization");
    if (!header || !header.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Missing or malformed Authorization header.");
    }

    const token = header.slice("Bearer ".length).trim();
    let payload: WebsiteJwtPayload;
    try {
      payload = verifyWebsiteToken(token);
    } catch {
      throw ApiError.unauthorized("Invalid or expired token.");
    }

    const account = await findWebsiteUserById(payload.sub);
    if (!account) {
      throw ApiError.unauthorized(
        "Your account is no longer available. Please sign in again."
      );
    }

    req.websiteUser = payload;
    next();
  } catch (err) {
    next(err);
  }
}

export function websiteUserId(req: Request): string {
  if (!req.websiteUser) throw ApiError.unauthorized("Authentication required.");
  return req.websiteUser.sub;
}
