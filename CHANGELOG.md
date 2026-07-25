# Changelog

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
