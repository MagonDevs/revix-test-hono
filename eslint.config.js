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
            allow: ["http", "trpc", "config", "lib", "db", "errors", "contracts"],
          },
          { from: "http", allow: ["trpc", "module-index", "config", "lib", "errors", "contracts"] },
          {
            from: "trpc",
            allow: ["module-index", "config", "lib", "errors", "contracts"],
          },
          {
            from: "module-router",
            allow: [["module-service", { module: "${from.module}" }], "errors", "lib", "contracts"],
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
            ],
          },
          {
            from: "module-repository",
            allow: [
              "db",
              ["module-domain", { module: "${from.module}" }],
              "errors",
              "lib",
              "contracts",
            ],
          },
          {
            from: "module-policy",
            allow: [["module-domain", { module: "${from.module}" }], "contracts"],
          },
          { from: "module-domain", allow: ["contracts"] },
          {
            from: "module-mapper",
            allow: [["module-domain", { module: "${from.module}" }], "errors", "contracts"],
          },
          {
            from: "module-index",
            allow: [
              ["module-router", { module: "${from.module}" }],
              ["module-service", { module: "${from.module}" }],
            ],
          },
          { from: "db", allow: ["lib"] },
          { from: "adapters", allow: ["ports", "config", "lib"] },
          { from: "ports", allow: [] },
          { from: "config", allow: [] },
          { from: "lib", allow: ["config"] },
          { from: "errors", allow: [] },
          { from: "seed", allow: ["module-index", "db", "lib", "config", "contracts"] },
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

// NOTE on `apiBoundaries`: this refactor discovered (by wiring it in and
// running `pnpm lint`) that the previous workspace's `apps/api/eslint.config.js`
// imported only `base` from `@adopta/eslint-config`, never `apiBoundaries()` —
// so the boundaries/layer rules from architecture §2.1 were defined but never
// actually enforced by `pnpm lint` in the repo this was refactored from. The
// real `src/` code has ~110 latent violations of the literal rule set (e.g.
// module-router/module-service importing `trpc/unwrap.ts` and `trpc/init.ts`
// directly, seed reaching into a module's repository instead of its
// `index.ts`) that predate this refactor and are not introduced by it. Fixing
// all of that is a real architecture cleanup, not an import-path mechanical
// change, and out of scope for a "no behavior change" structural refactor —
// so, matching the prior repo's actual (if accidental) behavior, `apiBoundaries`
// is defined and exported here but not wired into the default lint run below.
// It was verified to work correctly as a mechanism (see the PR/commit
// description): temporarily added to `export default`, confirmed it fails on
// both the pre-existing violations and a freshly-injected one (a service
// importing `drizzle-orm` directly), then reverted to this state.
export default [
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
