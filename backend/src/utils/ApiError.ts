import type { ApiErrorOptions, FieldError } from "../types/index.js";

class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly errors: FieldError[];
  public readonly isOperational: boolean;
  public original?: unknown;

  constructor(
    statusCode: number,
    message: string,
    { code, errors = [], isOperational = true }: ApiErrorOptions = {}
  ) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code ?? defaultCodeFor(statusCode);
    this.errors = errors;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", errors: FieldError[] = []): ApiError {
    return new ApiError(400, message, { code: "BAD_REQUEST", errors });
  }

  static validation(
    message = "Validation failed",
    errors: FieldError[] = []
  ): ApiError {
    return new ApiError(400, message, { code: "VALIDATION_ERROR", errors });
  }

  static unauthorized(message = "Authentication required"): ApiError {
    return new ApiError(401, message, { code: "UNAUTHORIZED" });
  }

  static forbidden(
    message = "You do not have permission to do this"
  ): ApiError {
    return new ApiError(403, message, { code: "FORBIDDEN" });
  }

  static notFound(message = "Resource not found"): ApiError {
    return new ApiError(404, message, { code: "NOT_FOUND" });
  }

  static conflict(message = "Resource already exists"): ApiError {
    return new ApiError(409, message, { code: "CONFLICT" });
  }

  static unprocessable(message = "Unprocessable request"): ApiError {
    return new ApiError(422, message, { code: "UNPROCESSABLE_ENTITY" });
  }

  static internal(message = "Something went wrong on our end"): ApiError {
    return new ApiError(500, message, {
      code: "INTERNAL_SERVER_ERROR",
      isOperational: false,
    });
  }
}

function defaultCodeFor(statusCode: number): string {
  const map: Record<number, string> = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "UNPROCESSABLE_ENTITY",
    429: "TOO_MANY_REQUESTS",
    500: "INTERNAL_SERVER_ERROR",
  };
  return map[statusCode] ?? "ERROR";
}

export default ApiError;
