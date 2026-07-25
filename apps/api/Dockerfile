# Multi-stage build for @adopta/api — a pnpm workspace member that depends
# on @adopta/contracts (packages/contracts), so every stage that needs
# `pnpm install` or source needs the whole workspace, not just apps/api.
#
# NOTE (B9, unverified-pending-Docker — no daemon in this sandbox):
# @adopta/contracts and @adopta/api's own `./trpc` export both resolve to
# raw `.ts` source (see their package.json `exports`), not a compiled
# `dist`. `tsc -p tsconfig.json` compiles apps/api's own files but leaves
# `import ... from "@adopta/contracts"` as a bare specifier that Node
# cannot resolve to a `.ts` file at runtime. Rather than introduce a
# bundling step that isn't exercised anywhere else in this repo, the
# runtime stage runs the server through `tsx` (already a pinned
# devDependency), which transpiles on import — including transitive
# workspace-linked `.ts` files — exactly like `pnpm dev` does locally.
# This keeps `pnpm build`/`tsc` as the CI type-check gate while keeping
# the container's actual boot path identical to development.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /workspace

# ---- deps: install the full workspace (incl. devDependencies — tsx,
# drizzle-kit for migrations, etc. are needed at runtime/release-step) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/tsconfig/package.json ./packages/tsconfig/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
RUN pnpm install --frozen-lockfile

# ---- build: typecheck + compile as the CI gate; also copies full source
# for the runtime stage (tsx needs the .ts files, not just dist) ----
FROM deps AS build
COPY . .
RUN pnpm --filter @adopta/contracts build
RUN pnpm --filter @adopta/api build

# ---- runtime: slim image, only what's needed to run migrate/seed/serve ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /workspace

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/package.json /workspace/pnpm-workspace.yaml ./
COPY --from=build /workspace/packages ./packages
COPY --from=build /workspace/apps/api ./apps/api

WORKDIR /workspace/apps/api
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8787
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "--import", "tsx", "src/index.ts"]
