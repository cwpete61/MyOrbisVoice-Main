# MyOrbis Per-App Hardening Baseline

**The standard every MyOrbis app must meet.** A container/app is "compliant" only when all eight controls below are green. This is the bar the storefront-api was raised to post-breach — it must apply to every sibling.

## The eight controls
1. **Non-root runtime** — Dockerfile declares a non-root `USER`; `docker exec … id` returns uid ≠ 0.
2. **Runtime containment** — `cap_drop:[ALL]` (re-add only what's needed), `security_opt:["no-new-privileges:true"]`, `read_only:true` rootfs with explicit tmpfs for the minimal writable set (no writable `/var/tmp`).
3. **Patched + pinned deps** — no advisory ≥ High in the committed lockfile; framework past all known-RCE lines (Next.js ≥ patched train); CI builds with `--frozen-lockfile` (no `|| install` / `--frozen-lockfile=false` fallback); non-registry deps pinned to an immutable SHA/signed tag.
4. **Env via `--env-file` (no committed secrets)** — runtime config injected from a server-side `.env.prod`/secrets store; no `.env*` with secret material tracked in git; only `NEXT_PUBLIC_*`/placeholders may be committed.
5. **Egress allowlist** — outbound only to known provider hosts; databases/Redis/internal services reached over the isolated docker network, never the public interface.
6. **Rotated secrets** — any secret exposed in (or implicated by) the breach rotated; shared long-lived god-tokens replaced with short-lived, scope-limited credentials.
7. **Security headers** — HSTS + CSP + X-Frame-Options/frame-ancestors + X-Content-Type-Options + Referrer-Policy + Permissions-Policy at the edge; `x-powered-by`/framework fingerprints stripped.
8. **Internal-only datastores** — Postgres/Redis/Keycloak/hub-api bound to loopback or the internal docker network; reached publicly only through the authenticated reverse proxy.

## Per-app compliance matrix (current state, from this audit)

Legend: ✅ meets · ❌ gap (open finding) · N/A not applicable

| App / container | 1 Non-root | 2 Containment | 3 Deps patched/pinned | 4 Env-file / no committed secret | 5 Egress/net | 6 Secrets rotated | 7 Sec headers | 8 DB internal-only |
|---|---|---|---|---|---|---|---|---|
| **storefront-api** (products) | ✅ uid=1000 | ❌ | ❌ lockfile pins 15.1.6 (P0-3); `\|\|install` (P1-7) | ✅ | ✅ | ❌ HUB token (P0-6/P1-4) | ❌ (P1-3) | ✅ |
| **myorbisvoice-web** (app) | ❌ (P1-2) | ❌ | ❌ next 15.5.18→.21; postcss (P1-1) | ❌ .env.production tracked (P2-8) | ✅ | N/A | ❌ (P1-3) | ✅ |
| **myorbisvoice-api** | ❌ (P1-2) | ❌ | ❌ axios/undici/tar/xlsx/multer/form-data/nodemailer (P1-1) | ✅ | ✅ | ❌ HUB token (P1-4) | ✅ helmet set | ✅ |
| **myorbisvoice-gateway** | ❌ (P1-2) | ❌ | ❌ ws/undici/tar (P1-1) | ✅ | ✅ | N/A | N/A (wss) | ✅ |
| **myorbisvoice-render / pdf-render** | ❌ (P1-2) | ❌ | ❌ node-tar (P1-1) | ✅ | ✅ | N/A | N/A | ✅ |
| **myorbisvoice-leadengine** | ✅ leadengine | ❌ | ❌ Perl base (P2-5) | ✅ | ✅ internal | N/A | N/A | ✅ |
| **myorbis-hub-api** | ❌ (P1-2) | ❌ | — | ✅ | ✅ 127.0.0.1:4100 | ❌ HUB token (P0-6/P1-4) | ❌ (P1-3) | ✅ |
| **myorbisbiz-app** | ❌ (P1-2) | ❌ | ❌ next 16.2.9→.11; postcss (P1-1) | ✅ | ❌ CF origin bypass (P0-4) | ❌ admin token (P0-6/P1-5) | ⚠️ has HSTS/XFO/nosniff, no CSP (P2/register 35) | ✅ |
| **myorbis-reviews-web** | ❌ (P1-2) | ❌ | ❌ Alpine base; vite; xlsx (P1-1/P1-6) | ✅ | ✅ 127.0.0.1:4400 | N/A | ❌ (P1-3) | ✅ |
| **myorbis-reviews-api** | ❌ | ❌ | ⚠️ not scanned (gap) | ✅ | ✅ 127.0.0.1:4200 | N/A | N/A | ✅ |
| **edge-caddy** (box2 edge) | ❌ root, 0.0.0.0 (P1-2) | ❌ (P2-1) | N/A image | ✅ | ✅ (is the edge) | N/A | ❌ apply snippet (P1-3) | N/A |
| **myorbis-content-engine** | ❌ (P1-2) | ❌ | ✅ 0 vulns (not deployed) | ⚠️ real keys in local .env, gitignored (P2-9) | N/A | — | ❌ dashboard no auth (P2-6) | N/A |
| **Keycloak** (myorbis-id) | ✅ 1000 | ❌ | — | ✅ | ✅ 127.0.0.1 | — | ❌ realm auth hardening (P0-1/2) | ✅ |
| **postgres / redis (all)** | ❌ root | ❌ | ⚠️ images not Trivy-scanned (gap) | ✅ | ✅ internal-only | N/A | N/A | ✅ |
| **n8n + worker** | ✅ node | ❌ | — | ✅ | ✅ double-locked | — | ✅ 401 Basic | ✅ |

## What's already right (keep it)
- **Network hygiene (control 8): fully green fleet-wide.** Only edge-caddy binds 0.0.0.0; every Postgres/Redis/Keycloak/hub-api/storefront-api/reviews service is loopback or internal-docker-network. n8n double-lock intact.
- **Breach remediation confirmed:** storefront-api non-root (uid=1000) + live Next.js 15.5.22; all public Next.js past the CVE-2025-29927 RCE window.
- **App-layer controls verified clean:** webhook signature validation (Stripe/Twilio fail-closed, HMAC+timingSafeEqual), no exec/eval/raw-SQL injection sinks, GCM auth-tag enforced, RBAC server/UI parity holds, no committed real secrets in any repo or its git history.

## Biggest systemic gaps (every app fails these until the plan lands)
- **Control 2 (runtime containment): 0/21 containers compliant** — no cap-drop, no no-new-privileges, no read-only rootfs, writable `/var/tmp` everywhere. This is the single most repeated failure and the breach's persistence enabler (→ P1-2 non-root, P2-1 containment).
- **Control 1 (non-root): only 4 of ~14 app containers compliant.**
- **Control 7 (headers): only the API and (partly) myorbisbiz pass.**