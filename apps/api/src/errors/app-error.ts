import type { ConflictReason, FieldError } from "@adopta/contracts";

// Architecture §4 — the AppError discriminated union. Services return
// `ResultAsync<T, AppError>`; nothing returns a `Result` across the tRPC
// boundary (`unwrap()` converts it at the router).

export type AppError =
  | { code: "validation_error"; message: string; fieldErrors: FieldError[] }
  | { code: "unauthenticated"; message: string }
  | { code: "forbidden"; message: string }
  | { code: "not_found"; message: string; resource: string }
  | { code: "conflict"; message: string; reason: ConflictReason }
  | { code: "rate_limited"; message: string; retryAfterSeconds: number }
  | { code: "internal_error"; message: string; cause?: unknown };

export const AppErrors = {
  notFound: (resource: string): AppError => ({
    code: "not_found",
    message: `${resource} not found`,
    resource,
  }),
  forbidden: (message = "Not permitted"): AppError => ({ code: "forbidden", message }),
  conflict: (reason: ConflictReason, message: string): AppError => ({
    code: "conflict",
    message,
    reason,
  }),
  invalidField: (field: string, message: string): AppError => ({
    code: "validation_error",
    message: "Validation failed",
    fieldErrors: [{ field, message }],
  }),
  validation: (fieldErrors: FieldError[], message = "Validation failed"): AppError => ({
    code: "validation_error",
    message,
    fieldErrors,
  }),
  unauthenticated: (message = "Authentication required"): AppError => ({
    code: "unauthenticated",
    message,
  }),
  rateLimited: (retryAfterSeconds: number, message = "Too many requests"): AppError => ({
    code: "rate_limited",
    message,
    retryAfterSeconds,
  }),
  internal: (message = "Internal error", cause?: unknown): AppError => ({
    code: "internal_error",
    message,
    ...(cause !== undefined ? { cause } : {}),
  }),
};
