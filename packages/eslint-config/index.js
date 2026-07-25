// @adopta/eslint-config — flat ESLint config shared across the workspace.
//
// Exports a factory so each package/app can opt into the boundaries rules
// (which only make sense once apps/api/src exists) without every consumer
// paying for a config that doesn't apply to it.

import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/**
 * Base rules shared by every package: recommended JS + type-checked TS,
 * import ordering, Prettier compatibility. No boundaries here — that is
 * layered on top by `apiBoundaries()` for apps/api specifically.
 */
export const base = tseslint.config(
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
 * live outside any package's tsconfig program (e.g. the repo-root
 * eslint.config.js, commitlint.config.js). Used by the root config and by
 * lint-staged when it touches such a file directly.
 */
export const plain = tseslint.config(js.configs.recommended, {
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
  },
});

/**
 * apps/api/src layer rules from architecture §2.1, enforced with
 * eslint-plugin-boundaries. The three rules that catch real mistakes:
 * services may not import Drizzle, repositories may not import other
 * repositories, and nothing outside a module may import that module's
 * internals.
 */
export function apiBoundaries({ srcDir = "apps/api/src", rootPath = process.cwd() } = {}) {
  return tseslint.config({
    plugins: { boundaries },
    settings: {
      // Resolves relative `.js`-suffixed specifiers (required by
      // verbatimModuleSyntax/NodeNext) back to their `.ts` source files, so
      // the boundaries plugin can actually see what a module imports.
      "import/resolver": { typescript: { project: `${srcDir}/../tsconfig.json` } },
      "boundaries/root-path": rootPath,
      "boundaries/include": [`${srcDir}/**/*.ts`],
      "boundaries/elements": [
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
            { from: "entry", allow: ["http", "trpc", "config", "lib", "db", "errors"] },
            { from: "http", allow: ["trpc", "module-index", "config", "lib", "errors"] },
            {
              from: "trpc",
              allow: ["module-index", "config", "lib", "errors"],
            },
            {
              from: "module-router",
              allow: [["module-service", { module: "${from.module}" }], "errors", "lib"],
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
              ],
            },
            {
              from: "module-repository",
              allow: ["db", ["module-domain", { module: "${from.module}" }], "errors", "lib"],
            },
            { from: "module-policy", allow: [["module-domain", { module: "${from.module}" }]] },
            { from: "module-domain", allow: [] },
            {
              from: "module-mapper",
              allow: [["module-domain", { module: "${from.module}" }], "errors"],
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
            { from: "seed", allow: ["module-index", "db", "lib", "config"] },
          ],
        },
      ],
    },
  });
}

export default base;
