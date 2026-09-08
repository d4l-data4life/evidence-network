# syntax=docker/dockerfile:1

# Multi-stage build for the Next.js (standalone) + Prisma 7 app.
# Prisma 7's Rust-free client ships no query-engine binary, so there are no
# musl/OpenSSL/binaryTargets concerns — a plain Debian-slim base is enough.
#
# Two runtime images come out of this file:
#   - `migrator`: full node_modules; runs `prisma migrate deploy` + seed once.
#   - `runner`  : slim Next.js standalone server (the long-running app).
# docker-compose runs `migrator` to completion before starting `runner`.

# ── deps: install node_modules ───────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Skip the postinstall `prisma generate` here (schema isn't copied yet); the
# builder stage runs it explicitly.
RUN npm ci --ignore-scripts

# ── builder: generate Prisma client + build Next.js ──────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── migrator: one-off migrations + seed ──────────────────────────────────────
# Keeps the full node_modules (Prisma CLI has a large hoisted dependency tree),
# so it is intentionally heavier than the runner. Run once, then it exits.
FROM node:22-slim AS migrator
WORKDIR /app
ENV NODE_ENV=production
# Prisma's schema engine (used by `migrate deploy`) links against OpenSSL;
# install it so it doesn't warn/guess about the libssl version.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
# The seed reads lib/deployment/profiles.json to initialise branding/i18n from
# the active deployment profile.
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint-migrate.sh ./docker-entrypoint-migrate.sh
RUN chmod +x docker-entrypoint-migrate.sh
ENTRYPOINT ["./docker-entrypoint-migrate.sh"]

# ── runner: minimal runtime image (default target) ───────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone server binds to localhost by default; bind to all
# interfaces so the container is reachable via the published port.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Run as an unprivileged user.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone server + static assets + public dir. Everything the app needs at
# runtime (incl. the traced Prisma client, pg, bcryptjs) is inside standalone.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
