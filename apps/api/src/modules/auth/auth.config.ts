import { LIMITS } from "@adopta/contracts";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../../db/client.js";
import * as authSchema from "../../db/schema/auth.js";

// Architecture §5.1. Enough for `npx @better-auth/cli generate` to run
// against, and for the app to boot Better Auth's handler in B2.
//
// UNVERIFIED: the drizzleAdapter import path (`better-auth/adapters/drizzle`
// vs `@better-auth/drizzle-adapter`) and the cookie name are recorded
// as unverified in docs/notes/better-auth.md pending a live run against
// the pinned version.

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  baseURL: process.env["PUBLIC_ORIGIN"] ?? "http://localhost:3000",
  basePath: "/api/auth",
  secret: process.env["AUTH_SECRET"] ?? "dev-secret-change-me-please-32chars",
  trustedOrigins: [process.env["PUBLIC_ORIGIN"] ?? "http://localhost:3000"],
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
