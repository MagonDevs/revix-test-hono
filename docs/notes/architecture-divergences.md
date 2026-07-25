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
  deleted outright, because nothing outside this repo imports them. This was
  the first half of a decision that has since been finished — see
  "tRPC removed entirely" below.
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

## tRPC removed entirely, replaced by REST under `/api/v1` (2026-07-25)

Architecture §3 specified tRPC as the transport, with four plain-HTTP
routes alongside it. tRPC is now gone; the whole surface is REST.

### Why

tRPC's one real payoff is end-to-end type inference through `AppRouter`,
and it had no consumer. The only client, `adopta-web`, has no
`@trpc/client` dependency at all: it ships a `fetch`-based API client
(`src/server/api-client/`) that calls REST paths against `API_BASE_URL`,
plus a full set of mock handlers under `src/routes/api/v1/*` that already
pinned the exact verbs and paths. Once the types-only export was dropped
(above), tRPC was pure cost — a second transport over the same services,
with its own error formatter, its own procedure builders, and its own
tests to keep in step. Serving both would have doubled the surface for
nothing.

The client's existing mock handlers were treated as the authoritative
spec for paths and verbs, so the real API is a drop-in replacement for
the mock rather than a new dialect for the client to learn.

### What changed

- `src/trpc/**` and every `modules/*/​*.router.ts` are deleted, replaced by
  `src/http/routes/*.route.ts`. `@trpc/server`, `@hono/trpc-server` and
  `superjson` are no longer dependencies.
- The tRPC pieces have plain-HTTP equivalents rather than disappearing:
  `unwrap()` → `http/lib/respond.ts`, `.input()` → `http/lib/parse.ts`,
  `.output()` → `json()`'s schema parse (a handler that drifts from the
  contract still fails loudly), `errorFormatter` →
  `http/lib/http-error.ts` + `middleware/error-handler.ts`,
  `protectedProcedure` → `http/lib/guards.ts`'s `requireUser`, the
  per-user rate-limit middleware → `middleware/user-rate-limit.middleware.ts`.
- **Error envelope changed** from `{ error: { message, data: { appCode, … } } }`
  to `{ error: { code, message, requestId, details?, … } }` — flat, and
  matching what the client already parses.
- **Timestamps are ISO strings, not `Date`s.** superjson used to carry
  `Date` across the wire; plain JSON cannot, so `createdAt`/`updatedAt`/
  `respondedAt` are RFC 3339 strings in the contracts and the mappers
  call `.toISOString()`.
- **Inputs were split** from one tRPC blob into path params + query +
  body. A resource id is only ever read from the path, so a caller can't
  address one pet in the URL and another in the payload. Query schemas
  coerce (everything arrives as a string) and accept repeated params for
  the multi-select filters.
- **Auth is wrapped, not passed through.** Better Auth's own routes are no
  longer exposed; `/api/v1/auth/{register,login,logout,session}` wrap it so
  the client sees one error envelope and one user shape. `user.id` is now
  a uuidv7 (`advanced.database.generateId`) so auth-owned rows share the
  contract's id space.
- **Uploads moved** from `/api/uploads` to `/api/v1/uploads`, including
  the `url` on every `PetPhoto`.

### Open follow-up for the client

`PATCH /users/me` takes `avatarUploadId` (an id the server
ownership-checks and resolves to a URL), while `adopta-web`'s mock accepts
`avatarUrl`. The API deliberately keeps the id: accepting a URL would let
any caller point their avatar at an arbitrary string, and R-15 requires
the ownership check. The client already has the id to hand — it's
`UploadDto.id` from the upload it just performed — so this is a one-field
change on its side.

## `adoptionRequests.create` on an adopted/withdrawn pet: `pet_unavailable` is unreachable (2026-07-25)

The contract contradicts itself for requesting an `adopted`/`withdrawn`
pet, and the implementation resolves the contradiction in favor of the
security rule rather than the convenience rule. Recorded here per the spec
README's governance rule ("if the contract as written is unimplementable
or wrong, do not quietly diverge — change the contract document and the
package, note it in the changelog, and flag it"); see `CHANGELOG.md` 0.1.1
for the changelog entry.

### Why

- `01-api-contract.md` §8.4, rule R-9: `adoptionRequests.create` on a pet
  whose status is `adopted` or `withdrawn` should return
  `conflict`/`pet_unavailable`.
- `01-api-contract.md` §5.4 (the 404-over-403 rule) and rule R-2: a
  resource that exists but is not visible to the caller returns
  `not_found`, not a status that would confirm its existence. §5.4
  explicitly names "a `withdrawn` or `adopted` pet requested by a
  stranger" as a `not_found` case, framed as a security property (avoid
  leaking the existence/state of a record the caller shouldn't see), not a
  convenience.
- These two rules target the same request. Standard visibility (used
  everywhere else, `src/modules/pets/pets.repository.ts`'s
  `visibilityPredicate`: `available`/`reserved`, OR the pet's own owner)
  means an `adopted`/`withdrawn` pet is invisible to every caller except
  its owner. `adoptionRequests.create`
  (`src/modules/adoption-requests/adoption-requests.service.ts`) already
  rejects the owner earlier, via R-7's `self_request` check. So by the
  time the R-9 status check would run, every possible caller has already
  either been turned away as `not_found` (stranger, pet invisible) or
  `conflict`/`self_request` (owner). The `pet_unavailable` branch is dead
  code as specified — no test can legitimately reach it without first
  weakening visibility, which would itself violate R-2/§5.4.

### Resolution

The security rule wins. `not_found` is kept as the actual behavior for a
stranger requesting an adopted/withdrawn pet; §5.4/R-2 stands as written.
`ConflictReason.pet_unavailable` (`src/contracts/errors.ts`) is **not**
removed — deleting an enum member is a breaking contract change, and the
branch could become reachable again if visibility rules ever change (e.g.
a future "recently adopted, visible to past inquirers" feature) — but it
is now documented as currently unreachable at its enum declaration and at
the dead branch in `adoption-requests.service.ts`. The integration test
`R-9: cannot request an adopted or withdrawn pet`
(`src/modules/adoption-requests/adoption-requests.service.integration.test.ts`)
was updated to assert `not_found` instead of `conflict`/`pet_unavailable`.
