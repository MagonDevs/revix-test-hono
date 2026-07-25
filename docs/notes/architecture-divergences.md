# Architecture divergences from the spec

This backend was refactored (2026-07-25) from a pnpm/Turborepo workspace
into a single standalone package. This is a deliberate, user-approved
divergence from the original spec — recorded here so the next reader isn't
confused by the mismatch between the spec documents and the actual repo
layout. **The spec docs themselves (outside this repo) were not edited.**

## Why

`02-architecture.md` §2 and `05-build-plan.md` B0 both assumed a separate
web-client team would consume this repo's `@adopta/contracts` package and
the `AppRouter` type exported from `apps/api/package.json`'s `"./trpc"`
entry (§2.2, "the types-only export"). That assumption stopped being true:
the client team maintains its own contracts layer and does not consume
anything from this repository. With no consumer, the monorepo tooling and
the outward-facing type export were pure overhead, so both were removed.

## What changed

- **Workspace → single package.** `apps/api` and `packages/{contracts,tsconfig,eslint-config}`
  were merged into one root package. `pnpm-workspace.yaml`, `turbo.json`,
  and `.turbo/` are gone; there is no `pnpm --filter` and no `turbo run`
  anywhere. `apps/api/src/*` moved to `src/*`; `packages/contracts/src/*`
  moved to `src/contracts/*` (all history preserved via `git mv`).
- **`@adopta/contracts` → `src/contracts`.** What was a separately
  versioned, separately built package is now ordinary internal source,
  compiled by the same `tsc` build as everything else. Imports changed from
  `from "@adopta/contracts"` to `from "#contracts"`, a Node.js
  package.json `imports` subpath (`"imports": { "#contracts": "./src/contracts/index.ts" }`)
  that resolves natively under `typecheck`, `vitest`, and `tsx` — no path
  aliasing or bundler config needed. The eslint-plugin-boundaries config
  gained a `contracts` element type: importable by everything in the app,
  importing nothing back (leaf-level, zod only) — the same shape the old
  `@adopta/contracts` package had by virtue of being a separate package.
- **The types-only export is gone.** `src/trpc/router.types.ts` (architecture
  §2.2) and the `"exports": { "./trpc": ... }` block in `package.json` were
  deleted outright. `AppRouter` (`typeof appRouter`) still exists in
  `src/trpc/router.ts` for internal use (constructing the tRPC server), it
  just isn't republished as a package entry point anymore, because nothing
  outside this repo imports it. See the README's "Client integration"
  section for how the client actually talks to this API now (plain HTTP:
  tRPC over `POST /trpc/*` with superjson, plus four HTTP routes).
- **Docker simplified.** The old `Dockerfile` ran the server via `tsx` at
  runtime specifically because `@adopta/contracts`'s `exports` pointed at
  raw `.ts` that plain `node` couldn't resolve. That constraint is gone —
  contracts is now compiled by the same `tsc` build — so the runtime stage
  runs the compiled `dist/index.js` with plain `node`. See the Dockerfile's
  header comment for the one remaining wrinkle (rewriting the `#contracts`
  imports mapping to point at `dist/` in the runtime image).

## What did not change

- Business logic, schemas, procedures, and the architecture §2.1 layer
  rules (services don't touch Drizzle, repositories don't import other
  repositories, module internals stay private, domain imports nothing from
  the app) are unchanged — only `contracts` is a new element type in that
  rule set, and the paths it's expressed over now start at `src/` instead
  of `apps/api/src/`.
- `PUBLIC_ORIGIN` and the proxy expectation (architecture §5.2) are
  unchanged and still critical — see the README.
