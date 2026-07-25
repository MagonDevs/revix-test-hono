import { z } from "zod";
import { LIMITS } from "./constraints.js";

// POST /api/v1/auth/register. Delegated to Better Auth's `signUpEmail`;
// `city` is a required additional field on the user (architecture §5.3).
export const registerRequestSchema = z.strictObject({
  name: z.string().min(LIMITS.user.nameMin).max(LIMITS.user.nameMax),
  email: z.email().max(LIMITS.user.emailMax),
  password: z.string().min(LIMITS.user.passwordMin).max(LIMITS.user.passwordMax),
  city: z.string().min(LIMITS.user.cityMin).max(LIMITS.user.cityMax),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

// POST /api/v1/auth/login. Delegated to Better Auth's `signInEmail`.
export const loginRequestSchema = z.strictObject({
  email: z.email().max(LIMITS.user.emailMax),
  password: z.string().min(LIMITS.user.passwordMin).max(LIMITS.user.passwordMax),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

// GET /api/v1/auth/session answers 200 with a `SessionUser` (user.schema.ts)
// or 401 `unauthenticated` — never 200 with a null body, so the client
// can branch on the status alone.
