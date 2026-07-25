// Module public API (architecture §2.1).

export * as adoptionRequestsService from "./adoption-requests.service.js";
// Cross-module surface for `modules/pets` (architecture §6.1 — R-6):
// declining a pet's pending requests when it becomes adopted must run in
// the same transaction as the pet's status write, so this is the
// repository-level, tx-aware write, exported through this module's public
// API rather than importing `adoption-requests.repository.ts` directly.
export { declinePendingForPet as declinePendingRequestsForPet } from "./adoption-requests.repository.js";
