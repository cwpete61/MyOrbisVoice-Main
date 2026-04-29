FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN pnpm install --frozen-lockfile

ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=https://api.myorbisvoice.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @voiceautomation/web build

# ---- Runtime ----
FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/web/.next ./apps/web/.next

ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["pnpm", "--filter", "@voiceautomation/web", "start"]
