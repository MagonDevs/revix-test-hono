import { config } from "dotenv";

// Loads variables from a local `.env` file into `process.env`, if one
// exists. Must be the *first* import in any entry point (server or CLI
// script) — before `./env.js`, whose module-level `parseEnv()` call
// reads `process.env` at import time (see env.ts). ES module imports are
// evaluated in the order they're written, so as long as this is the
// literal first `import` statement in the entry file, it runs before
// anything that transitively imports env.ts.
//
// `dotenv.config()` defaults are exactly what we want here:
//  - it never overrides variables already present in `process.env`, so
//    real environment variables (prod, Docker, CI, a shell export) always
//    win over `.env` values;
//  - a missing `.env` file is a silent no-op (dotenv catches ENOENT
//    internally and just returns `{ error }` without throwing), which is
//    the normal case in production and CI.
config();
