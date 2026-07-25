// Module public API (architecture §2.1). `meta` has no service of its own
// — the `GET /meta/breeds` route reads this list directly, alongside the
// seeder's pet factory.

export { BREEDS_BY_SPECIES } from "./meta.data.js";
