import { z } from "zod";

// §5 — Error model.

export const appErrorCodeSchema = z.enum([
  "validation_error",
  "unauthenticated",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "internal_error",
]);
export type AppErrorCode = z.infer<typeof appErrorCodeSchema>;

// §5.2 — Conflict reasons. A closed union; the client selects its copy
// from this value, so it must be machine-readable and stable.
export const conflictReasonSchema = z.enum([
  "duplicate_email",
  "self_request",
  "duplicate_request",
  // Currently unreachable via adoptionRequests.create: §5.4/R-2's
  // 404-over-403 rule makes an adopted/withdrawn pet invisible to any
  // caller except its owner, and the owner is already rejected earlier by
  // R-7 (self_request), so the `pet_unavailable` branch in
  // adoption-requests.service.ts never executes. Kept in the enum (not a
  // breaking removal) in case visibility rules ever change and it becomes
  // reachable again. See CHANGELOG.md and
  // docs/notes/architecture-divergences.md for the full writeup.
  "pet_unavailable",
  "invalid_transition",
  "request_already_answered",
  "upload_already_used",
]);
export type ConflictReason = z.infer<typeof conflictReasonSchema>;

// §5.3 — Error body shape. Every non-2xx response from every endpoint
// carries exactly this, so a client has one error branch rather than one
// per transport. The HTTP status and `code` always agree (see
// `http/lib/http-error.ts` for the mapping), and the status is the
// authoritative signal — `code` exists so a client can branch without
// re-deriving meaning from a number.
export const fieldErrorSchema = z.object({
  field: z.string(), // dot/bracket path: 'name', 'photos[0].uploadId'
  message: z.string(),
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

export const apiErrorSchema = z.object({
  code: appErrorCodeSchema, // always
  message: z.string(), // always; safe to show, never carries internal detail
  details: z.array(fieldErrorSchema).optional(), // present iff code === 'validation_error'
  conflictReason: conflictReasonSchema.optional(), // present iff code === 'conflict'
  retryAfterSeconds: z.number().optional(), // present iff code === 'rate_limited'
  requestId: z.string(), // always; correlates with the server log line
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const apiErrorBodySchema = z.object({ error: apiErrorSchema });
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
