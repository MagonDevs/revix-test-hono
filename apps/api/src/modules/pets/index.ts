// Module public API (architecture §2.1 — "nothing outside a module may
// import that module's internals"). Kept minimal: nothing outside this
// module needs pets data yet (B6 setStatus and B7 adoptionRequests are
// future work inside/adjacent to this module and can import
// pets.domain.ts / pets.repository.ts directly when they land).

export { petsRouter } from "./pets.router.js";
