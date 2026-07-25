// Module public API (architecture §2.1 — "nothing outside a module may
// import that module's internals"). Kept minimal: nothing outside this
// module needs pets data yet (B6 setStatus and B7 adoptionRequests are
// future work inside/adjacent to this module and can import
// pets.domain.ts / pets.repository.ts directly when they land).

export { petsRouter } from "./pets.router.js";
export { mapPetPhoto } from "./pets.mapper.js";
export type { PetPhotoRow } from "./pets.mapper.js";
export { isLegalTransition } from "./pets.domain.js";
// Cross-module surface for adoptionRequests (architecture §6.1): visibility
// lookup + a tx-aware, ownership-scoped status write. Deliberately the
// repository-level `setStatus`, not the full `pets.service.setStatus` (which
// owns its own transaction boundary) — adoptionRequests.respond needs
// "reserve the pet" to run inside its own transaction (R-13).
export { findById as findVisiblePet, setStatus as setPetStatusInTx } from "./pets.repository.js";
