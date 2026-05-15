#!/usr/bin/env bash
# Nightly partner-credit watcher — finds partners trending OVER_BUDGET / LOW.
#
# Cron entry (root crontab on Contabo):
#   45 3 * * *  /opt/myorbisvoice/infrastructure/scripts/partner-credit-watch-cron.sh \
#                 >> /var/log/myorbisvoice/partner-credit-watch.log 2>&1
#
# Exit code reflects whether any partner is flagged (non-zero), which lets the
# next-step notifier (TBD — same hook as launch-blocker S2/S3 notification
# work) trigger on real signal.

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/myorbisvoice}"
cd "$REPO_ROOT"

echo "── Partner-credit watcher · $(date -u +%FT%TZ) ──"

if pnpm --silent run -- tsx scripts/partner-credit-watch.ts; then
  echo "✓ All partners healthy."
  exit 0
fi

echo
echo "── FLAGGED partners — JSON report follows ──"
pnpm --silent run -- tsx scripts/partner-credit-watch.ts --json || true
echo
echo "Action: review the flagged partners; the platform has already emailed"
echo "OVER_BUDGET partners (deduped 24h)."
exit 1
