#!/bin/sh
set -e

# One-off migrate + seed step (the `migrate` compose service). Runs to
# completion and exits; the app service waits for it via
# depends_on: condition: service_completed_successfully.
#
# The Prisma CLI is invoked via its JS entry directly — node_modules/.bin
# symlink shims don't survive being COPYd between build stages.

echo "▶ Applying database migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "▶ Seeding demo user..."
node prisma/seed.mjs

echo "✔ Migrate + seed complete."
