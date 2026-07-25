import { plain } from "@adopta/eslint-config";

// This root config only covers files at the repo root (package.json
// scripts, this file, commitlint.config.js) plus acts as the lint-staged
// entry point. It intentionally excludes packages/** and apps/** — each
// workspace package owns its own eslint.config.js with
// `parserOptions.project` for type-checked linting, run via
// `pnpm -F <pkg> lint` / `turbo run lint`. Root config files aren't part of
// any tsconfig program, so they can't use type-checked rules.
export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
      "packages/**",
      "apps/**",
    ],
  },
  ...plain,
];
