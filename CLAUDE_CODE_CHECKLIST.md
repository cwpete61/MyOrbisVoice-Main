# Claude Code Execution Checklist

## Objective
Provision Contabo box #2 (`109.123.249.34`, fresh Ubuntu 24.04) to a
**deploy-ready baseline** for the Local family (MyOrbisLocal + MyOrbisReviews):
Docker Engine + Compose, base directory layout, and a shared Caddy edge with
per-product `conf.d/` fragments. No product code is deployed in this step.
Greenfield only — does not touch the live MyOrbisVoice app on box #1.

## Phases
- [x] Phase 1 — Verify access + system prep (apt update, prerequisites)
- [x] Phase 2 — Install Docker Engine + Compose plugin
- [x] Phase 3 — Base directory layout (/opt/edge, /opt/myorbislocal, /opt/myorbisreviews)
- [x] Phase 4 — Shared Caddy edge skeleton (Caddyfile + conf.d + compose), start it
- [x] Phase 5 — Verify (docker hello-world, compose version, caddy health, firewall check)
- [x] Phase 6 — Codify into infrastructure/scripts/provision-box2.sh (idempotent runbook)
- [x] Phase 7 — Commit runbook + checklist (branch, no push without approval)

## Error Log
None — all phases passed first time.

## Completed Work
- **Phase 1:** Confirmed box `vmi3318357` / `109.123.249.34` / Ubuntu 24.04.4.
  `apt-get update` + installed ca-certificates/curl/gnupg/lsb-release. ufw
  inactive — left as-is (avoid SSH-lockout risk; provider firewall at edge).
- **Phase 2:** Docker official apt repo + GPG added; installed **Docker 29.5.3**
  + **Compose v5.1.4** (docker-ce, cli, containerd, buildx, compose plugins);
  `systemctl enable --now docker`.
- **Phase 3:** Created `/opt/edge/conf.d`, `/opt/myorbislocal`, `/opt/myorbisreviews`.
- **Phase 4:** `/opt/edge/Caddyfile` (global ACME email, `import conf.d/*.caddy`,
  baseline `:80` health) + `/opt/edge/docker-compose.yml` (caddy:2, 80/443,
  named volumes, `edge_net`). `docker compose up -d` → `edge-caddy` running.
- **Phase 5 verify:** `docker run hello-world` OK; `edge-caddy` Up, ports
  `0.0.0.0:80->80`, `0.0.0.0:443->443`; `curl localhost/health` → `ok`;
  `caddy validate` → Valid configuration.
- **Phase 6:** Wrote idempotent `infrastructure/scripts/provision-box2.sh`;
  re-ran it end-to-end → container reused (not recreated), all checks green,
  `PROVISION_COMPLETE`.

## Result
Box #2 is a **deploy-ready baseline**. Next (separate, gated): deploy Keycloak
as its own stack on box #1, then the Account Hub, then MyOrbisReviews on box #2.
No product deployed in this step; live MyOrbisVoice untouched.
