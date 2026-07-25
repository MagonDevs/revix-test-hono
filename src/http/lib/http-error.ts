import type { ApiErrorBody } from "#contracts";
import type { AppError } from "../../errors/app-error.js";
import type { ContentfulStatusCode } from "hono/utils/http-status";

// Architecture §4 / contract §5 — the single `AppError -> HTTP` converter.
// Every error response in the system goes through here, so the status and
// the body's `code` can never disagree and no endpoint can invent its own
// error shape.

const STATUS_BY_CODE: Record<AppError["code"], ContentfulStatusCode> = {
  validation_error: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal_error: 500,
};

export interface HttpErrorResponse {
  status: ContentfulStatusCode;
  body: ApiErrorBody;
}

/**
 * `message` is taken from the AppError for every code except
 * `internal_error`, where it is replaced with a fixed string: an
 * unexpected throw's own message can carry a SQL fragment, a file path,
 * or a driver detail, and architecture §4 forbids any of that reaching
 * the wire, in any environment. The real message is logged instead,
 * against the same `requestId` the client is handed back.
 */
export function toHttpErrorBody(error: AppError, requestId: string): HttpErrorResponse {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.code === "internal_error" ? "Internal error" : error.message,
      requestId,
    },
  };

  if (error.code === "validation_error") body.error.details = error.fieldErrors;
  if (error.code === "conflict") body.error.conflictReason = error.reason;
  if (error.code === "rate_limited") body.error.retryAfterSeconds = error.retryAfterSeconds;

  return { status: STATUS_BY_CODE[error.code], body };
}
