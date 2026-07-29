# Remediation Plan — P0 / P1 / P2

Prioritized by exploitability × exposure, not raw CVSS. P0 = do now (internet-facing + actively exploitable or re-breach trap). P1 = this week (high-severity dep/root/header/secret work). P2 = this month (defense-in-depth, low/local, larger refactors).

## P0 — Do now (hours, not days)

| # | Item | Fix | Effort |
|---|---|---|---|
| P0-1 | **Keycloak ROPC + brute-force + password policy** (register 1, 29, 34) | Disable *Direct access grants* on `myorbis-apps` and `admin-cli`; enable realm Brute Force Detection with lockout; set password policy `length(12)`+`notUsername`+HIBP. Verify via kcadm. | 1–2h |
| P0-2 | **Keycloak wildcard redirect/Web Origins** (register 4) | Replace `*` with exact callback(s) + explicit origins on `myorbis-apps`. | 30m |
| P0-3 | **Storefront lockfile re-breach trap** (register 2) | `pnpm install --lockfile-only` → next ≥15.5.16, commit lockfile, rebuild+redeploy, confirm running version. Enforce CI `--frozen-lockfile`. | 1–2h |
| P0-4 | **Cloudflare origin bypass** (register 3) | Firewall box2 :443 to Cloudflare CIDRs (ufw/iptables) OR enable Authenticated Origin Pulls + require CF client cert in Caddy. | 2–4h |
| P0-5 | **Pin `@myorbis/hub-client`** (register 13) | Change specifier to `#<full-sha>`; remove `|| pnpm install` fallback; enable 2FA + branch protection + required review on cwpete61/myorbis-shared. | 1h |
| P0-6 | **Rotate the two breach-implicated shared secrets** (register 17, 18) | Rotate `HUB_SERVICE_TOKEN` and `BIZ_ADMIN_TOKEN` now (design change lands in P1). | 1h |

**P0 total: ~1 working day.** These close the two immediately-exploitable internet paths (KC brute-force, origin bypass) and the re-breach-on-deploy trap.

## P1 — This week

| # | Item | Fix | Effort |
|---|---|---|---|
| P1-1 | **Runtime dependency bump wave** (register 6,7,8,9,10,11,15) | pnpm `overrides`: axios ≥1.18, undici ≥7.28, ws ≥8.21, node-tar/tar ≥7.5.19, form-data ≥4.0.6, multer ≥2.2, nodemailer ≥9.0.1, postcss ≥8.5.18, next (voice-web ≥15.5.21, biz ≥16.2.11); xlsx → SheetJS CDN latest (or exceljs). Regenerate lockfiles, rebuild api/gateway/web/biz. | 1–2 days incl. smoke test |
| P1-2 | **Non-root USER on all Dockerfiles** (register 5, 12) | Add `USER app`/`USER node` + chown to voice web/api/gateway/render/pdf-render, myorbisbiz, content-engine, reviews-api; rebuild. Mirror storefront-api/leadengine pattern. | 1 day |
| P1-3 | **Shared edge security-header snippet** (register 20, 21, 31, 35) | HSTS/CSP/XFO/nosniff/Referrer/Permissions applied to app/products/reviews/hub/marketing/agents; strip x-powered-by + X-Turbo-Charged-By; scope agents ACAO. | 2–4h |
| P1-4 | **HUB token scope-down** (register 17) | Replace static god-token with short-lived tenant/scope-limited tokens minted per-request; enforce tenant authz server-side on the Hub. | ~1 day |
| P1-5 | **myorbisbiz admin auth redesign** (register 18) | `timingSafeEqual` compare; issue a distinct signed short-lived httpOnly+Secure+SameSite session cookie; keep BIZ_ADMIN_TOKEN server-only. | ~1 day |
| P1-6 | **reviews-web base-image rebuild** (register 14) | Rebuild on current caddy:2/Alpine (libssl3 ≥3.5.7-r0, libcurl ≥8.20.0-r0, Go ≥1.26.4, x/text ≥0.39.0). | 2–4h |
| P1-7 | **Remove install-integrity fallbacks** (register 22) | Drop `|| pnpm install`, `npm ci || npm install`, `--frozen-lockfile=false`; let builds fail on drift. | 2h |

**P1 total: ~4–5 working days.**

## P2 — This month (defense-in-depth + low/local)

| # | Item | Fix | Effort |
|---|---|---|---|
| P2-1 | **Fleet-wide compose hardening** (register 24) | `cap_drop:[ALL]` + re-add minimum, `no-new-privileges:true`, `read_only:true` + tmpfs on all 21 containers (incl. edge-caddy `NET_BIND_SERVICE`). Test each. | 1–2 days |
| P2-2 | **Move refresh token out of localStorage** (register 19) | httpOnly+Secure+SameSite cookie for session/refresh + strong CSP on app.myorbisvoice.com. | 2–3 days (SPA/auth refactor) |
| P2-3 | **Sanitize XSS + email sinks** (register 25, 26) | isomorphic-dompurify on write+render for dangerouslySetInnerHTML; HTML-escape myorbisbiz email interpolation. | half day |
| P2-4 | **turbo + vite bumps** (register 32, 16) | turbo ≥2.9.14 (devDep); vite ≥6.4.3 (reviews dev); plan react 18→19 family alignment. | 2–4h + react plan |
| P2-5 | **leadengine slim base** (register 23) | Confirm Perl need; if not, node:slim/distroless. | 2–4h |
| P2-6 | **content-engine dashboard auth before deploy** (register 27) | Shared-secret bearer via timingSafeEqual; never expose 4700. | 1h |
| P2-7 | **KC logout id_token_hint** (register 30) | Store id_token, pass to end_session_endpoint; error/retry on revoke failure. | half day |
| P2-8 | **Untrack committed env file** (register 28) | `git rm --cached apps/web/.env.production` + .gitignore + .example. | 30m |
| P2-9 | **Rotate content-engine OpenAI/Gemini keys** (register 33) | If workstation is shared/backed-up unencrypted; move to encrypted store. | 30m |

**P2 total: ~1–1.5 weeks.**

## Sequencing notes
- P0-6 (rotate) and P1-4/P1-5 (redesign) are split intentionally — rotate the leaked/shared secrets **today**, land the architectural fix within the week.
- P1-2 (non-root) and P2-1 (cap-drop/read-only) are the two halves of closing the breach's persistence surface — non-root first (bigger single-step win), full hardening second.
- The whole P1-1 dep wave and P1-2 should ship together per repo so each container is rebuilt once, not twice.