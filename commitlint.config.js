export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [2, "always", ["api", "contracts", "repo", "ci", "deps"]],
  },
};
