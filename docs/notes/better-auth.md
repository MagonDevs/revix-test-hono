# Better Auth — implementation notes (B1)

Status: **unverified, needs a live `npx @better-auth/cli generate` run.**

This sandbox has no interactive terminal / live Postgres wired up for the
Better Auth CLI, so `apps/api/src/db/schema/auth.ts` was hand-authored to
match Better Auth 1.5+'s documented standard Drizzle schema shape
(singular table names: `user`, `session`, `account`, `verification`)
plus the three `additionalFields` declared in `auth.config.ts` (`city`
required, `phone` and `bio` optional).

## What needs to happen before this ships

1. Provision a real Postgres (e.g. `docker compose up postgres`).
2. Set `DATABASE_URL` and run `npx @better-auth/cli generate` from
   `apps/api`, pointed at `auth.config.ts`.
3. Diff the CLI's output against `src/db/schema/auth.ts` column-by-column
   (types, nullability, defaults, index/unique constraints — especially
   on `session.token` and `user.email`).
4. Replace the hand-authored file with the CLI's output (or reconcile
   any intentional differences) and regenerate the Drizzle migration.

## Open questions, recorded rather than guessed

- **Adapter import path**: architecture §1 flags this as having moved
  between versions (`better-auth/adapters/drizzle` vs
  `@better-auth/drizzle-adapter`). `auth.config.ts` currently imports
  from `better-auth/adapters/drizzle`, which matches the package's
  current (1.5.x) documented path at time of writing — **not verified
  against an installed copy in this environment** (no `pnpm install`
  network access assumed unavailable/unverified here; confirm once
  dependencies are actually installed).
- **Cookie name**: architecture §5.1 states the pattern is
  `<prefix>.session_token` with `advanced.cookiePrefix: 'adopta'`
  configured, which would make it `adopta.session_token` — **not
  verified against a live session**, since verifying requires an actual
  sign-in round trip.
- **`verification.updatedAt`**: modelled as nullable with no default,
  matching Better Auth's typical shape, but this is the single field
  most likely to be wrong in the hand-authored version — Better Auth's
  own generator sometimes emits a `defaultNow()` here depending on
  version. Confirm during the diff in step 3.

## Why city/phone/bio live on `user`

See architecture §5.3: `city` is required at Better Auth's own
`POST /api/auth/sign-up/email`, so it must be an `additionalFields`
entry on `user` rather than a separate `profiles` table — otherwise
registration is non-atomic. `avatarUrl` maps to Better Auth's existing
`user.image`; no second column was added for it.
