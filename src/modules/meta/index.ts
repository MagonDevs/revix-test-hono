// Module public API (architecture §2.1). `meta` has no router/service of
// its own yet — `trpc/router.ts`'s inline `metaRouter` is the only
// consumer of this data alongside the seeder's pet factory.

export { BREEDS_BY_SPECIES } from "./meta.data.js";
