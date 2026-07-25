# @adopta/api

The Adopta pet-adoption backend: Hono + tRPC v11 on Node 22, Postgres 16 via
Drizzle, Better Auth for sessions, sharp for image processing. Implements
every procedure in `01-api-contract.md` §8.

## Setup

```bash
# from the repo root
pnpm install
cp apps/api/.env.example apps/api/.env   # edit as needed
docker compose up -d postgres            # or point DATABASE_URL at any Postgres 16
pnpm --filter @adopta/api db:migrate
pnpm --filter @adopta/api db:reset       # migrate + seed the demo scenario
pnpm --filter @adopta/api dev            # tsx watch src/index.ts
```

The server listens on `PORT` (default `8787`). Health checks: `GET /health`,
`GET /ready`.

## Scripts (`apps/api/package.json`)

| Script             | What it does                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev`              | `tsx watch src/index.ts` — run the server locally with auto-restart                                                                                                                                                          |
| `typecheck`        | `tsc --noEmit`                                                                                                                                                                                                               |
| `build`            | `tsc -p tsconfig.json` — compiles `apps/api`'s own `.ts` to `dist/`. Does **not** bundle `@adopta/contracts` (see [Client handover](#client-handover)); the container runtime runs via `tsx` instead, see [Docker](#docker). |
| `lint`             | `eslint .`                                                                                                                                                                                                                   |
| `test`             | `vitest run`, excluding `*.integration.test.ts` — no Docker/DB required                                                                                                                                                      |
| `test:integration` | `vitest run -c vitest.integration.config.ts` — spins up a real Postgres via Testcontainers, requires a Docker daemon                                                                                                         |
| `db:generate`      | `drizzle-kit generate` — generates a new migration from schema changes; review the SQL by hand before committing                                                                                                             |
| `db:migrate`       | `tsx src/db/migrate.ts` — applies all pending migrations                                                                                                                                                                     |
| `db:seed`          | `tsx src/seed/index.ts` — seeds a scenario (`--scenario`, `--images`, `--reset`; see below)                                                                                                                                  |
| `db:reset`         | `tsx src/seed/index.ts --reset` — drops and recreates the schema, then seeds the demo scenario                                                                                                                               |
| `sweep:uploads`    | `tsx src/scripts/sweep-uploads.ts` — deletes unreferenced (`consumed_at IS NULL`) uploads older than 24h. A deployment concern to schedule (cron), not run automatically                                                     |

## Environment variables (`src/config/env.ts`)

Validated with Zod at process start; the process exits with a readable
message if anything is missing or malformed.

| Var                 | Default                 | Description                                                                                                                                                                        |
| ------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`          | `development`           | `development` \| `test` \| `production`. Controls pino's pretty-printing.                                                                                                          |
| `PORT`              | `8787`                  | HTTP port the server listens on.                                                                                                                                                   |
| `DATABASE_URL`      | — (required)            | Postgres connection string, must start with `postgres`.                                                                                                                            |
| `DATABASE_POOL_MAX` | `10`                    | Max size of the `pg` connection pool (`db/client.ts`).                                                                                                                             |
| `AUTH_SECRET`       | — (required, ≥32 chars) | Better Auth's signing secret. Never log this; never commit a real value.                                                                                                           |
| `PUBLIC_ORIGIN`     | — (required, URL)       | The **client's** public origin — used as Better Auth's `baseURL`/`trustedOrigins` and the API's CORS `origin`. Not this API's own origin; see [Client handover](#client-handover). |
| `STORAGE_DRIVER`    | `local`                 | `local` \| `s3`. Only `local` (`LocalStorageAdapter`) is implemented; `s3` is a second `StoragePort` implementation, not yet written.                                              |
| `STORAGE_LOCAL_DIR` | `./.storage`            | Filesystem root for the local storage adapter.                                                                                                                                     |
| `LOG_LEVEL`         | `info`                  | pino level: `debug` \| `info` \| `warn` \| `error`.                                                                                                                                |
| `SEED_SCENARIO`     | `demo`                  | Default `--scenario` for `db:seed` when not passed on the CLI.                                                                                                                     |
| `SEED_IMAGE_MODE`   | `ingest`                | Default `--images` for `db:seed`: `ingest` (download real images), `remote` (store provider URLs), `offline` (no network, CI-safe).                                                |

## Seed scenarios

Run with `pnpm db:seed --scenario=<name> --images=<mode> [--reset]`, or
`pnpm db:reset` as a `--scenario=demo --reset` alias.

| Scenario | What it produces                                                                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo`   | ~40 pets across several guardians, real image bytes (by default), a handful of adoption requests and favourites in a realistic mix of statuses. Includes the demo account below. |
| `empty`  | Schema only, zero rows — for exercising empty-state responses.                                                                                                                   |
| `large`  | ~5,000 pets with `offline` images, for pagination/index/performance testing (`EXPLAIN ANALYZE` targets this).                                                                    |
| `edge`   | Every boundary value in the contract's `LIMITS` (max-length strings, min/max ages and weights, etc.).                                                                            |

Seeding is idempotent: user creation looks up an existing row by email
before calling `auth.api.signUpEmail`, and pet/photo/request/favourite
inserts use `ON CONFLICT DO NOTHING` against deterministic seeded ids — a
second run without `--reset` does not duplicate rows.

### Demo credentials

```
email:    marta@example.com
password: password123
```

(`src/seed/scenarios/demo.ts`). Signs in via `POST /api/auth/sign-in/email`.

## Running with Docker Compose

```bash
docker compose up
```

From a clean checkout this builds `apps/api/Dockerfile` (multi-stage,
`node:22-alpine`), starts Postgres 16, and — via
`apps/api/docker-entrypoint.sh` — runs migrations, then an idempotent seed
(`SEED_SCENARIO`, default `demo`), then starts the server on `:8787`.
Override `AUTH_SECRET`/`PUBLIC_ORIGIN`/`SEED_SCENARIO`/`SEED_IMAGE_MODE` via
a `.env` file or shell environment; see `docker-compose.yml`'s `api`
service for the full default set.

**Status: unverified-pending-Docker.** No Docker daemon is available in the
environment this phase was authored in, so `docker compose up` has not
actually been run end-to-end. The Dockerfile and compose file are believed
correct (they mirror the workspace's real install/build/run commands and
the entrypoint's idempotency is backed by the seed factories' own
idempotency guarantees, verified by reading `user.factory.ts` and
`scenarios/demo.ts`), but this needs a real run to confirm before relying
on it for CI or a deploy.

## Client handover

- **`@adopta/contracts`** (`packages/contracts`) is the package the client
  team consumes for every Zod schema and TypeScript type in the contract
  (`01-api-contract.md` §3–§8): request/response shapes, `LIMITS`, enums,
  error data shapes. Depends only on `zod`.
- **`@adopta/api`** exposes its tRPC router **type-only** via the
  `"./trpc"` export in `apps/api/package.json`:
  ```json
  "exports": { "./trpc": "./src/trpc/router.types.ts" }
  ```
  `src/trpc/router.types.ts` contains exactly one line —
  `export type { AppRouter } from "./router.js"` — so importing
  `@adopta/api/trpc` on the client pulls in a type only, never server
  code, secrets, or a runtime dependency graph. **Verification method**
  (no bundler run available in this environment): confirmed statically by
  reading both the `exports` field and the file's contents; the file
  contains only the one type-only re-export line, so any bundler resolving
  that export path has nothing to include at runtime — a client sets up
  `createTRPCClient<AppRouter>` and gets full type inference with zero
  server code in its bundle. **Unverified-pending-tooling**: a live
  bundle-analyzer run (e.g. `esbuild --bundle` + inspect output) was not
  performed; do that once before shipping to catch anything a static read
  could miss (e.g. a future edit to `router.types.ts` that accidentally
  imports a value).
- **`PUBLIC_ORIGIN`**: the client's own public origin, not the API's. It
  drives Better Auth's `baseURL`/`trustedOrigins` (so cookies and CSRF
  checks line up with the origin the browser actually talks to) and the
  API's CORS `origin` header. The client team should tell us their deployed
  origin(s); we set this per environment.
- **HTTP routes** (plain HTTP, not tRPC — everything else is under
  `POST /trpc/<path>`):
  - `POST /api/auth/sign-up/email` — Better Auth email+password sign-up.
  - `POST /api/auth/sign-in/email` — sign-in; sets the `adopta.session_token` cookie (prefix from `advanced.cookiePrefix` in `auth.config.ts`; exact name pending a live round-trip, see `docs/notes/better-auth.md`).
  - `POST /api/auth/sign-out` — invalidates the session.
  - `POST /api/uploads` — authenticated multipart upload (field name `file`); `GET /api/uploads/:uploadId/raw` — serves the processed image bytes with an immutable cache header.
  - (All of `/api/auth/*` is rate-limited at 50 req/15 min/IP; `/api/uploads` at 30/hour/user; `adoptionRequests.create` — a tRPC mutation — at 20/hour/user, see `src/trpc/init.ts`.)
- **E2E CI seed command**: `pnpm --filter @adopta/api db:seed --scenario=demo --reset` gives a clean, deterministic `demo` dataset (including the demo credentials above) for end-to-end runs against a throwaway database.
- Every `/trpc/*` response carries `Cache-Control: private, no-store`
  (asserted by a test) — the client should never cache a tRPC response
  itself; viewer-dependent fields (`isFavourited`, `viewerRequestStatus`,
  `contact`) are computed per request server-side and must not be reused
  across users on the client either.

## Known gaps / unverified-pending-Docker (all phases)

Consolidated for anyone picking this up with real Docker/DB access:

- **This phase (B9):** `docker compose up` end-to-end (see above); the
  bundle-analyzer check on `@adopta/api/trpc`.
- **B1/B4 (Testcontainers-backed tests):** `test:integration` requires a
  real Docker daemon to start Postgres via Testcontainers — not run in
  this environment; rely on `pnpm test` (unit, no DB) having been green
  plus a careful read of the SQL/migrations instead.
- **B3 (Better Auth):** the exact session cookie name and the generated
  auth schema's shape were verified against the pinned package version's
  source/docs (`docs/notes/better-auth.md`) but not against a live
  sign-in round trip in a browser — do that once before the client team
  integrates.
- **B4 (seed images):** `ingest`/`remote` image modes depend on external
  provider URLs being reachable; only `offline` mode was exercised
  without live network access in this environment.
- **B5 (performance):** `EXPLAIN ANALYZE` against the `large` scenario
  (5,000 pets) was not run live in this environment; the query/index
  review in this phase (see `src/modules/*/repository.ts` vs.
  `data-model.md`'s indexes table) is a static read, not a captured query
  plan. Re-run `EXPLAIN ANALYZE` on the six heaviest queries against a
  real `large`-seeded database and confirm no sequential scan before
  relying on the "single-digit milliseconds" DoD from B5.
- **B6 (uploads):** the full publish → fetch → edit → reorder → status
  walk → delete flow described in B6's DoD was exercised via the test
  suite, not manually against a running server with real image bytes in
  this environment.
- **B9 (rate limiting):** all three limiters (auth, uploads,
  `adoptionRequests.create`) are in-memory, single-process fixed-window
  implementations — correct for a single instance, **not** safe across
  multiple replicas. A production deploy with more than one instance
  needs a shared store (e.g. Redis) before these limits are meaningful;
  documented at each limiter's definition (`http/middleware/rate-limit.middleware.ts`, `http/routes/uploads.route.ts`, `trpc/init.ts`).
