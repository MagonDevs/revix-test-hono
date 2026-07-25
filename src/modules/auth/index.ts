// Module public API (architecture §2.1). `auth` (the configured Better
// Auth instance) and `normaliseBetterAuthError` are consumed by
// `http/routes/auth.route.ts`, `http/routes/uploads.route.ts`, and
// `trpc/context.ts` — all outside this module, so they go through here
// rather than reaching into `auth.config.ts`/`auth-error.ts` directly.

export { auth } from "./auth.config.js";
export { normaliseBetterAuthError } from "./auth-error.js";
export type { BetterAuthErrorInput, NormalisedAuthError } from "./auth-error.js";
