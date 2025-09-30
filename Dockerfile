# Multi-stage build for Next.js app with Prisma on Node 20

FROM node:20-bookworm-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# Enable pnpm with corepack and pin the version from package.json
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@9.12.3 --activate \
  && pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build: prisma generate runs in postinstall; migrate is skipped at build if no DB URL
RUN corepack prepare pnpm@9.12.3 --activate \
  && pnpm build

FROM base AS runner
ENV PORT=3000
EXPOSE 3000
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
USER nextjs
WORKDIR /app
COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=build --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts

# Start: run prisma migrate deploy if DATABASE_URL/DIRECT_URL are present, then start Next
CMD ["sh", "-c", "node scripts/migrate-if-ready.mjs && next start -p 3000"]
