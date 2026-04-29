FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl
RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY prisma/ ./prisma/

RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate
RUN pnpm --filter @voiceautomation/api build

# ---- Runtime ----
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl
RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/
COPY prisma/ ./prisma/

RUN pnpm install --frozen-lockfile --prod

# Copy generated Prisma client from builder
COPY --from=builder \
  /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma \
  ./node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma

COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
