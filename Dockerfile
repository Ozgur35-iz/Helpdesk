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
RUN bun --filter server db:generate
RUN bun run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3001
CMD ["bun", "run", "start"]
