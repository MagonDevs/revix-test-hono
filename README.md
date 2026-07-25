# adopta-api

Backend for **Adopta**, a pet-adoption listing platform: people publish pets that need a home,
others send an adoption request to the person caring for that pet.

## Why this repo exists

**Every line of code here was written by Claude, autonomously, from a written spec.** This is the
backend half of a two-repo pair — see [adopta-web](https://github.com/MagonDevs/revix-test-tanstack)
for the frontend and the full "why" — built to test **[Revix](https://userevix.com)**, AI code
review that reads your whole codebase, not just the diff, the way a senior engineer would.

## Stack

Hono · Node 22 · Postgres 16 via Drizzle · Better Auth · sharp for images. A single standalone
package, no workspace. The public surface is a plain JSON REST API under `/api/v1`.

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres    # or point DATABASE_URL at any Postgres 16
pnpm db:reset                    # migrate + seed the demo scenario
pnpm dev
```

Listens on `PORT` (default `8787`). Health checks: `GET /health`, `GET /ready`.
Demo account: `marta@example.com` / `password123`.

```bash
pnpm typecheck
pnpm lint
pnpm test              # unit, no DB required
pnpm test:integration  # Testcontainers, requires Docker
pnpm validate          # typecheck + lint + test
pnpm build
pnpm db:seed --scenario=<demo|empty|large|edge> --images=<ingest|remote|offline> [--reset]
```

## Environment variables

Validated with Zod at process start — the process exits with a readable message if anything's
missing or malformed.

| Var                 | Default                 | Notes                                                                                 |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | — (required)            | Postgres connection string.                                                           |
| `AUTH_SECRET`       | — (required, ≥32 chars) | Better Auth's signing secret.                                                         |
| `PUBLIC_ORIGIN`     | — (required, URL)       | The **client's** public origin, not this API's — drives Better Auth's `baseURL`/CORS. |
| `PORT`              | `8787`                  |                                                                                       |
| `STORAGE_DRIVER`    | `local`                 | `local` \| `s3` (`s3` not yet implemented).                                           |
| `STORAGE_LOCAL_DIR` | `./.storage`            |                                                                                       |
| `LOG_LEVEL`         | `info`                  |                                                                                       |
| `SEED_SCENARIO`     | `demo`                  | Default `--scenario` for `db:seed`.                                                   |
| `SEED_IMAGE_MODE`   | `ingest`                | Default `--images` for `db:seed`.                                                     |

## API surface

Everything versioned lives under `/api/v1`; `/health` and `/ready` deliberately do not, so an
orchestrator probing them isn't coupled to the client-facing contract.

| Method   | Path                                   | Auth | Body / query                                                                     | Success                            |
| -------- | -------------------------------------- | ---- | -------------------------------------------------------------------------------- | ---------------------------------- |
| `POST`   | `/auth/register`                       | —    | `name`, `email`, `password`, `city`                                              | `201` SessionUser                  |
| `POST`   | `/auth/login`                          | —    | `email`, `password`                                                              | `200` SessionUser                  |
| `POST`   | `/auth/logout`                         | —    | —                                                                                | `204`                              |
| `GET`    | `/auth/session`                        | ✓    | —                                                                                | `200` SessionUser                  |
| `GET`    | `/meta/breeds`                         | —    | `species`                                                                        | `200` `{ items }`                  |
| `GET`    | `/pets`                                | opt  | `q`, `species[]`, `size[]`, `sex`, `ageGroup`, `city`, `sort`, `page`, `perPage` | `200` Paginated\<Pet\>             |
| `POST`   | `/pets`                                | ✓    | CreatePet                                                                        | `201` Pet                          |
| `GET`    | `/pets/:petId`                         | opt  | —                                                                                | `200` Pet                          |
| `PATCH`  | `/pets/:petId`                         | ✓    | any subset of CreatePet                                                          | `200` Pet                          |
| `DELETE` | `/pets/:petId`                         | ✓    | —                                                                                | `204`                              |
| `PATCH`  | `/pets/:petId/status`                  | ✓    | `status`, `declinePendingRequests`                                               | `200` Pet                          |
| `GET`    | `/me/pets`                             | ✓    | `status`, `sort`, `page`, `perPage`                                              | `200` Paginated\<OwnedPet\>        |
| `PATCH`  | `/users/me`                            | ✓    | `name`, `city`, `phone`, `bio`, `avatarUploadId`                                 | `200` SessionUser                  |
| `GET`    | `/users/:userId`                       | —    | —                                                                                | `200` UserProfile                  |
| `GET`    | `/users/:userId/pets`                  | opt  | `page`, `perPage`                                                                | `200` Paginated\<Pet\>             |
| `POST`   | `/pets/:petId/adoption-requests`       | ✓    | `message`                                                                        | `201` AdoptionRequest              |
| `GET`    | `/me/adoption-requests`                | ✓    | `role` (required), `status`, `petId`, `page`, `perPage`                          | `200` Paginated\<AdoptionRequest\> |
| `GET`    | `/adoption-requests/:requestId`        | ✓    | —                                                                                | `200` AdoptionRequest              |
| `PATCH`  | `/adoption-requests/:requestId/status` | ✓    | `status`, `reservePet`                                                           | `200` AdoptionRequest              |
| `DELETE` | `/adoption-requests/:requestId`        | ✓    | — (withdraw)                                                                     | `204`                              |
| `GET`    | `/me/favourites`                       | ✓    | `page`, `perPage`                                                                | `200` Paginated\<Pet\>             |
| `PUT`    | `/me/favourites/:petId`                | ✓    | —                                                                                | `204`                              |
| `DELETE` | `/me/favourites/:petId`                | ✓    | —                                                                                | `204`                              |
| `POST`   | `/uploads`                             | ✓    | multipart, field `file`                                                          | `201` Upload                       |
| `GET`    | `/uploads/:uploadId/raw`               | —    | —                                                                                | `200` bytes                        |

### Conventions

- **Errors** are always `{ "error": { code, message, requestId, details?, conflictReason?,
retryAfterSeconds? } }`. `code` is one of `validation_error`, `unauthenticated`, `forbidden`,
  `not_found`, `conflict`, `rate_limited`, `internal_error`, and always agrees with the HTTP
  status. `details` carries per-field messages on a validation failure; `requestId` matches the
  `x-request-id` response header and the server log line.
- **Timestamps** are RFC 3339 strings (`2026-07-25T10:30:00.000Z`) — plain JSON, no custom
  transformer. All ids are UUIDs.
- **Sessions** are cookie-based (Better Auth). Send credentials on every request;
  `PUBLIC_ORIGIN` must match the origin the browser actually talks to, or cookies/CSRF break.
- Every `/api/v1/*` response is `Cache-Control: private, no-store` — viewer-dependent fields
  (`isFavourited`, `viewerRequestStatus`, `contact`) are computed per request, never cached. The
  one exception is `/uploads/:uploadId/raw`, which is immutable and cached for a year.
- No shared package: a client builds its own types from the Zod contracts in `src/contracts/`.

## Docker

```bash
docker compose up
```

Builds the image, starts Postgres, runs migrations + an idempotent seed, starts the server on
`:8787`. **Status: unverified-pending-Docker** — no Docker daemon was available in the environment
this was built in, so this hasn't been run end-to-end; believed correct from reading the
Dockerfile/entrypoint/seed idempotency, not confirmed live.

## Known gaps

Honest handover list — everything below needs a real run to confirm, not yet done:

- `docker compose up` end-to-end (needs a Docker daemon). `pnpm test:integration` now runs green
  against Testcontainers.
- `EXPLAIN ANALYZE` on the `large` (5,000-pet) scenario's heaviest queries.
- The full uploads flow (publish → edit → reorder → delete) against a running server with real
  image bytes — exercised via tests, not manually.
- Rate limiting is in-memory/single-process — needs a shared store (Redis) before it means
  anything behind more than one instance.

See `docs/notes/architecture-divergences.md` for why this repo diverged from the original
multi-package spec, and `docs/notes/better-auth.md` for the session-cookie investigation.
