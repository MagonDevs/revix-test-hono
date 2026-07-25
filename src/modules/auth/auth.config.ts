import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { v7 as uuidv7 } from "uuid";
import { LIMITS } from "#contracts";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import * as authSchema from "../../db/schema/auth.js";

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
  advanced: {
    cookiePrefix: "adopta",
    database: { generateId: () => uuidv7() },
  },
});
