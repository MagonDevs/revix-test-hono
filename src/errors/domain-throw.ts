import { AppErrors, type AppError } from "./app-error.js";

// Architecture §2.1/§4/§6 — error-domain primitives. These are used by the
// service layer (to force a transaction rollback) and consumed by the HTTP
// transport layer (`http/lib/respond.ts`'s `unwrap()`, `http/middleware/
// error-handler.ts`), but they are not themselves transport concerns, so
// they live here rather than under `src/http`.

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
