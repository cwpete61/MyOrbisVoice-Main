FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/voice-gateway/ ./apps/voice-gateway/
COPY prisma/ ./prisma/
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate
RUN pnpm --filter @voiceautomation/types build
RUN pnpm --filter @voiceautomation/config build
RUN pnpm --filter @voiceautomation/shared build
RUN pnpm --filter @voiceautomation/voice-gateway build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/voice-gateway/package.json ./apps/voice-gateway/
COPY prisma/ ./prisma/
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder \
  /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma \
  ./node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma
COPY --from=builder /app/packages/types/dist    ./packages/types/dist
COPY --from=builder /app/packages/config/dist   ./packages/config/dist
COPY --from=builder /app/packages/shared/dist   ./packages/shared/dist
COPY --from=builder /app/apps/voice-gateway/dist ./apps/voice-gateway/dist
COPY --from=builder /app/apps/voice-gateway/widget ./apps/voice-gateway/widget
EXPOSE 5000
CMD ["node", "apps/voice-gateway/dist/index.js"]
