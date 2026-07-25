import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import * as authSchema from "../../db/schema/auth.js";
import { LIMITS } from "#contracts";

// Architecture §5.1. B3: wired to the parsed `env` (config/env.ts) instead
// of reading `process.env` directly, so a missing/invalid var fails boot
// the same way everywhere else does.
//
// §5.2 — one public origin: `baseURL`/`trustedOrigins` are the CLIENT's
// public origin (env.PUBLIC_ORIGIN), not this API's own origin. Better
// Auth uses `baseURL` to build absolute links (e.g. email verification)
// and validates `trustedOrigins` for CSRF — both must point at the
// origin the browser actually talks to.
//
// VERIFIED against the installed better-auth@1.6.25 package.json
// `exports` map: `better-auth/adapters/drizzle` is the correct subpath
// (see docs/notes/better-auth.md — this specific item is no longer
// unverified). Cookie name / auth table shape are still pending a live
// sign-in round trip per that note.

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  baseURL: env.PUBLIC_ORIGIN,
  basePath: "/api/auth",
  secret: env.AUTH_SECRET,
  trustedOrigins: [env.PUBLIC_ORIGIN],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: LIMITS.user.passwordMin,
    maxPasswordLength: LIMITS.user.passwordMax,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      city: { type: "string", required: true, input: true },
      phone: { type: "string", required: false, input: false },
      bio: { type: "string", required: false, input: false },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  advanced: { cookiePrefix: "adopta" },
});
