import { z } from "zod";

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

export const conflictReasonSchema = z.enum([
  "duplicate_email",
  "self_request",
  "duplicate_request",
  "pet_unavailable",
  "invalid_transition",
  "request_already_answered",
  "upload_already_used",
]);
export type ConflictReason = z.infer<typeof conflictReasonSchema>;

export const fieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

export const apiErrorSchema = z.object({
  code: appErrorCodeSchema,
  message: z.string(),
  details: z.array(fieldErrorSchema).optional(),
  conflictReason: conflictReasonSchema.optional(),
  retryAfterSeconds: z.number().optional(),
  requestId: z.string(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const apiErrorBodySchema = z.object({ error: apiErrorSchema });
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
