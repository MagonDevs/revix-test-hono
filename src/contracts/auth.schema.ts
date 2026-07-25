import { z } from "zod";
import { LIMITS } from "./constraints.js";

export const registerRequestSchema = z.strictObject({
  name: z.string().min(LIMITS.user.nameMin).max(LIMITS.user.nameMax),
  email: z.email().max(LIMITS.user.emailMax),
  password: z.string().min(LIMITS.user.passwordMin).max(LIMITS.user.passwordMax),
  city: z.string().min(LIMITS.user.cityMin).max(LIMITS.user.cityMax),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.strictObject({
  email: z.email().max(LIMITS.user.emailMax),
  password: z.string().min(LIMITS.user.passwordMin).max(LIMITS.user.passwordMax),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;
