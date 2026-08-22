import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import ApiError from "../utils/ApiError.js";
import type { FieldError } from "../types/index.js";

type RequestPart = "body" | "query" | "params";

export function validate(schema: ZodTypeAny, part: RequestPart = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      throw ApiError.validation(
        "Please fix the highlighted fields.",
        zodToFieldErrors(result.error)
      );
    }

    if (part === "body") {
      req.body = result.data;
    } else {
      Object.defineProperty(req, part, {
        value: result.data,
        writable: true,
        configurable: true,
      });
    }
    next();
  };
}

/**
 * Same as validate, but the schema is chosen from the request itself. Used
 * where the shape of the body depends on the URL, for example a monitoring
 * module whose columns differ per module. Returning null from the picker means
 * the request named something that does not exist.
 */
export function validateWith(
  pick: (req: Request) => ZodTypeAny | null,
  notFoundMessage = "Unknown type."
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const schema = pick(req);
    if (!schema) throw ApiError.badRequest(notFoundMessage);

    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw ApiError.validation(
        "Please fix the highlighted fields.",
        zodToFieldErrors(result.error)
      );
    }
    req.body = result.data;
    next();
  };
}

function zodToFieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
}
