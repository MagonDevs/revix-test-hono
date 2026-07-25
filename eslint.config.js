import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";

const srcDir = "src";
const rootPath = process.cwd();

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

const apiBoundaries = tseslint.config({
  plugins: { boundaries },
  settings: {
    "import/resolver": { typescript: { project: `${srcDir}/../tsconfig.json` } },
    "boundaries/root-path": rootPath,
    "boundaries/include": [`${srcDir}/**/*.ts`],
    "boundaries/elements": [
      { type: "contracts", pattern: `${srcDir}/contracts/**`, mode: "file" },
      { type: "http-root", pattern: `${srcDir}/http/app.ts`, mode: "file" },
      { type: "http", pattern: `${srcDir}/http/**`, mode: "file" },
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
            allow: ["http", "http-root", "config", "lib", "db", "errors", "contracts"],
          },
          {
            from: "http-root",
            allow: [
              "http",
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
            from: "module-service",
            allow: [
              ["module-repository", { module: "${from.module}" }],
              ["module-policy", { module: "${from.module}" }],
              ["module-domain", { module: "${from.module}" }],
              ["module-mapper", { module: "${from.module}" }],
              ["module-index", { module: "!${from.module}" }],
              "ports",
              "errors",
              "lib",
              "contracts",
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
            allow: ["db", "config", "contracts", "errors"],
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
              ["module-service", { module: "${from.module}" }],
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

const rootConfigFiles = ["eslint.config.js", "commitlint.config.js"];

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
