---
name: run-myorbisvoice
description: Build, launch, and drive the MyOrbisVoice app locally. Use when asked to run / start / launch / serve / screenshot / drive / smoke-test the MyOrbisVoice web app, partner portal, dashboard, admin, or API on a dev machine.
---

# Run MyOrbisVoice (local)

MyOrbisVoice is a multi-tenant voice-automation SaaS. Locally it runs as three
pieces: **PostgreSQL + Redis** (docker), the **API** (Express, `apps/api`, port
4000), and the **web app** (Next.js, `apps/web`, port 3000 — partner portal,
tenant dashboard, admin). The interactive surface is the web app; drive it with
the committed Playwright driver `.claude/skills/run-myorbisvoice/driver.mjs`
(headless Chromium → login flow → screenshots).

All paths below are relative to the repo root (`<unit>` = repo root).

## Prerequisites

```bash
node -v   # v20.x
pnpm -v   # 9.x
docker ps # postgres + redis must be reachable (containers: umoja-postgres, umoja-redis)
# One-time: Chromium for the driver (installed under apps/api):
pnpm --filter @voiceautomation/api exec playwright install chromium
```

## Build / setup

```bash
pnpm install
# Sync the dev DB schema + generate the Prisma client. The local dev DB carries
# unrelated drift, so the push needs --accept-data-loss (LOCAL DEV ONLY — never prod):
pnpm exec prisma db push --schema=prisma/schema.prisma --accept-data-loss --skip-generate
pnpm exec prisma generate --schema=prisma/schema.prisma
```

## Run (agent path)

Start the API and web dev servers, seed a demo partner, then drive the web app.

```bash
# 1. API (port 4000) — tsx watch, ~15s to boot. Confirm health:
( cd apps/api && pnpm dev > /tmp/run-api.log 2>&1 & )
until [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/health)" = 200 ]; do sleep 2; done

# 2. Web (port 3000) — MUST point at the LOCAL api or it calls prod:
( cd apps/web && NEXT_PUBLIC_API_URL=http://localhost:4000 pnpm dev > /tmp/run-web.log 2>&1 & )
until [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/partner-portal/login)" = 200 ]; do sleep 3; done

# 3. Seed a demo partner to log in as (idempotent):
node .claude/skills/run-myorbisvoice/seed-demo.mjs
#    → gmb-demo@local.test / Demo1234!

# 4. Drive: login flow + screenshots into /tmp/run-myorbisvoice/
node .claude/skills/run-myorbisvoice/driver.mjs
#    01-login.png · 02-after-login.png (→ /partner-portal/dashboard) · 03-gbp-audit.png · 04-market-vault.png

# Or just screenshot one URL (no login):
node .claude/skills/run-myorbisvoice/driver.mjs http://localhost:3000/partner-portal/login
#    → /tmp/run-myorbisvoice/page.png
```

The driver resolves Playwright from `apps/api` and accepts env overrides:
`WEB_URL` (default `http://localhost:3000`), `LOGIN_EMAIL`, `LOGIN_PASSWORD`.

## Run (human path)

`cd apps/web && pnpm dev` then open `http://localhost:3000` in a browser — but
headless this is useless; use the driver. The web dev server defaults to the
**prod** API (`NEXT_PUBLIC_API_URL` in `apps/web/.env.local`), so always export
`NEXT_PUBLIC_API_URL=http://localhost:4000` for a local-only run.

## Test

```bash
pnpm --filter @voiceautomation/api build   # tsc, zero errors expected
pnpm --filter @voiceautomation/web build   # next build
pnpm i18n:check:keys                        # en/es dictionary parity
```

## Gotchas

- **Web silently hits prod API.** `apps/web/.env.local` sets
  `NEXT_PUBLIC_API_URL=https://api.myorbisvoice.com`. Without the inline
  `NEXT_PUBLIC_API_URL=http://localhost:4000` override, your local web logs you
  into **production**. Always set it.
- **The login page lives under `/partner-portal/login`.** A naive
  `waitForURL('**/partner-portal/**')` matches it instantly — wait for the URL
  to *leave* `/login` (the driver does `waitForURL(u => !u.includes('/login'))`).
- **Playwright is a dep of `apps/api`, not the root.** A bare `import 'playwright'`
  from elsewhere won't resolve; the driver uses `createRequire` against
  `apps/api/package.json`.
- **`prisma db push` warns data-loss on the local dev DB** (a pending
  `TenantA2PApplication.partnerId` unique constraint + drifted columns unrelated
  to your change). `--accept-data-loss` is safe **locally**; never on prod.
- **`google-chrome` is present but `chromium-cli` is not** — use the Playwright
  driver, not a chromium-cli heredoc.
- **Deploys are separate.** `./infrastructure/scripts/deploy.sh [api|web|all]`
  ships to the live Contabo box — not part of local run.

## Troubleshooting

- **Driver: "no redirect — login may have failed"** → the demo partner isn't
  seeded or the API is down. Re-run `seed-demo.mjs`; confirm
  `curl localhost:4000/health` = 200.
- **API won't boot / `prisma.X` undefined** → run `pnpm exec prisma generate`.
- **Web build type error in an unrelated file** → likely two `next build`s racing
  on `apps/web/.next`; run one at a time.
