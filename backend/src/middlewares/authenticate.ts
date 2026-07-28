import type { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError.js";
import { verifyToken, type JwtPayload } from "../utils/jwt.js";
import { getUserAuthStatus } from "../models/user.model.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.get("authorization");
    if (!header || !header.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Missing or malformed Authorization header.");
    }

    const token = header.slice("Bearer ".length).trim();
    let payload: JwtPayload;
    try {
      payload = verifyToken(token);
    } catch {
      throw ApiError.unauthorized("Invalid or expired token.");
    }

    // A valid signature is not enough - the account may have been deactivated or
    // deleted after this token was issued. Re-check on every request so an old
    // token stops working immediately.
    const status = await getUserAuthStatus(payload.sub);
    if (!status || status.deleted_at) {
      throw ApiError.unauthorized(
        "Your account is no longer available. Please sign in again."
      );
    }
    if (!status.is_active) {
      throw ApiError.forbidden(
        "Your account has been deactivated. Contact an administrator."
      );
    }

    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required.");
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      throw ApiError.forbidden(
        "You do not have permission to access this resource."
      );
    }
    next();
  };
}
