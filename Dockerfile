FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
# Regenerate the Prisma client for this (Linux) platform — the committed
# server/generated/prisma was generated on whatever OS last ran db:generate.
# `prisma generate` never connects to a database, but prisma.config.ts's
# env("DATABASE_URL") requires the var to be resolvable just to load the
# config — real env vars aren't injected at build time (only at container
# runtime), so a placeholder here is enough.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db"
RUN bun --filter server db:generate
RUN bun run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3001
CMD ["bun", "run", "start"]
