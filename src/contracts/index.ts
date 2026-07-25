export * from "./enums.js";
export * from "./constraints.js";
export * from "./errors.js";
export * from "./pagination.js";
export * from "./user.schema.js";
export * from "./pet.schema.js";
export * from "./adoption-request.schema.js";
export * from "./favourite.schema.js";
export * from "./upload.schema.js";
export * from "./auth.schema.js";
export * from "./meta.schema.js";

import { sessionUserSchema } from "./user.schema.js";

// §8.1 — auth.session output: SessionUser, or null when there is no session.
export const authSessionOutputSchema = sessionUserSchema.nullable();
