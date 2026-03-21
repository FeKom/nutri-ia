FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Dependencies (all, for build) ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Production dependencies only ---
FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# --- Build ---
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- Production (distroless) ---
FROM gcr.io/distroless/nodejs20-debian12

WORKDIR /app

COPY --from=build /app/.mastra ./.mastra
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 4111

CMD [".mastra/output/index.mjs"]
