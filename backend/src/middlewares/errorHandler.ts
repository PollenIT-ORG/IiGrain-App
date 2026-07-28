import type { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import type { FieldError } from "../types/index.js";

interface PostgresError extends Error {
  code?: string;
  column?: string;
}

interface ErrorResponseBody {
  success: false;
  message: string;
  code: string;
  errors?: FieldError[];
  stack?: string;
  original?: string;
}

const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  const error: ApiError =
    err instanceof ApiError ? err : normalizeError(err);

  const { statusCode, message, code, errors, isOperational } = error;
  const stack = err instanceof Error ? err.stack : undefined;

  const logMeta = {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    code,
  };
  if (statusCode >= 500 || !isOperational) {
    logger.error(message, { ...logMeta, stack });
  } else {
    logger.warn(message, logMeta);
  }

  const body: ErrorResponseBody = {
    success: false,
    message:
      statusCode >= 500 && env.isProduction
        ? "Something went wrong on our end. Please try again later."
        : message,
    code,
  };

  if (Array.isArray(errors) && errors.length > 0) {
    body.errors = errors;
  }

  if (!env.isProduction) {
    body.stack = stack;
    if (error.original) body.original = String(error.original);
  }

  return res.status(statusCode).json(body);
};

function normalizeError(err: unknown): ApiError {
  const prismaErr = mapPrismaError(err);
  if (prismaErr) return prismaErr;

  if (isPostgresError(err) && err.code && /^\d/.test(err.code)) {
    return mapPostgresError(err);
  }

  if (
    typeof err === "object" &&
    err !== null &&
    (err as { type?: string }).type === "entity.parse.failed"
  ) {
    return ApiError.badRequest("Invalid JSON payload in request body.");
  }

  const maybe = err as { statusCode?: number; message?: string };
  const apiErr = new ApiError(
    maybe.statusCode ?? 500,
    maybe.message ?? "Internal server error",
    { isOperational: false }
  );
  apiErr.original = err;
  return apiErr;
}

interface PrismaError extends Error {
  code?: string;
  meta?: Record<string, unknown>;
}

// Prisma error messages embed the failing query and absolute source paths, so
// they must never reach the client. Every branch below returns our own wording
// and keeps the raw error on `original` (dev-only) for debugging.
function mapPrismaError(err: unknown): ApiError | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as PrismaError;
  const name = e.name ?? "";
  if (!name.startsWith("PrismaClient")) return null;

  const attach = (apiErr: ApiError): ApiError => {
    apiErr.original = err;
    return apiErr;
  };

  if (name === "PrismaClientValidationError") {
    return attach(
      ApiError.badRequest(
        "One or more values are not in the expected format. Please check the data and try again."
      )
    );
  }

  switch (e.code) {
    case "P2002": {
      const field = uniqueTargetField(e.meta?.target);
      return attach(
        ApiError.conflict(
          field
            ? `Another record already uses this ${field}. Please choose a different one.`
            : "A record with these details already exists."
        )
      );
    }
    case "P2003":
      return attach(
        ApiError.badRequest(
          "A referenced record no longer exists. Please refresh and try again."
        )
      );
    case "P2025":
      return attach(ApiError.notFound("Record not found."));
    case "P2000":
      return attach(
        ApiError.badRequest("One of the values is too long for its field.")
      );
    case "P2023":
      return attach(ApiError.badRequest("Invalid id format."));
    case "P2010": {
      // Raw query failure - the underlying Postgres code is nested in meta.
      const pgCode = typeof e.meta?.code === "string" ? e.meta.code : undefined;
      if (pgCode === "22P02") {
        return attach(ApiError.badRequest("Invalid id format."));
      }
      if (pgCode && /^\d/.test(pgCode)) {
        return attach(mapPostgresError({ ...new Error(), code: pgCode }));
      }
      return attach(ApiError.internal("Database error."));
    }
    default:
      return attach(ApiError.internal("Database error."));
  }
}

// Turns a Prisma unique-constraint target such as ["lower(name::text)"] or
// ["email"] into a word we can put in a sentence.
function uniqueTargetField(target: unknown): string | null {
  const raw = Array.isArray(target)
    ? target.map(String).join(", ")
    : typeof target === "string"
      ? target
      : null;
  if (!raw) return null;
  const match = /([a-z_]+)/i.exec(raw.replace(/^lower\(/i, ""));
  const name = match?.[1];
  if (!name || name === "lower") return null;
  return name.replace(/_/g, " ");
}

function isPostgresError(err: unknown): err is PostgresError {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as PostgresError).code === "string"
  );
}

function mapPostgresError(err: PostgresError): ApiError {
  switch (err.code) {
    case "23505":
      return ApiError.conflict("A record with these details already exists.");
    case "23503":
      return ApiError.badRequest(
        "Related record not found. Please check the referenced data."
      );
    case "23502":
      return ApiError.validation("A required field is missing.", [
        {
          field: err.column ?? "unknown",
          message: `${err.column ?? "A field"} is required.`,
        },
      ]);
    case "22P02":
      return ApiError.badRequest("Invalid value format in request.");
    default: {
      const apiErr = ApiError.internal("Database error.");
      apiErr.original = err;
      return apiErr;
    }
  }
}

export default errorHandler;
