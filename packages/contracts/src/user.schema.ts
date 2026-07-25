import { z } from "zod";
import { LIMITS } from "./constraints.js";

// §6.1 — UserSummary, embedded wherever a user appears.
export const userSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: z.date(),
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

// §8.2 — users.byId
export const usersByIdInputSchema = z.strictObject({
  userId: z.string(),
});
export type UsersByIdInput = z.infer<typeof usersByIdInputSchema>;

// §8.2 — users.updateMe
export const usersUpdateMeInputSchema = z
  .strictObject({
    name: z.string().min(LIMITS.user.nameMin).max(LIMITS.user.nameMax).optional(),
    city: z.string().min(LIMITS.user.cityMin).max(LIMITS.user.cityMax).optional(),
    phone: z.string().max(LIMITS.user.phoneMax).nullable().optional(),
    bio: z.string().max(LIMITS.user.bioMax).nullable().optional(),
    avatarUploadId: z.uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });
export type UsersUpdateMeInput = z.infer<typeof usersUpdateMeInputSchema>;
