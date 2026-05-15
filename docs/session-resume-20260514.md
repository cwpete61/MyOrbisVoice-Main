# Session resume — 2026-05-14 evening

Checkpoint state for continuation. Resume here on next session start.

## Recovery anchors

- **Git tag:** `session-checkpoint-20260514_191500`
- **Commit:** `9983e3a feat(G.2 + help): partner SMS credits + Twilio cost meter + auto-purchase numbers + help screenshots in light mode`
- **DB snapshot:** `backups/db_session_checkpoint_20260514.dump` (prod, post-deploy)
- **Last prod deploy reasons (today):**
  - `calendar Day view: double row height + title — time on one line`
  - `screenshots re-captured in LIGHT MODE per mandatory rule`
  - `ship partner help screenshots: 5 captured PNGs for pn-buying-numbers article`
  - `G.2.2: auto-provision partner numbers, admin can disable instead of approve`
  - `G.2.1 cost meter: Twilio Price capture + net guard + low-balance notifier + UI banners + $2/mo display`

## Shipped this session

1. ✅ Customer booking page (Google-Calendar layout) + per-day weekly hours + breaks + notice/advance
2. ✅ Slot search fixes: minute-math, midnight-wrap reject, :00/:30 alignment
3. ✅ Partner Booking Preferences UI — bulk "Apply lunch break to all open days"
4. ✅ Partner Phone Numbers v2: drop VOICE_SMS bundled tier; SMS sold as credit packs
5. ✅ Phase G.2 — SMS credit packs ($5/500, $10/1200), Stripe one-time Checkout, ledger
6. ✅ Phase G.2.1 — Twilio cost meter: capture Price from sms-status webhook, financial banner, OVER_BUDGET guard, low-balance email notifier (deduped 24h), nightly partner-credit-watch cron
7. ✅ Phase G.2.2 — auto-provision partner numbers (drop admin-approve gate); admin Disable action retained
8. ✅ Monthly pricing card on Phone Numbers page ($2/mo local, $5/mo toll-free)
9. ✅ Partner help section overhaul — 11 sections total (was 6), 18 articles (was 9), lastUpdated timestamps + sourcePaths
10. ✅ HelpArticle renderer — italic "Last Updated MM/DD/YYYY" footer
11. ✅ `pnpm partner-help:audit` drift detector + cron wrapper
12. ✅ 5 light-mode screenshots captured + live for pn-buying-numbers article
13. ✅ Screenshot rule MANDATORY: light mode always (CLAUDE.md + memory + script enforced)
14. ✅ Calendar Day view: doubled HOUR_PX (44→88), event card single-line "Title — Time", min-height 36px
15. ✅ Admin /phone-number-requests envelope bug fixed
16. ✅ Outdated i18n copy refreshed for auto-purchase flow

## Open from earlier (pre-session, not blocked on this work)

See `docs/launch-blockers.md`:
- 🟡 Recommended pre-launch: latency baseline, Next.js 15 CVE upgrade, Sentry, UptimeRobot, voice retest
- 🔵 External waits: Toll-free verification, A2P 10DLC approval, outbound carrier reputation

## Pending decisions / mentioned but not started

- **Lead section** — user mentioned wanting to "move on to the lead section" mid-session. Not started.
- **A2P 10DLC partner wizard** (G.1.B-3) — deferred; needs Trust Hub integration
- **Partner voice-agent runtime** (G.1.C) — placeholder TwiML on inbound; full agent runtime deferred
- **Partner WhatsApp** (G.4) — "Coming soon" tile shown on Phone Numbers; pricing TBD
- **Data-loss prevention layers 3+4** — audit-log enforcement + DB-level DELETE REVOKE not done
- **Offsite backup destination** — needs user authorization for Bunny Storage / rsync

## Test / capture infrastructure on prod

Two seeded users — see `docs/e2e-capture-users.md`:
- `e2e-capture@myorbisvoice.com` / `CaptureBot!2026` (partner role)
- `e2e-capture-admin@myorbisvoice.com` / `CaptureBot!2026` (platform_super_admin)

Keep them — needed for `pnpm capture-screenshots --partner` re-runs.

## Quick orientation for next session

```bash
# Where you are
git status
git log --oneline -5

# What's broken (recent)
docker logs myorbisvoice-api     --tail=20 2>&1
docker logs myorbisvoice-web     --tail=10 2>&1
docker logs myorbisvoice-gateway --tail=10 2>&1

# Health
curl -sk https://api.myorbisvoice.com/health
curl -sk -o /dev/null -w "%{http_code}\n" https://app.myorbisvoice.com/partner-portal/phone-numbers

# To resume the lead section work
ls apps/web/src/app/\(partner-portal\)/partner-portal/\(portal\)/leads/
```

## Rollback if needed

```bash
# Code:
git checkout session-checkpoint-20260514_191500

# DB on prod:
ssh root@147.93.183.4
docker exec -i myorbisvoice-postgres pg_restore -U voiceautomation -d voiceautomation --clean --if-exists < backups/db_session_checkpoint_20260514.dump
```
