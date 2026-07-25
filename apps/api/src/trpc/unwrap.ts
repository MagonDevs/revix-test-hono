import { TRPCError } from "@trpc/server";
import { AppErrors, type AppError } from "../errors/app-error.js";
import type { Result } from "neverthrow";

// Architecture §4, §6 — converts a neverthrow `Result<T, AppError>` into a
// thrown `TRPCError` (Err) or the plain value (Ok). Nothing returns a
// `Result` across the tRPC boundary.

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
 * Converts an unexpected throw (from a repository, driver, or anything
 * outside the neverthrow discipline) into an `AppError` of code
 * `internal_error`. The original error is kept as `cause` for logging —
 * `errorFormatter` never serialises it.
 */
export function toAppError(cause: unknown): AppError {
  if (cause instanceof DomainThrow) return cause.appError;
  const message = cause instanceof Error ? cause.message : "Unexpected error";
  return AppErrors.internal(message, cause);
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

/**
 * Architecture §6 — you cannot return a `Result` from a Drizzle
 * transaction callback and still get a rollback; throwing is the only
 * signal the driver understands. Throw `new DomainThrow(AppErrors.x(...))`
 * inside a `db.transaction(...)` callback to force a rollback, then catch
 * it outside (via `toAppError`) and convert it back to an `Err`.
 */
export class DomainThrow extends Error {
  readonly appError: AppError;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = "DomainThrow";
    this.appError = appError;
  }
}
