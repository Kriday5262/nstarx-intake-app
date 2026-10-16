# syntax=docker/dockerfile:1
# Multi-stage production build for NStarX Intake (Next.js 14 standalone).

FROM node:22-alpine AS build
WORKDIR /app

# Install build-time dependencies first so layers cache unless package files change.
COPY package.json package-lock.json ./
RUN npm ci

# Bring in the source and build the standalone server bundle.
COPY . .
RUN npm run build

# Runtime stage: minimal Node image. The node:22-alpine image already contains a
# `node` user with uid/gid 1000, which matches the host uid (kriday) so mounted
# exFAT directories are writable.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    TZ=Asia/Kolkata \
    PORT=8090 \
    HOSTNAME=0.0.0.0
WORKDIR /app

# Next.js standalone output only copies what it needs into .next/standalone.
# The static and traced dependencies live inside standalone/, so we can run the
# server from there and keep the container small.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

# Preserve drizzle migrations and the migration runner so the entrypoint can
# apply them at startup.
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build --chown=node:node /app/scripts/seed.js ./scripts/seed.js
COPY --from=build --chown=node:node /app/package.json ./package.json

# Carry the full node_modules so drizzle-kit (devDependency) is available for the
# migration step and all traced runtime packages are present.
COPY --from=build --chown=node:node /app/node_modules ./node_modules

COPY --chown=node:node docker-entrypoint.sh /app/docker-entrypoint.sh

USER node
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8090/login || exit 1

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
