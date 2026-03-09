FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# Copy prisma schema BEFORE pnpm install so the postinstall prisma generate works
# Do NOT copy prisma.config.ts — it requires DATABASE_URL at load time, which isn't available during build
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod=false

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod=true && pnpm prisma generate --schema prisma/schema.prisma
COPY --from=build /app/dist ./dist

EXPOSE 8000
CMD ["node", "dist/src/main"]
