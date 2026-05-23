# Remotion render service — isolates Chromium and the Remotion compositor
# so the lean API container stays browser-free.
#
# Base = Playwright image (Node 22 + Chromium + all required system libs).
# Remotion ships its own chrome-headless-shell binary but reuses the system
# libraries the Playwright image already provides — saves us from hand-
# curating the apt-deps list.

FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app

# pnpm matches the rest of the monorepo.
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Install deps with the workspace lockfile context. We copy just the
# manifests first so Docker layer-caches the install step.
COPY apps/render/package.json apps/render/tsconfig.json ./apps/render/
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
RUN pnpm install --filter @voiceautomation/render --frozen-lockfile=false --prod=false

# Then the source.
COPY apps/render/src ./apps/render/src

WORKDIR /app/apps/render
RUN pnpm build

ENV PORT=4600
ENV NODE_ENV=production
EXPOSE 4600
CMD ["node", "dist/server.js"]
