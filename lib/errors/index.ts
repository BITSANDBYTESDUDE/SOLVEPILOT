import { z } from "zod";

import type { ApiErrorBody, ApiErrorCode } from "@/types/api";

/**
 * Typed application errors.
 *
 * Services throw these; route handlers translate them into the canonical API
 * envelope. Anything that is *not* an `AppError` is treated as an unexpected
 * failure and its details are never returned to the client.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly details?: Record<string, string[]>;
  /** When false the message is replaced by a generic one before reaching clients. */
  readonly expose: boolean;

  constructor(options: {
    message: string;
    code: ApiErrorCode;
    statusCode: number;
    details?: Record<string, string[]>;
    expose?: boolean;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
    this.expose = options.expose ?? true;
  }

  toApiError(): ApiErrorBody {
    return {
      code: this.code,
      message: this.expose ? this.message : "Something went wrong. Please try again.",
      ...(this.expose && this.details ? { details: this.details } : {}),
    };
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request data.", details?: Record<string, string[]>) {
    super({ message, code: "VALIDATION_ERROR", statusCode: 400, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You must be signed in to perform this action.") {
    super({ message, code: "UNAUTHORIZED", statusCode: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super({ message, code: "FORBIDDEN", statusCode: 403 });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super({ message, code: "NOT_FOUND", statusCode: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(message = "The resource already exists.", details?: Record<string, string[]>) {
    super({ message, code: "CONFLICT", statusCode: 409, details });
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "The request could not be processed.", details?: Record<string, string[]>) {
    super({ message, code: "UNPROCESSABLE_ENTITY", statusCode: 422, details });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "The uploaded file is too large.") {
    super({ message, code: "PAYLOAD_TOO_LARGE", statusCode: 413 });
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = "This file type is not supported.") {
    super({ message, code: "UNSUPPORTED_MEDIA_TYPE", statusCode: 415 });
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please slow down and try again shortly.") {
    super({ message, code: "RATE_LIMITED", statusCode: 429 });
  }
}

export class AiServiceError extends AppError {
  constructor(message = "The AI service is temporarily unavailable.", cause?: unknown) {
    super({ message, code: "AI_SERVICE_ERROR", statusCode: 502, cause });
  }
}

export class StorageError extends AppError {
  constructor(message = "File storage is temporarily unavailable.", cause?: unknown) {
    super({ message, code: "STORAGE_ERROR", statusCode: 502, cause });
  }
}

export class InternalError extends AppError {
  constructor(message = "Something went wrong. Please try again.", cause?: unknown) {
    super({ message, code: "INTERNAL_ERROR", statusCode: 500, expose: false, cause });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert a Zod error into field-level details keyed by path.
 */
export function zodErrorToDetails(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    const bucket = details[key] ?? [];
    bucket.push(issue.message);
    details[key] = bucket;
  }

  return details;
}

/**
 * Normalize any thrown value into an `AppError` that is safe to translate into
 * an HTTP response. Unknown errors collapse into a non-exposing 500.
 */
export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (error instanceof z.ZodError) {
    return new ValidationError("Invalid request data.", zodErrorToDetails(error));
  }

  return new InternalError("Something went wrong. Please try again.", error);
}
