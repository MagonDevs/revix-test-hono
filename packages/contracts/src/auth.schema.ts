import { z } from "zod";
import { LIMITS } from "./constraints.js";

// §7.1 — POST /api/auth/sign-up/email request body. Handled by Better Auth;
// `city` is a required additional field on the user (architecture §5.3).
export const authSignUpInputSchema = z.strictObject({
  name: z.string().min(LIMITS.user.nameMin).max(LIMITS.user.nameMax),
  email: z.email().max(LIMITS.user.emailMax),
  password: z.string().min(LIMITS.user.passwordMin).max(LIMITS.user.passwordMax),
  city: z.string().min(LIMITS.user.cityMin).max(LIMITS.user.cityMax),
});
export type AuthSignUpInput = z.infer<typeof authSignUpInputSchema>;

// §7.2 — POST /api/auth/sign-in/email request body.
export const authSignInInputSchema = z.strictObject({
  email: z.email().max(LIMITS.user.emailMax),
  password: z.string().min(LIMITS.user.passwordMin).max(LIMITS.user.passwordMax),
});
export type AuthSignInInput = z.infer<typeof authSignInInputSchema>;

// §8.1 — auth.session has no input; output is `SessionUser | null`, defined
// in user.schema.ts and re-exported via index.ts as `authSessionOutputSchema`.
