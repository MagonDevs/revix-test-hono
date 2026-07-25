import type { ApiErrorBody } from "#contracts";
import type { AppError } from "../../errors/app-error.js";
import type { ContentfulStatusCode } from "hono/utils/http-status";

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
