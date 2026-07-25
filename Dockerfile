# Multi-stage build for adopta-api — a single standalone package (no
# workspace, no separate `@adopta/contracts` package). `tsc` compiles
# everything under `src/`, including what used to be a separate contracts
# package (now `src/contracts/`, plain internal source), to `dist/`. The
# runtime stage runs the compiled output with plain `node` — no `tsx`
# needed, unlike the old workspace-era Dockerfile.
#
# The one wrinkle: `package.json`'s `imports` subpath (`#contracts` ->
# `./src/contracts/index.ts`) is written for dev/tsx/vitest, which all
# resolve TypeScript source directly. The compiled `dist/` tree has no
# `.ts` files, so that mapping is rewritten in the runtime stage to point
# at the built `./dist/contracts/index.js` before the image is finalized —
# a small build-time rewrite rather than reintroducing `tsx` at runtime.
#
# Docker is not reachable in the sandbox this refactor was done in, so this
# build has not been executed end-to-end — see docs/notes/ for the current
# "unverified-pending-Docker" list. It mirrors the package's real
# install/build/run commands and the rewrite step was checked locally
# against a `pnpm build` output (dist/contracts/index.js exists), but a
# real `docker build` + `docker compose up` run is still needed to confirm.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps: install everything (needed to run `tsc`, drizzle-kit, etc.) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build: typecheck + compile as the CI gate ----
FROM deps AS build
COPY . .
RUN pnpm build

# ---- prod-deps: production-only dependencies for the runtime image ----
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---- runtime: slim image, only what's needed to run migrate/seed/serve ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist

# Rewrite the `#contracts` imports mapping to point at the compiled output
# now that there's no `src/` in this image — see the header comment above.
RUN node -e "const fs=require('node:fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.imports['#contracts']='./dist/contracts/index.js';fs.writeFileSync('package.json', JSON.stringify(p, null, 2));"

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8787
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
