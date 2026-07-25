import type { AppError } from "../../errors/app-error.js";
import type { ErrorData } from "@adopta/contracts";

// Shared with `auth.route.ts`'s hand-rolled shape (architecture §5.4):
// `{ error: { message, data: { appCode, ...} } }`. That module is
// specific to rewriting Better Auth's own error bodies; this is the
// generic `AppError -> HTTP` converter for the rest of the plain-HTTP
// surface (contract §7.4-7.5 uploads), so both endpoints emit the exact
// same wire shape the client's error branching relies on.

const STATUS_BY_CODE: Record<AppError["code"], number> = {
  validation_error: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal_error: 500,
};

export interface HttpErrorResponse {
  status: number;
  body: { error: { message: string; data: ErrorData } };
}

export function toHttpErrorBody(error: AppError, requestId: string): HttpErrorResponse {
  const data: ErrorData = { appCode: error.code, requestId };
  if (error.code === "conflict") data.conflictReason = error.reason;
  if (error.code === "validation_error") data.fieldErrors = error.fieldErrors;
  if (error.code === "rate_limited") data.retryAfterSeconds = error.retryAfterSeconds;

  return {
    status: STATUS_BY_CODE[error.code],
    body: { error: { message: error.message, data } },
  };
}
