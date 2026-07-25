import { z } from "zod";
import { LIMITS } from "./constraints.js";
import { idSchema, isoDateTimeSchema } from "./primitives.js";

// §6.1 — UserSummary, embedded wherever a user appears.
export const userSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  city: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});
export type UserSummary = z.infer<typeof userSummarySchema>;

// §6.2 — UserProfile, a public profile.
export const userProfileSchema = userSummarySchema.extend({
  bio: z.string().nullable(),
  availablePetCount: z.number().int().nonnegative(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

// §6.3 — SessionUser, the authenticated caller. `email`/`phone` appear only
// here and inside an accepted request's `contact` (rule R-22).
export const sessionUserSchema = userProfileSchema.extend({
  email: z.string(),
  phone: z.string().nullable(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

// GET /users/:userId — path params.
export const usersByIdParamsSchema = z.object({
  userId: idSchema,
});
export type UsersByIdParams = z.infer<typeof usersByIdParamsSchema>;

// PATCH /users/me — request body.
//
// `avatarUploadId`, not `avatarUrl`: the caller names an upload it owns
// and the server resolves the public URL itself (R-15). Accepting a URL
// would let any caller point its avatar at an arbitrary string, so the
// id — the thing that can be ownership-checked — is the input.
export const usersUpdateMeInputSchema = z
  .strictObject({
    name: z.string().min(LIMITS.user.nameMin).max(LIMITS.user.nameMax).optional(),
    city: z.string().min(LIMITS.user.cityMin).max(LIMITS.user.cityMax).optional(),
    phone: z.string().max(LIMITS.user.phoneMax).nullable().optional(),
    bio: z.string().max(LIMITS.user.bioMax).nullable().optional(),
    avatarUploadId: idSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });
export type UsersUpdateMeInput = z.infer<typeof usersUpdateMeInputSchema>;
