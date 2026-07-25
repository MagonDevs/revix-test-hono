// Architecture §2.1, §4.1 — pure authorization predicates for the "can
// see it but may not act on it" case. B6's write procedures
// (update/setStatus/remove) don't have one: "not the owner" is R-2, not
// forbidden, so it's implemented as visibility-in-the-query (the
// `ownerId` scoping in `pets.repository.ts`'s `update`/`setStatus`/
// `deleteById`), exactly like `findById`'s existing predicate — not a
// post-fetch policy check. There is currently no pets action where the
// caller can legitimately see the resource but isn't allowed to perform
// it, so this file is intentionally empty for now rather than forcing a
// predicate to exist. Add one here if/when such a case appears (e.g. a
// future action gated by something other than ownership).
export {};
