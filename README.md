# adopta-api

Backend for **Adopta**, a pet adoption platform. Built in phases per the
project's build plan. This is **B0**: the pnpm/Turborepo workspace scaffold
and the `@adopta/contracts` package, which is the source of truth binding
this backend and a separate web client team.

## Workspace layout

```
adopta-api/
├─ apps/api/            # not yet scaffolded — starts in B2
├─ packages/
│  ├─ contracts/        # @adopta/contracts — the API contract as code
│  ├─ tsconfig/         # shared strict tsconfig base
│  └─ eslint-config/     # shared flat ESLint config + apps/api boundaries
├─ docker-compose.yml   # postgres:16 (api service added in B2)
└─ turbo.json
```

## Getting started

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm validate` runs typecheck + lint + test across the workspace.

`db:migrate`, `db:seed`, `db:reset` are no-ops until `apps/api` exists
(B1/B4) — they're wired into `package.json` now so the script names are
stable for CI and contributors from day one.

## Governance

`packages/contracts` is the single source of truth for the API surface. Any
change to a schema, enum, constraint, procedure name or error code is a
change to that package: bump its version and add a `CHANGELOG.md` entry.
Never let the backend silently diverge from the contract.
