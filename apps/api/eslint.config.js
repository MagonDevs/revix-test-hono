import { base } from "@adopta/eslint-config";

export default [
  {
    ignores: [
      "dist/**",
      "eslint.config.js",
      "vitest.config.ts",
      "vitest.integration.config.ts",
      "drizzle.config.ts",
    ],
  },
  ...base,
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
