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
