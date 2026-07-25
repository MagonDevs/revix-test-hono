import { z } from "zod";
import { LIMITS } from "./constraints.js";
import { idSchema, isoDateTimeSchema } from "./primitives.js";

export const userSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  city: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});
export type UserSummary = z.infer<typeof userSummarySchema>;

export const userProfileSchema = userSummarySchema.extend({
  bio: z.string().nullable(),
  availablePetCount: z.number().int().nonnegative(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const sessionUserSchema = userProfileSchema.extend({
  email: z.string(),
  phone: z.string().nullable(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const usersByIdParamsSchema = z.object({
  userId: idSchema,
});
export type UsersByIdParams = z.infer<typeof usersByIdParamsSchema>;

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
