# Changelog

## 0.2.0 — 2026-07-25

**Breaking: tRPC replaced by a REST API under `/api/v1`.** The only client
never used tRPC — it ships a `fetch`-based REST client and a matching set
of mock handlers — so the transport was serving no one. Those mock
handlers were used as the authoritative spec for paths and verbs, making
the real API a drop-in replacement for the mock. Rationale in
`docs/notes/architecture-divergences.md`; the full endpoint table is in
the README.

- Removed `src/trpc/**`, every `modules/*/​*.router.ts`, and the
  `@trpc/server` / `@hono/trpc-server` / `superjson` dependencies. The
  service, repository, domain and mapper layers are untouched.
- Error bodies changed shape: `{ error: { message, data: { appCode, … } } }`
  → `{ error: { code, message, requestId, details?, conflictReason?,
  retryAfterSeconds? } }`. The HTTP status and `code` always agree.
- `createdAt` / `updatedAt` / `respondedAt` are now RFC 3339 strings.
  superjson used to carry `Date` across the wire; plain JSON cannot.
- Procedure inputs were split into path params, query string and body. A
  resource id is only ever read from the path. Query schemas coerce and
  accept repeated params (`?species=dog&species=cat`).
- Better Auth's own routes are no longer exposed. `/api/v1/auth/{register,
  login,logout,session}` wrap it so the client sees one error envelope and
  one user shape. `GET /auth/session` answers 401 when anonymous rather
  than 200 with `null`.
- `user.id` is now a uuidv7 (Better Auth `advanced.database.generateId`),
  matching the contract's UUID id type. **Existing user rows keep their
  old ids** — reseed a development database (`pnpm db:reset`).
- Uploads moved from `/api/uploads` to `/api/v1/uploads`, including the
  `url` on every `PetPhoto`.
- `PATCH /users/me` still takes `avatarUploadId`, not `avatarUrl` — the
  server ownership-checks the id and resolves the URL itself (R-15). The
  client needs a one-field change here; noted in the divergences doc.

## 0.1.1 — 2026-07-25

Fixed: §8.4/R-9 vs §5.4/R-2 contradiction for `adoptionRequests.create` on
an `adopted`/`withdrawn` pet.

- §8.4's R-9 table entry says requesting an `adopted`/`withdrawn` pet
  returns `conflict`/`pet_unavailable`. §5.4 (the 404-over-403 rule) and
  R-2 say a resource that exists but is not visible to the caller returns
  `not_found`, and explicitly name "a `withdrawn` or `adopted` pet
  requested by a stranger" as a `not_found` case — framed as a security
  property (don't leak the existence/state of records the caller can't
  see), not a convenience.
- With the standard visibility predicate (`available`/`reserved`, OR the
  pet's owner), an `adopted`/`withdrawn` pet is invisible to every caller
  except its owner. The owner is already rejected earlier in
  `adoptionRequests.create` by R-7 (`self_request`). So the
  `pet_unavailable` branch in
  `src/modules/adoption-requests/adoption-requests.service.ts` is
  unreachable as specified — no caller can ever trigger it.
- Resolution: the security rule wins. `adoptionRequests.create` keeps
  returning `not_found` for an adopted/withdrawn pet requested by a
  stranger; §5.4/R-2 stands as written. `pet_unavailable` stays in the
  `ConflictReason` enum (`src/contracts/errors.ts`) — removing it would be
  a breaking contract change, and it may become reachable again if
  visibility rules ever change — but is now documented at its enum entry
  and at the unreachable branch as currently dead code.
- Full writeup: `docs/notes/architecture-divergences.md`.

All notable changes to the API contract (`src/contracts`, formerly the
separate `@adopta/contracts` package — see
`docs/notes/architecture-divergences.md`) are documented here. Format
loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/);
entries are added on any change to a schema, enum, constraint, procedure
name, or error code.

## 0.1.0 — 2026-07-25

Initial contract package, covering `01-api-contract.md` in full:

- Enums (`enums.ts`): species, sex, pet size, age group, pet status, request
  status, pet sort, request role; `AGE_GROUP_MONTHS`.
- Constraints (`constraints.ts`): `LIMITS` for user, pet, adoption request,
  upload and list/pagination.
- Error model (`errors.ts`): `AppErrorCode`, `ConflictReason`, `FieldError`,
  and the `error.data` shape (`appCode`, `conflictReason`, `fieldErrors`,
  `retryAfterSeconds`, `requestId`).
- Pagination (`pagination.ts`): `paginationMetaSchema`, `paginatedSchema`.
- Entities (`user.schema.ts`, `pet.schema.ts`, `adoption-request.schema.ts`,
  `upload.schema.ts`): `UserSummary`, `UserProfile`, `SessionUser`,
  `PetPhoto`, `Pet`, `OwnedPet`, `AdoptionRequest`, `Upload`.
- Procedure input schemas for `pets.*`, `adoptionRequests.*`,
  `favourites.*`, `users.*`, `meta.breeds`, `auth.session`, plus the two
  Better Auth request bodies (`authSignUpInputSchema`,
  `authSignInInputSchema`).
