#!/usr/bin/env bash
# Partner-help drift detector — meant to run nightly via cron.
#
# Cron entry (root crontab on the Contabo box):
#   30 3 * * *  /opt/myorbisvoice/infrastructure/scripts/partner-help-audit-cron.sh \
#                 >> /var/log/myorbisvoice/partner-help-audit.log 2>&1
#
# When drift is detected (exit 1), the JSON report is emitted to the log so
# the next pass-through can email / Slack it. Right now we only log — the
# email/Slack notifier comes when uptime/Sentry wiring lands.

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/myorbisvoice}"
cd "$REPO_ROOT"

echo "── Partner-help audit · $(date -u +%FT%TZ) ──"

if pnpm --silent partner-help:audit; then
  echo "✓ All articles fresh."
  exit 0
fi

# Drift detected — emit machine-readable report so the next step (notifier)
# can ingest it. Exit non-zero so cron MAILTO catches it.
echo
echo "── DRIFT DETECTED — JSON report follows ──"
pnpm --silent partner-help:audit:json || true
echo
echo "Action: review STALE / UNDATED articles in apps/web/src/lib/partnerHelpContent.ts,"
echo "refresh the bodies, bump lastUpdated to today, commit."
exit 1
