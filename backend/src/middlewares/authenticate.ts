import type { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError.js";
import { verifyToken, type JwtPayload } from "../utils/jwt.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing or malformed Authorization header.");
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    throw ApiError.unauthorized("Invalid or expired token.");
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
