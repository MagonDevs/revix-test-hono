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

// §5.3 — Error data shape.
export const fieldErrorSchema = z.object({
  field: z.string(), // dot/bracket path: 'name', 'photos[0].uploadId'
  message: z.string(),
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

export const errorDataSchema = z.object({
  appCode: appErrorCodeSchema,
  conflictReason: conflictReasonSchema.optional(), // present iff appCode === 'conflict'
  fieldErrors: z.array(fieldErrorSchema).optional(), // present iff appCode === 'validation_error'
  retryAfterSeconds: z.number().optional(), // present iff appCode === 'rate_limited'
  requestId: z.string(), // always
});
export type ErrorData = z.infer<typeof errorDataSchema>;
