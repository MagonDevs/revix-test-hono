import { TRPCError } from "@trpc/server";
import type { AppError } from "../errors/app-error.js";
import type { Result } from "neverthrow";

// Architecture §4, §6 — converts a neverthrow `Result<T, AppError>` into a
// thrown `TRPCError` (Err) or the plain value (Ok). Nothing returns a
// `Result` across the tRPC boundary.
//
// `DomainThrow`/`toAppError` used to live here but are error-domain
// concerns, not transport — they now live in `src/errors/domain-throw.ts`.
// This file keeps only the genuinely tRPC-specific piece: Result -> TRPCError.

const TRPC_CODE_BY_APP_CODE: Record<AppError["code"], TRPCError["code"]> = {
  validation_error: "BAD_REQUEST",
  unauthenticated: "UNAUTHORIZED",
  forbidden: "FORBIDDEN",
  not_found: "NOT_FOUND",
  conflict: "CONFLICT",
  rate_limited: "TOO_MANY_REQUESTS",
  internal_error: "INTERNAL_SERVER_ERROR",
};

/**
 * Carries an `AppError` as an `Error` instance so `TRPCError` doesn't
 * rewrap it into an opaque `UnknownCauseError` (its constructor only
 * preserves `cause` values that are already `instanceof Error`).
 * `errorFormatter` (trpc/init.ts) unwraps this back to the `AppError`.
 */
export class AppErrorCause extends Error {
  readonly appError: AppError;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = "AppErrorCause";
    this.appError = appError;
  }
}

/**
 * Attaches the AppError to the TRPCError as `cause` so `errorFormatter`
 * (trpc/init.ts) can pull `appCode` / `conflictReason` / `fieldErrors` /
 * `retryAfterSeconds` back out. `cause` never reaches the wire — only
 * `errorFormatter`'s `shape.data` does.
 */
export function appErrorToTRPCError(error: AppError): TRPCError {
  return new TRPCError({
    code: TRPC_CODE_BY_APP_CODE[error.code],
    message: error.message,
    cause: new AppErrorCause(error),
  });
}

/**
 * `Ok(value)` is passed through; `Err(appError)` is thrown as a
 * `TRPCError`. Call this at the router boundary, after the service layer
 * has done its work.
 */
export function unwrap<T>(result: Result<T, AppError>): T {
  if (result.isOk()) return result.value;
  throw appErrorToTRPCError(result.error);
}
