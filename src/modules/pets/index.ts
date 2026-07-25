// Module public API (architecture §2.1 — "nothing outside a module may
// import that module's internals"). The HTTP layer reaches this module
// through `petsService`; the rest is the cross-module surface other
// modules depend on.

export * as petsService from "./pets.service.js";
export { mapPet, mapPetPhoto } from "./pets.mapper.js";
export type { PetPhotoRow, PetRow, ViewerFlags } from "./pets.mapper.js";
export { isLegalTransition } from "./pets.domain.js";
// Cross-module surface for adoptionRequests (architecture §6.1): visibility
// lookup + a tx-aware, ownership-scoped status write. Deliberately the
// repository-level `setStatus`, not the full `pets.service.setStatus` (which
// owns its own transaction boundary) — adoptionRequests.respond needs
// "reserve the pet" to run inside its own transaction (R-13).
export {
  findById as findVisiblePet,
  findPhotosByPetIds,
  setStatus as setPetStatusInTx,
} from "./pets.repository.js";
