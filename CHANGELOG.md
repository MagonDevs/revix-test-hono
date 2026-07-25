# Changelog

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
