# MyOrbisResults Family — Vulnerability Register

Deduped from 53 raw scanner findings to 36 ranked findings. Ranking = severity × exploitability × exposure, with **internet-facing outranking internal outranking local/build-only**. Where two scanners reported the same underlying issue (e.g. edge-net + live-web on missing headers; container + sast + supply-chain on root containers; sca + Trivy on tar/undici), findings are merged and the corroboration noted.

## Ranked summary table

| Rank | Sev | App / surface | Class | Title | Exposure | CVE / advisory | Location |
|---|---|---|---|---|---|---|---|
| 1 | Critical | Keycloak realm `myorbis` | Broken auth / brute-force | `myorbis-apps` ROPC on + realm brute-force OFF + no password policy | internet | — | auth.myorbisresults.com client `myorbis-apps` |
| 2 | Critical | storefront (products.myorbisresults.com) | SCA / RCE | Committed lockfile still pins breached `next@15.1.6` | internet (latent on rebuild) | CVE-2025-29927, GHSA-9qr9-h5gf-34mp (10.0), GHSA-c4j6-fc7j-m34r | sf-repo/pnpm-lock.yaml:15 (HEAD 61fe138) |
| 3 | High | myorbisbiz / box2 edge-caddy | Edge / CDN-origin bypass | Cloudflare origin reachable by direct box2 IP (WAF/rate-limit/HSTS stripped) | internet | — | 109.123.249.34:443, /opt/edge/conf.d/myorbisbiz.caddy |
| 4 | High | Keycloak realm `myorbis` | OAuth open-redirect / CORS | `myorbis-apps` wildcard `*` redirect URI + wildcard `*` Web Origins | internet | — | redirect_uris / web_origins tables |
| 5 | High | voice-web, myorbisbiz-app, edge-caddy | Container hardening | Internet-facing Next.js + edge proxy run as **root**, writable rootfs, no cap-drop / no-new-privileges | internet | — | box1 myorbisvoice-web; box2 myorbisbiz-app, edge-caddy |
| 6 | High | voice-api (box1) | SCA | axios 1.15.2 — SSRF + credential/data leak (client for Stripe/Twilio/Google) | internet | GHSA-35jp-ww65-95wh (8.7), GHSA-pjwm-pj3p-43mv (8.6) | root pnpm-lock.yaml (transitive) |
| 7 | High | voice-api + gateway | SCA / container | undici 7.26.0 — MITM via ignored TLS w/ SOCKS5, info-disclosure, WS unbounded-memory DoS | internet | CVE-2026-9697, CVE-2026-6734, CVE-2026-12151 | undici@7.26.0 |
| 8 | High | hub, storefront, reviews, render + voice api/gateway/web | SCA / container | node-tar gzip-bomb DoS + path-traversal/arbitrary-file-write chain | internet | CVE-2026-59873 (crit, fix 7.5.19), CVE-2026-24842/26960/29786/31802; tar 6.2.1 GHSA-23hp-3jrh-7fpw (9.2) | tar 7.5.11 / 7.4.3 / 6.2.1 |
| 9 | High | voice-web, myorbisbiz | SCA | Next.js patch bumps — CVSS 8.3 RSC/cache disclosure & DoS | internet | GHSA-89xv-2m56-2m9x, GHSA-p9j2-gv94-2wf4 (8.3), GHSA-m99w-x7hq-7vfj (8.2) | voice-web 15.5.18→15.5.21; biz 16.2.9→16.2.11 |
| 10 | High | voice-api + reviews-web | SCA | xlsx (SheetJS) prototype pollution + ReDoS — **no npm-registry fix** | internet | GHSA-4r6h-8v6p-xvw6 (7.8), GHSA-5pgg-2g8v-p4x9 (7.5), CVE-2023-30533, CVE-2024-22363 | api xlsx 0.20.3 (CDN tgz); reviews xlsx ^0.18.5 |
| 11 | High | voice-api / gateway | SCA | form-data 4.0.5 + multer 2.1.1 (upload DoS) + nodemailer 8.0.x; ws 8.20 WS DoS | internet | GHSA-hmw2-7cc7-3qxx (8.7), GHSA-72gw-mp4g-v24j (7.5), GHSA-p6gq-j5cr-w38f (7.1), GHSA-96hv-2xvq-fx4p (7.5) | root pnpm-lock.yaml; multer direct apps/api/package.json:37 |
| 12 | High | voice-api/gateway/render/pdf-render, hub-api, reviews-api, content-engine | SAST / container | Backend Node services run as root — no `USER` in Dockerfile (RCE→root amplifier) | internal / internet | CWE-250 | apps/api Dockerfile:46, web:34, voice-gateway:36, pdf-render:13, render:31; content-engine:24 |
| 13 | High | storefront | Supply chain | `@myorbis/hub-client` installed `github:cwpete61/myorbis-shared` with **no ref** (tracks HEAD) | internet | — | sf-repo/package.json:12, Dockerfile `... || pnpm install` |
| 14 | High | reviews-web (box2) | Vulnerable base image | Stale Alpine — OpenSSL heap-UAF (PKCS7_verify), libcurl SMB/cookie leak, Go stdlib DoS/symlink | internet | CVE-2026-45447, CVE-2026-5773, CVE-2026-6276, CVE-2026-27145, CVE-2026-39822 | myorbis-reviews-web:latest (caddy gobinary/Alpine) |
| 15 | High | myorbisbiz, voice-web, storefront | SCA | postcss <8.5.18 — CSS-parser line-return DoS (ships in every front-end image) | internal (build) | GHSA-r28c-9q8g-f849 (7.5), GHSA-6g55-p6wh-862q (7.5) | postcss 8.4.31 / 8.5.10–8.5.15 |
| 16 | High | reviews-web | SCA | vite 5.4.21 dev-server file-serving flaw; vite/react a major behind | internal (dev only) | GHSA-fx2h-pf6j-xcff (8.2) | MyOrbisReviews/package-lock.json |
| 17 | Medium | storefront + voice-api (Hub) | Over-privileged shared credential | Omnipotent `HUB_SERVICE_TOKEN` — single long-lived bearer = full cross-tenant read/write (**the secret leaked in the breach**) | internal | CWE-798/CWE-522 | hub-sync.service.ts:35, sf dashboard routes |
| 18 | Medium | myorbisbiz | Timing side-channel / weak session | Admin API gated by static token compared with `===` (non-constant-time); raw token IS the session cookie | internet | CWE-208 / CWE-522 | myorbisbiz/src/lib/admin-auth.ts:13,24 |
| 19 | Medium | voice-web | Insecure token storage | Access + refresh tokens in `localStorage` — XSS = long-lived account takeover | internet | — | apps/web/src/lib/auth.ts:3-24 |
| 20 | Medium | app.myorbisvoice.com | Missing security headers | Authenticated tenant/admin dashboard serves NO HSTS/CSP/XFO/nosniff/Referrer/Permissions; leaks x-powered-by (edge-net + live-web both confirm) | internet | — | Caddy block /opt/bps_zf/caddy/Caddyfile → myorbisvoice-web:3000 |
| 21 | Medium | products.myorbisresults.com | Missing security headers | Previously-cryptojacked storefront (no Cloudflare) serves no HSTS/CSP/XFO; x-powered-by on the exact RCE'd stack | internet | — | /opt/edge/conf.d/products.caddy → storefront-api:4300 |
| 22 | Medium | storefront, content-engine, reviews, render | Install integrity | Dockerfile `|| pnpm install` / `npm ci || npm install` / `--frozen-lockfile=false` fallbacks defeat lockfile pinning | internet | — | sf/content-engine/MyOrbisReviews/apps/render Dockerfiles |
| 23 | Medium | leadengine (box1) | Vulnerable base image | Perl stack — IO-Compress arbitrary code exec + Archive-Tar (no upstream fix); internal-only | internal | CVE-2026-48962, CVE-2026-42497, CVE-2026-9538 | myorbisvoice-leadengine:latest |
| 24 | Medium | all 21 containers (both boxes) | Container hardening | No cap-drop, no no-new-privileges, no read-only rootfs; writable `/var/tmp` everywhere = the miner drop path | internal | — | box1+box2 docker inspect (universal) |
| 25 | Low | voice-web | Stored XSS | Partner/admin-authored HTML via `dangerouslySetInnerHTML`, no sanitizer | internet | CWE-79 | script-popup/[id]/page.tsx:73; admin/agent-demos/page.tsx:187 |
| 26 | Low | myorbisbiz | HTML/email injection | Unsanitized DB fields interpolated into owner notification-email HTML | internet | CWE-79/116 | src/app/api/orby/lead/route.ts:49-51 |
| 27 | Low | content-engine | Missing auth | Dashboard HTTP server routes on `req.url` with no auth gate (not yet deployed) | local | CWE-306 | src/server/dashboard.ts:69 |
| 28 | Low | voice-web | Committed env file | `apps/web/.env.production` tracked (only NEXT_PUBLIC_* today; prospective secret-leak pattern) | internal | — | apps/web/.env.production |
| 29 | Low | Keycloak realm `myorbis` | Weak password policy | `realm.password_policy` empty — no length/complexity/breached-password check | internet | — | realm `myorbis` |
| 30 | Low | voice-web (SSO logout) | Session management | Best-effort back-channel logout: revoke failure clears local tokens only, KC SSO session survives (silent re-login) | internet | — | apps/web/src/lib/auth.ts:46-57 |
| 31 | Low | reviews, hub-api, myorbisvoice.com, myorbisagents.com | Missing security headers / info-disclosure | Public non-authenticated hosts missing HSTS/CSP/XFO; x-powered-by / X-Turbo-Charged-By fingerprints; agents returns ACAO:* on HTML | internet | — | reviews/hub Caddy blocks; CF edges |
| 32 | Critical (sev) / low priority | voice monorepo build tooling | SCA | turbo 2.9.6 — CVSS 9.8, but devDependency, **not in runtime images** | local (build/CI only) | GHSA-3qcw-2rhx-2726 (9.8) | root pnpm-lock.yaml turbo@2.9.6 (fix 2.9.14) |
| 33 | Info | content-engine (+ voice) local `.env` | Secrets at rest | Real OpenAI/Gemini/DataForSEO/LocationIQ keys in gitignored workstation `.env` (NOT committed) | local | — | myorbis-content-engine/.env |
| 34 | Info | Keycloak realm `myorbis` | Default client hardening | Stock `admin-cli` public client has direct-access-grants on (another ROPC target with brute-force off) | internet | — | client `admin-cli` |
| 35 | Info | myorbisbiz.com | Missing header | Best-configured public app (HSTS/XFO/nosniff/Referrer/Permissions all present) but no CSP; x-powered-by leaks | internet | — | myorbisbiz.com |

*(node-tar critical-severity CVE-2026-59873 is carried inside rank 8; turbo's critical CVSS is rank 32 — both are critical **severity**, deliberately low **priority** by exposure. This is why the severity count shows 4 criticals but only ranks 1–2 are P0.)*

---

## Per-finding detail + remediation

### 1 — [CRITICAL] Keycloak `myorbis-apps`: ROPC on, brute-force off, no password policy
**Exposure:** internet. **Class:** broken authentication / credential brute-force.
Client row: `public_client=t, direct_access_grants_enabled=t, has_secret=f`. Realm: `bruteForceProtected=false, permanentLockout=false, maxTemporaryLockouts=0`, empty password policy. `POST /realms/myorbis/protocol/openid-connect/token grant_type=password&client_id=myorbis-apps` is accepted with **no client secret and no IdP lockout**. All Voice users were migrated in (bcrypt SPI), so every account is brute-forceable at the IdP, bypassing the app's own login rate limiting.
**Remediation:** Disable *Direct access grants* on `myorbis-apps` (the SPA uses auth-code + PKCE S256, so ROPC is unused). Enable realm Brute Force Detection with a sane failureFactor/lockout. Set a password policy (`length(12)`, `notUsername`, HaveIBeenPwned check if available). Also disable direct grants on the stock `admin-cli` (finding 34). Verify with `kcadm get clients` + realm brute-force settings after change.
**Gap:** asserted from backing-DB config; the ROPC endpoint was NOT exercised live (would be an auth attempt, out of scope).

### 2 — [CRITICAL] Storefront committed lockfile still pins breached `next@15.1.6`
**Exposure:** internet (latent — fires on next rebuild). 
`git show HEAD:package.json = next 15.5.22` but `HEAD:pnpm-lock.yaml` importer still shows `next: specifier 15.1.6, version 15.1.6`. The "patch Next.js RCE window" commit 61fe138 touched Dockerfile + package.json, **0 lines of the lockfile**. osv-scan of the committed lockfile reports next@15.1.6 with 31 advisories incl. two criticals (GHSA-9qr9-h5gf-34mp CVSS 10.0 fixed 15.1.9; CVE-2025-29927 fixed 15.2.3). Any `--frozen-lockfile` rebuild reinstalls the exact version that was RCE'd and cryptojacked. The LIVE container is currently on 15.5.22 (breach remediation confirmed) — this is a re-breach-on-deploy trap, not a live vuln.
**Remediation:** `pnpm install --lockfile-only` so next resolves ≥15.5.16 (clears all High/Critical), commit the regenerated lockfile, rebuild+redeploy, confirm the running container's next version. Enforce CI `--frozen-lockfile` so a package.json/lockfile mismatch **fails** the build (this also fixes finding 22 for the storefront).

### 3 — [HIGH] Cloudflare origin bypass on box2
`curl --resolve myorbisbiz.com:443:109.123.249.34` returns HTTP/2 200 with `x-powered-by: Next.js` and **no cf-ray** — origin serves the CF-fronted site directly. edge-caddy publishes 0.0.0.0:80/443 and terminates TLS with no Cloudflare-IP allowlist / no Authenticated Origin Pulls. Anyone who knows the origin IP reaches the app with WAF, rate-limiting, HSTS injection, and bot rules stripped — on the box that was cryptojacked weeks earlier.
**Remediation:** Restrict origin :443 to Cloudflare CIDRs at the host firewall (ufw/iptables) OR enable Authenticated Origin Pulls and require the CF client cert in Caddy. Rotate the origin IP if it has leaked. Applies to every CF-fronted host whose origin is this box.

### 4 — [HIGH] Keycloak `myorbis-apps` wildcard redirect URI + wildcard Web Origins
`redirect_uris → '*'`, `web_origins → '*'` on a public client. OAuth 2.0 Security BCP forbids wildcard redirect URIs (any URL is an acceptable authorization-response target → phishing/token redirection); wildcard Web Origins lets any site make credentialed CORS calls to token/userinfo. PKCE S256 reduces but does not eliminate this (does not constrain redirect_uri, does not apply to ROPC).
**Remediation:** Replace `*` redirect_uris with the exact callback(s) (e.g. `https://products.myorbisresults.com/auth/callback`), replace `*` web_origins with explicit origins — mirror the sibling confidential clients (`myorbis-voice`/`myorbis-dashboard`/`myorbis-agents`) which already use exact HTTPS callbacks + secrets.

### 5 — [HIGH] Internet-facing Next.js + edge proxy run as root, writable rootfs, no cap-drop
`docker exec` confirmed uid=0 for `myorbisvoice-web`, `myorbisbiz-app`, `edge-caddy`; all have `User=[], ReadonlyRootfs=false, CapDrop=[], SecurityOpt=[]`, `/var/tmp` writable. edge-caddy is the **single** internet-facing process for all MyOrbis hosts (only 0.0.0.0 binder). This is the exact defense-in-depth gap that let the storefront miner persist — Next.js is currently patched so the known RCE is closed, but any future Next/Node RCE lands as uid=0 with a writable FS for persistence.
**Remediation:** `USER node`/non-root in each image (as storefront-api already does post-breach); `ReadonlyRootfs=true` + tmpfs `/tmp` + writable volume only for `.next/cache` (web) / `/data`+`/config` (caddy); `security_opt:[no-new-privileges:true]`, `cap_drop:[ALL]`; caddy re-adds only `NET_BIND_SERVICE` (or bind high ports + host redirect).

### 6 — [HIGH] axios 1.15.2 — SSRF + data leak (voice-api)
osv-scan: 18 advisory hits, top CVSS 8.7. Pulled transitively (2 dependents) into the API service making Stripe/Twilio/Google outbound calls. Fix ≥1.18.0.
**Remediation:** pnpm `overrides` pinning axios ≥1.18.0 in root package.json; regenerate lockfile; rebuild api + gateway.

### 7 — [HIGH] undici 7.26.0 — MITM / info-disclosure / DoS (voice-api + gateway)
Corroborated by osv-scan (sca) and Trivy (container). CVE-2026-9697 (MITM via ignored TLS options with SOCKS5 proxy), CVE-2026-6734 (info disclosure via incorrect Socks5ProxyAgent), CVE-2026-12151 (WebSocket unbounded-memory DoS). undici is the API's outbound fetch impl for provider calls — MITM/info-disclosure directly relevant.
**Remediation:** override undici ≥7.28.0 (or 8.5.0); regenerate lockfile; rebuild api + gateway.

### 8 — [HIGH] node-tar / tar — gzip-bomb DoS + path-traversal/arbitrary-file-write
Trivy CRITICAL: `tar CVE-2026-59873 installed=7.5.11 fixed=7.5.19` (gzip bomb) in hub/storefront/reviews/render (render at 7.4.3). HIGH node-tar in api/gateway/web/render: CVE-2026-24842 (arbitrary file create), CVE-2026-26960 (read/write via hardlink), CVE-2026-29786 (hardlink traversal), CVE-2026-31802 (symlink overwrite). osv-scan separately flags tar 6.2.1 (12 advisories, CVSS 9.2) in the voice monorepo. **Combined with root + writable rootfs (finding 5/12/24) the path-traversal-write CVEs become a real host-write primitive.**
**Remediation:** pin node-tar/tar ≥7.5.19 via pnpm overrides across all services; regenerate lockfiles; rebuild images. Verify no runtime path extracts attacker-influenced archives (if none, this drops to a supply-chain surface concern).

### 9 — [HIGH] Next.js CVSS 8.3 patch bumps (voice-web, myorbisbiz)
voice-web 15.5.18 → 8 advisories fixed 15.5.21; myorbisbiz 16.2.9 → 9 advisories (three 8.3) fixed 16.2.11. RSC/cache/image-optimizer disclosure & DoS. Both are already past the breached 15.1.6 line — patch bumps only.
**Remediation:** bump next (voice-web ≥15.5.21, biz ≥16.2.11), regenerate lockfiles, rebuild/redeploy.

### 10 — [HIGH] xlsx (SheetJS) prototype pollution + ReDoS — no npm-registry fix
osv-scan reports fixed-version `--` for both advisories on both pins: voice-api xlsx 0.20.3 (CDN tgz) and reviews xlsx ^0.18.5 (the last npm-published SheetJS, carrying CVE-2023-30533 + CVE-2024-22363). Fixes exist only in SheetJS CDN latest. If either service parses a user-uploaded .xlsx, a crafted file can pollute Object.prototype or hang the event loop; the reviews SPA parses user spreadsheets client-side.
**Remediation:** move to the SheetJS CDN latest build (`cdn.sheetjs.com/xlsx-latest`) with recorded version+SRI hash, or replace with a maintained parser (exceljs); size/time-bound workbook parsing. Because SheetJS bypasses the npm registry, treat cdn.sheetjs.com as an explicit trusted source and monitor its security releases manually (they never surface in `pnpm audit`).

### 11 — [HIGH] form-data 4.0.5 + multer 2.1.1 + nodemailer 8.0.x + ws 8.20 (voice-api / gateway)
osv-scan: multer (direct dep, file uploads) DoS on malformed multipart (fix 2.2.0); form-data predictable boundaries (fix 4.0.6); nodemailer (fix 9.0.1); ws 8.20.0/8.20.1 crafted-frame DoS on the public wss gateway (fix 8.21.0).
**Remediation:** bump multer ≥2.2.0, form-data ≥4.0.6, nodemailer ≥9.0.1, ws ≥8.21.0 via package.json/overrides; regenerate lockfile; rebuild api + gateway.

### 12 — [HIGH] Backend Node services run as root (no `USER` in Dockerfile)
Semgrep missing-user on 5 voice Dockerfiles + manual confirm on biz/content-engine; `docker exec` uid=0 on voice-api/gateway/render/hub-api/reviews-api. hub-api holds the shared service token implicated in the breach and runs as root on 127.0.0.1:4100. content-engine additionally runs `npx prisma db push` at boot as root. Root cause of finding 5's runtime state.
**Remediation:** add `RUN addgroup -S app && adduser -S app -G app` + `USER app` before CMD in every runtime stage (chown writable dirs); for Chromium services (render/pdf-render) run the browser unprivileged + seccomp. Prioritize hub-api. lead-engine (`USER leadengine`) and post-breach storefront (`USER node`) already show the correct pattern — apply uniformly.

### 13 — [HIGH] `@myorbis/hub-client` from `github:` with no ref
`sf-repo/package.json:12` specifier carries no commit/tag, so it tracks default-branch HEAD; lockfile pins 67324f5 today but Dockerfile `pnpm install --frozen-lockfile || pnpm install` re-resolves HEAD on any drift. GitHub tarballs have no npm provenance/signing — account takeover of cwpete61 or one malicious push = arbitrary code in every storefront build.
**Remediation:** pin to an immutable ref (`github:cwpete61/myorbis-shared#<full-sha>` or signed tag); better, publish to a private registry (GitHub Packages/Verdaccio) as a versioned semver dep with integrity. Remove the `|| pnpm install` fallback. Enable 2FA + branch protection + required review on the shared repo.
**Gap:** the tarball contents were NOT fetched/inspected, so an install-script payload can be neither confirmed nor ruled out — flagged on provenance risk.

### 14 — [HIGH] reviews-web stale Alpine base image
Trivy 5 HIGH: libssl3 3.5.6-r0 → CVE-2026-45447 (OpenSSL PKCS7_verify heap UAF, fix 3.5.7-r0); libcurl 8.19.0-r0 → CVE-2026-5773 (SMB mis-transfer) + CVE-2026-6276 (cookie leak, fix 8.20.0-r0); Go stdlib 1.26.3 → CVE-2026-27145/39822/42504; x/text 0.37.0 → CVE-2026-56852.
**Remediation:** rebuild on current caddy:2/Alpine (libssl3 ≥3.5.7-r0, libcurl ≥8.20.0-r0, Go ≥1.26.4, x/text ≥0.39.0).

### 15 — [HIGH] postcss <8.5.18 (biz, voice, storefront)
osv-scan flags postcss 8.4.31 / 8.5.10–8.5.15 across three repos (CVSS 7.5 CSS-parser DoS). Build-time, but ships in every front-end image.
**Remediation:** override postcss ≥8.5.18 in each repo; regenerate lockfiles; rebuild web images.

### 16 — [HIGH] vite 5.4.21 dev-server (reviews)
3 advisories, top 8.2, fixed 6.4.2/6.4.3. vite is a devDependency; the reviews SPA ships as a static caddy-served dist, so the dev-server flaw is **not** exposed in prod. Staleness note: vite a full major behind, react 18 vs 19 elsewhere.
**Remediation:** upgrade vite ≥6.4.3 (dev) + regenerate lockfile; plan react 18→19 alignment. Lower real risk given dev-only exposure.

### 17 — [MEDIUM] Omnipotent `HUB_SERVICE_TOKEN`
Every storefront server route and voice-api hub-sync attaches `Authorization: Bearer ${HUB_SERVICE_TOKEN}` to `/v1/tenants/{tenantId}/...` for arbitrary tenantId. Current code scopes tenantId from session (no IDOR), but the token itself is a god-credential usable against any tenant — and breach context confirms it was already exposed once. Any future RCE/env-leak on any holder re-compromises every tenant's DNA/documents/profile.
**Remediation:** replace the static token with short-lived, tenant/scope-limited tokens minted per-request; rotate the current token; ensure the Hub enforces tenant authz server-side independent of the caller's path param.

### 18 — [MEDIUM] myorbisbiz admin token — timing side-channel + token-as-cookie
`checkAdmin()` does `provided === token` (not constant-time) against a single `BIZ_ADMIN_TOKEN` gating every `/api/admin/*` incl. destructive `business/[id]/purge`, entitlement override, `campaigns/[id]/send-now`. The browser session stores the **raw** token as `mob_admin` cookie — the session cookie IS the master token, so any cookie leak = permanent full admin until manual rotation.
**Remediation:** `crypto.timingSafeEqual` over fixed-length buffers (as voice's internal-mail.ts/internal-gateway.ts already do); issue a distinct signed, short-lived, httpOnly+Secure+SameSite session token; keep `BIZ_ADMIN_TOKEN` server-only; rotate it.

### 19 — [MEDIUM] Access + refresh tokens in localStorage (voice-web)
`ACCESS_TOKEN_KEY`/`REFRESH_TOKEN_KEY` read/written via localStorage; the OIDC callback hands both tokens to the SPA via URL fragment then persists them. Any injected script reads them; combined with the wildcard Web Origins (finding 4) this widens cross-origin/XSS exfil. Refresh-token rotation-on-use is implemented server-side (good) but doesn't stop immediate XSS theft.
**Remediation:** httpOnly+Secure+SameSite cookie for session/refresh (or at minimum keep refresh out of localStorage); serve a strong CSP on app.myorbisvoice.com.

### 20 / 21 — [MEDIUM] Missing security headers on app.myorbisvoice.com and products.myorbisresults.com
Both edge-net and live-web confirm: `curl -sI https://app.myorbisvoice.com/login` → only `x-powered-by: Next.js`, no HSTS/CSP/XFO/nosniff/Referrer/Permissions — this is the authenticated tenant + platform-admin console (clickjacking of admin actions, SSL-strip on first navigation). api.myorbisvoice.com by contrast returns a full helmet set. products.myorbisresults.com (the cryptojacked box, no Cloudflare) is a bare reverse_proxy with zero header directives.
**Remediation:** add a shared edge security-header snippet — `Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"`, `X-Frame-Options: SAMEORIGIN` (or CSP `frame-ancestors 'self'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, a CSP, `Permissions-Policy` — to every myorbis host block; set `poweredByHeader:false`. Confirm app cookies are Secure+HttpOnly+SameSite.

### 22 — [MEDIUM] Dockerfile install fallbacks defeat lockfile integrity
`pnpm install --frozen-lockfile || pnpm install` (storefront, content-engine), `npm ci || npm install` (reviews), `--frozen-lockfile=false` (apps/render). On any lockfile drift the build silently re-resolves every caret range (express ^4.19.2, jsonwebtoken ^9.0.2, stripe ^22.1.0, twilio ^6.0.0, etc.) to the latest satisfying — pulling un-reviewed/just-published releases into a prod image.
**Remediation:** remove the `|| install` fallbacks and `--frozen-lockfile=false`; let builds FAIL on drift; regenerate lockfiles intentionally in-repo.

### 23 — [MEDIUM] leadengine Perl-stack base image
Trivy 3 HIGH: CVE-2026-48962 (perl-IO-Compress ACE, affected), CVE-2026-42497 + CVE-2026-9538 (perl-Archive-Tar, fix deferred), plus util-linux CVE-2026-53615. No upstream fixes. leadengine has no published port (internal-only), lowering exposure.
**Remediation:** track upstream; if Perl isn't needed at runtime, switch to node:slim/distroless to drop the perl-* surface entirely. Confirm leadengine actually needs Perl.

### 24 — [MEDIUM] Fleet-wide missing cap-drop / no-new-privileges / read-only rootfs
All 21 containers: `CapDrop=[], SecurityOpt=[], ReadonlyRootfs=false`, `/var/tmp` writable (verified live on storefront, edge-caddy, reviews-web, biz-app, voice-web, voice-api). The default docker cap set (NET_RAW, SETUID…) is fully retained. The prior miner ran from a writable tmp dir as root — nothing structurally prevents a repeat.
**Remediation:** in every compose service add `security_opt:["no-new-privileges:true"]`, `cap_drop:["ALL"]` (re-add only what each needs), `read_only:true` + explicit tmpfs for the small writable set. Combined with non-root USER this removes both the privilege and the persistence surface.

### 25 — [LOW] Stored XSS via dangerouslySetInnerHTML (voice-web)
`dangerouslySetInnerHTML={{__html: script.bodyHtml}}` (partner script) and `current.html` (admin agent-demos) render authored HTML with no sanitizer. Blast radius limited (self/admin-authored content), but no sanitization boundary exists.
**Remediation:** sanitize on write and render with an allowlist sanitizer (isomorphic-dompurify) — strip event handlers, `<script>`, `javascript:` URLs.

### 26 — [LOW] Email/HTML injection (myorbisbiz lead route)
Lead-callback email interpolates `${biz.name/city/state}` (from directory import + public claim flow) directly into HTML sent to the owner. An attacker controlling a listing name injects markup/links. Public but rate-limited route.
**Remediation:** HTML-escape all interpolated DB/user values, or use an auto-escaping templating layer.

### 27 — [LOW] content-engine dashboard has no auth
`createServer` routes on `req.url` with no Authorization/token gate. Container (port 4700) is NOT deployed today; flagged to prevent shipping it world-reachable.
**Remediation:** add an auth gate (shared-secret bearer via timingSafeEqual, or authenticated reverse proxy) before any deploy; never expose 4700 publicly.

### 28 — [LOW] `apps/web/.env.production` committed
Tracked file, but contents are only `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_OIDC_ENABLED` (build-time public vars, no secret). Prospective risk: a tracked `.env.*` invites a future silently-committed secret (the storefront-leak pattern).
**Remediation:** `git rm --cached apps/web/.env.production`, add to .gitignore, ship a `.env.production.example` with placeholders or inject via deploy.sh.

### 29 — [LOW] Keycloak realm has no password policy
Empty `realm.password_policy` — amplifies finding 1's brute-force exposure.
**Remediation:** set `length(12)`, `notUsername`, passwordHistory / HaveIBeenPwned check. (Bundle with finding 1.)

### 30 — [LOW] Best-effort SSO logout leaves KC session
`ssoLogout()` POSTs revoke in try/catch and clears local tokens + redirects regardless of failure; the browser KC `/logout` is avoided due to a KC confirm-screen NPE 500 on expired code (KC bug 2026-06-21). On revoke failure the shared KC SSO session survives → next login silently re-authenticates.
**Remediation:** surface an error/retry on revoke failure; store `id_token` to pass `id_token_hint` to `end_session_endpoint` (avoids the NPE) and restore guaranteed front-channel SSO teardown; track the KC upstream fix.

### 31 — [LOW] Missing headers / fingerprints on non-authenticated public hosts
reviews.myorbisresults.com (Caddy SPA, no headers), hub.myorbisresults.com (bare reverse_proxy, 404 root), myorbisvoice.com marketing (no headers, leaks `X-Turbo-Charged-By: LiteSpeed`), myorbisagents.com (missing HSTS/XFO/CSP/Permissions, returns `Access-Control-Allow-Origin: *` on HTML). `x-powered-by: Next.js` on app/products/biz confirms the exact stack that was RCE'd.
**Remediation:** apply the shared edge header snippet to each; strip `x-powered-by`/`X-Turbo-Charged-By`; scope the agents ACAO off `*` on document responses. (Reviews false-positive note: `/​.env` and `/.git/config` return 200 but are the SPA index catch-all — verified NOT real files; configure Caddy to 404 dotfiles.)

### 32 — [CRITICAL severity / P2 priority] turbo 2.9.6 (CVSS 9.8)
Build/dev monorepo orchestrator, devDependency, **not shipped in runtime images** — exposure limited to build/CI/dev host. Fixed 2.9.14.
**Remediation:** bump turbo ≥2.9.14. Lower priority than any runtime-facing finding.

### 33 — [INFO] Real API keys in gitignored workstation `.env`
content-engine `.env` holds real OpenAI/Gemini/DataForSEO/LocationIQ/GSC values; OrbisVoice2026 `.env` holds AUTH_SECRET/STRIPE_SECRET_KEY/TWILIO_AUTH_TOKEN/N8N_ENCRYPTION_KEY. **Verified NOT git-tracked** (gitignored). Not a leak — flagged because a leaked OpenAI key was part of the breach.
**Remediation:** acceptable for dev; rotate content-engine OpenAI/Gemini keys if this workstation is shared or backed up unencrypted; prefer the Admin encrypted store over workstation .env for keys that also exist in prod.

### 34 — [INFO] `admin-cli` direct grants on
Stock KC client, another ROPC target with realm brute-force off. **Remediation:** disable direct grants if kcadm ROPC isn't needed against this realm (bundle with finding 1).

### 35 — [INFO] myorbisbiz.com missing only CSP
Best-configured public app (HSTS/XFO/nosniff/Referrer/Permissions all present); missing CSP, leaks `x-powered-by`. **Remediation:** add a CSP; set `poweredByHeader:false`.

---

## Coverage gaps — what was NOT tested (be explicit)
- **Live-container Next.js versions** for products/app/biz could not be re-confirmed under the read-only guardrail (no `docker exec` into prod). Findings reflect committed lockfiles = what a rebuild installs. Coverage confirmed via prior inspection that live storefront=15.5.22, voice-web=15.5.18, biz=16.2.9.
- **Keycloak ROPC/brute-force** asserted from the backing DB, NOT live-exploited; token-endpoint runtime behavior not benign-probed (kcadm auth correctly blocked, no creds guessed).
- **Secrets:** gitleaks never completed a full pass (node_modules-bound timeout). Compensated with targeted tracked-file + up-to-~400-commit git-history scans for real key formats and env-dump vectors — **zero committed real secrets, zero `JSON.stringify(process.env)` sinks** in any repo. Live container filesystems/logs and box1/box2 prod env files were NOT read (read-only remote scope).
- **Trivy** exact HIGH totals for voice-api/gateway/web/render were truncated by `tail -40`; individual CVE rows (node-tar, undici, ws) ARE captured. postgres:16 / redis:7 images were not scanned. reviews-api container has no package.json in the clone — its deps unscanned.
- **osv-scanner** reflects osv.dev advisories as of scan time. Vendored dev tooling (goose/claudecodeui/superpowers/remotion/playwright/etc.) excluded as non-product surfaces. MyOrbisLocal has no manifests. content-engine=0 vulns (not yet deployed).
- **Edge/network:** only an 18-port common set was probed (nmap absent), not a full 65535 sweep. Legacy TLS1.0/1.1 acceptance inconclusive (client openssl refused to offer them). Confirmed clean: all DBs/Redis/Keycloak/hub-api/internal services loopback or internal-only; n8n double-lock intact (401 Basic).
- **live-web DAST:** single unauthenticated GETs only — no authenticated route testing, fuzzing, or port enumeration from the host. `.env`/`.git` 200s on reviews + agents verified as SPA catch-all false positives.
- **SAST verified-clean (no finding):** webhook signatures solid (Stripe constructEvent, Twilio validateRequest fail-closed, HMAC+timingSafeEqual for gateway/mail/recording); no exec/spawn interpolation, no eval, no raw SQL concat (Prisma parameterized); storefront tenant routes derive tenantId from session (no IDOR despite god-token); GCM decrypt does setAuthTag (10 semgrep gcm flags = false positives); RBAC server/UI parity holds (admin router blanket-guards every route + per-write tier checks).