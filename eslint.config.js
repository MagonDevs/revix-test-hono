// adopta-api — single flat ESLint config for the whole (now standalone)
// package. Previously split across a workspace-shared `@adopta/eslint-config`
// package plus a thin per-package config; inlined here now that there's only
// one package. See docs/notes/architecture-divergences.md.

import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";

const srcDir = "src";
const rootPath = process.cwd();

/**
 * Base rules shared by every TS file under `src/`: recommended JS +
 * type-checked TS, import ordering, Prettier compatibility.
 */
const base = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    plugins: { import: importPlugin },
    rules: {
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
          "newlines-between": "never",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  prettier,
);

/**
 * Plain JS/TS rules with no type-checked linting — for config files that
 * live outside `src`'s tsconfig program (this file, commitlint.config.js,
 * drizzle.config.ts, vitest configs).
 */
const plain = tseslint.config(js.configs.recommended, {
  plugins: { import: importPlugin },
  languageOptions: {
    globals: { process: "readonly" },
  },
  rules: {
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
        "newlines-between": "never",
        alphabetize: { order: "asc", caseInsensitive: true },
      },
    ],
  },
});

/**
 * `src/` layer rules from architecture §2.1, enforced with
 * eslint-plugin-boundaries. Catches real mistakes: services may not import
 * Drizzle, repositories may not import other repositories, nothing outside
 * a module may import that module's internals, `src/contracts` is leaf-level
 * (zod only, importable by everything, imports nothing from the app).
 */
const apiBoundaries = tseslint.config({
  plugins: { boundaries },
  settings: {
    // Resolves relative `.js`-suffixed specifiers (required by
    // verbatimModuleSyntax/NodeNext) back to their `.ts` source files, so
    // the boundaries plugin can actually see what a module imports.
    "import/resolver": { typescript: { project: `${srcDir}/../tsconfig.json` } },
    "boundaries/root-path": rootPath,
    "boundaries/include": [`${srcDir}/**/*.ts`],
    "boundaries/elements": [
      { type: "contracts", pattern: `${srcDir}/contracts/**`, mode: "file" },
      // Composition root: the one `http/**` file allowed to wire concrete
      // dependencies (db, adapters) together, same rationale as `entry`
      // below. Listed before the general `http` pattern so it wins.
      { type: "http-root", pattern: `${srcDir}/http/app.ts`, mode: "file" },
      { type: "http", pattern: `${srcDir}/http/**`, mode: "file" },
      { type: "trpc", pattern: `${srcDir}/trpc/**`, mode: "file" },
      {
        type: "module-router",
        pattern: `${srcDir}/modules/*/*.router.ts`,
        mode: "file",
        capture: ["module"],
      },
      {
        type: "module-service",
        pattern: `${srcDir}/modules/*/*.service.ts`,
        mode: "file",
        capture: ["module"],
      },
      {
        type: "module-repository",
        pattern: `${srcDir}/modules/*/*.repository.ts`,
        mode: "file",
        capture: ["module"],
      },
      {
        type: "module-policy",
        pattern: `${srcDir}/modules/*/*.policy.ts`,
        mode: "file",
        capture: ["module"],
      },
      {
        type: "module-domain",
        pattern: `${srcDir}/modules/*/*.domain.ts`,
        mode: "file",
        capture: ["module"],
      },
      {
        type: "module-mapper",
        pattern: `${srcDir}/modules/*/*.mapper.ts`,
        mode: "file",
        capture: ["module"],
      },
      {
        type: "module-index",
        pattern: `${srcDir}/modules/*/index.ts`,
        mode: "file",
        capture: ["module"],
      },
      {
        type: "module-internal",
        pattern: `${srcDir}/modules/*/**`,
        mode: "file",
        capture: ["module"],
      },
      // `db/types.ts` is the `Database`/`Executor`/`Transaction` type-only
      // surface services legitimately need to own their transaction
      // boundary (architecture §2.1) — split out from the general `db`
      // type (Drizzle schema/client, query building) so services can
      // depend on the former without gaining access to the latter. Listed
      // before the general `db` pattern so it wins.
      { type: "db-types", pattern: `${srcDir}/db/types.ts`, mode: "file" },
      { type: "db", pattern: `${srcDir}/db/**`, mode: "file" },
      { type: "ports", pattern: `${srcDir}/ports/**`, mode: "file" },
      { type: "adapters", pattern: `${srcDir}/adapters/**`, mode: "file" },
      { type: "config", pattern: `${srcDir}/config/**`, mode: "file" },
      { type: "lib", pattern: `${srcDir}/lib/**`, mode: "file" },
      { type: "errors", pattern: `${srcDir}/errors/**`, mode: "file" },
      { type: "seed", pattern: `${srcDir}/seed/**`, mode: "file" },
      { type: "entry", pattern: `${srcDir}/index.ts`, mode: "file" },
    ],
  },
  rules: {
    "boundaries/no-unknown": "error",
    "boundaries/no-unknown-files": "off",
    "boundaries/element-types": [
      "error",
      {
        default: "disallow",
        rules: [
          { from: "contracts", allow: [] },
          {
            from: "entry",
            allow: ["http", "http-root", "trpc", "config", "lib", "db", "errors", "contracts"],
          },
          // Composition root (architecture §3): the one `http/**` file
          // allowed to construct concrete `db`/`adapters` instances and
          // pass them down. Ordinary route files receive them by injection
          // instead (see `http` below).
          {
            from: "http-root",
            allow: [
              "http",
              "trpc",
              "module-index",
              "config",
              "lib",
              "errors",
              "contracts",
              "db",
              "db-types",
              "adapters",
            ],
          },
          {
            from: "http",
            allow: [
              "http-root",
              "trpc",
              "module-index",
              "config",
              "lib",
              "errors",
              "contracts",
              "db-types",
              "ports",
            ],
          },
          {
            from: "trpc",
            allow: ["db", "db-types", "module-index", "config", "lib", "errors", "contracts"],
          },
          {
            from: "module-router",
            allow: [
              ["module-service", { module: "${from.module}" }],
              "trpc",
              "errors",
              "lib",
              "contracts",
            ],
          },
          {
            from: "module-service",
            allow: [
              ["module-repository", { module: "${from.module}" }],
              ["module-policy", { module: "${from.module}" }],
              ["module-domain", { module: "${from.module}" }],
              ["module-mapper", { module: "${from.module}" }],
              // other modules only through their public index.ts
              ["module-index", { module: "!${from.module}" }],
              "ports",
              "errors",
              "lib",
              "contracts",
              // Type-only Database/Executor/Transaction surface — services
              // own their transaction boundary (architecture §6) but must
              // not import Drizzle itself.
              "db-types",
            ],
          },
          {
            from: "module-repository",
            allow: [
              "db",
              "db-types",
              ["module-domain", { module: "${from.module}" }],
              ["module-mapper", { module: "${from.module}" }],
              ["module-index", { module: "!${from.module}" }],
              "errors",
              "lib",
              "contracts",
            ],
          },
          {
            from: "module-policy",
            allow: [["module-domain", { module: "${from.module}" }], "contracts"],
          },
          {
            from: "module-domain",
            allow: ["contracts"],
          },
          {
            from: "module-internal",
            allow: ["db", "config", "contracts"],
          },
          {
            from: "module-mapper",
            allow: [
              ["module-domain", { module: "${from.module}" }],
              ["module-index", { module: "!${from.module}" }],
              "errors",
              "contracts",
            ],
          },
          {
            from: "module-index",
            allow: [
              ["module-router", { module: "${from.module}" }],
              ["module-service", { module: "${from.module}" }],
              // Modules with no router/service of their own (e.g. `auth`,
              // `meta`) re-export their plain internal files directly.
              ["module-internal", { module: "${from.module}" }],
            ],
          },
          { from: "db-types", allow: ["db"] },
          { from: "db", allow: ["db-types", "config", "lib"] },
          { from: "adapters", allow: ["ports", "config", "lib"] },
          { from: "ports", allow: [] },
          { from: "config", allow: [] },
          { from: "lib", allow: ["config"] },
          { from: "errors", allow: ["contracts"] },
          // Dev/CLI tool outside the request path (architecture §2.1's
          // exemption): legitimately constructs adapters, uses ports, and
          // writes through repositories/module internals directly. The
          // reverse direction (anything importing `seed`) stays forbidden —
          // see `trpc`/`http`/module rules above, none of which allow it.
          {
            from: "seed",
            allow: [
              "module-index",
              "module-internal",
              "module-repository",
              "ports",
              "adapters",
              "db",
              "db-types",
              "lib",
              "config",
              "contracts",
            ],
          },
        ],
      },
    ],
  },
});

// Root-level config files aren't part of the `src` tsconfig program, so they
// get untyped ("plain") linting only; everything under `src/**/*.ts` gets
// the full typed treatment. `drizzle.config.ts`/the vitest configs/
// `vitest.setup.ts` are intentionally left out of lint entirely — matching
// the previous workspace's config, which ignored them for the same reason
// (outside any tsconfig program, and not worth a separate untyped pass).
const rootConfigFiles = ["eslint.config.js", "commitlint.config.js"];

// NOTE on `apiBoundaries`: this was initially defined but not wired into the
// default export (~110 latent violations from the old workspace config, then
// 33 after the allow-list was corrected to close genuine gaps in the
// architecture spec — e.g. routers importing trpc/init.ts, mappers using
// other modules' index.ts, repositories importing db). Those 33 have since
// been fixed at the source level: `DomainThrow`/`toAppError` moved out of
// `trpc/unwrap.ts` into `errors/domain-throw.ts` (module-service → trpc);
// `pets.service.ts` no longer imports Drizzle/adapters directly (the R-6
// cross-table update moved into `modules/adoption-requests`'s public API,
// id generation moved to a module-level default implementing `IdPort`);
// `http/routes/*` reach modules through their `index.ts` and receive
// db/adapters by injection from the composition root (`http/app.ts`, now
// its own `http-root` element type — same idea as `entry`); the seeder
// (`seed`) is allowed to import module internals/repositories/ports/
// adapters/db directly, since it is dev/CLI tooling outside the request
// path, but nothing may import `seed` back; and the curated breed list
// moved from `seed/data/breeds.ts` to `modules/meta/`, so `trpc/router.ts`'s
// `meta.breeds` no longer depends on the seeder. Test files remain excluded
// from boundaries enforcement (they legitimately reach across layers to
// build fixtures). `apiBoundaries` is now wired into the default export and
// enforced on every `pnpm lint` run.
export default [
  ...apiBoundaries,
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "drizzle.config.ts",
      "vitest.config.ts",
      "vitest.integration.config.ts",
      "vitest.setup.ts",
    ],
  },
  ...plain.map((c) => ({ ...c, files: rootConfigFiles })),
  ...base.map((c) => ({ ...c, files: ["src/**/*.ts"] })),
  // Disable boundaries enforcement for test files (they legitimately reach
  // across layers to build fixtures).
  {
    files: ["src/**/*.test.ts", "src/**/*.integration.test.ts"],
    rules: {
      "boundaries/element-types": "off",
      "boundaries/no-unknown": "off",
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];

export { apiBoundaries };
