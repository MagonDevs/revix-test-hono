#!/bin/sh
# B9 — `docker compose up` from a clean checkout should migrate, seed
# (idempotently) and serve. Migrations run as a release step ahead of the
# server (architecture §8/§10 — never on boot from multiple replicas);
# this entrypoint is that release step for the single-container compose
# setup. Seeding is safe to re-run: `db:seed` without `--reset` only
# inserts scenario data via deterministic seeded ids/dates (build-plan B4),
# so a container restart against an already-seeded database is a no-op
# rather than a duplicate-data error.
set -e

echo "docker-entrypoint: running migrations..."
node --import tsx src/db/migrate.ts

echo "docker-entrypoint: seeding (scenario=${SEED_SCENARIO:-demo}, idempotent)..."
node --import tsx src/seed/index.ts --scenario="${SEED_SCENARIO:-demo}" --images="${SEED_IMAGE_MODE:-offline}" || true

echo "docker-entrypoint: starting server..."
exec "$@"
