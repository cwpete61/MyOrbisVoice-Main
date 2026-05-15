#!/usr/bin/env bash
# Daily DB backup with 30-day rotation. Lives on the prod box, runs from cron.
#
# Output: /opt/myorbisvoice/backups/daily/db_YYYYMMDD_HHMMSS.dump
# Rotation: anything older than 30 days in that dir is deleted at the end.
#
# Why this exists: the deploy script and bulk-delete helpers already snapshot
# before/after their operations, but those only run when *someone is acting*.
# Most days nothing deploys, and a runaway script / disk failure / accidental
# `prisma db push --force-reset` between deploys leaves zero recovery anchor.
# This guarantees ≤24h worst-case data loss regardless of activity.
#
# Cron entry (installed on prod via `crontab -e`):
#   0 3 * * *  /opt/myorbisvoice/infrastructure/scripts/backup-daily.sh \
#              >> /var/log/myorbisvoice-backup.log 2>&1
#
# Restore (one-liner):
#   docker exec -i myorbisvoice-postgres pg_restore -U voiceautomation \
#     -d voiceautomation --clean --if-exists < /opt/myorbisvoice/backups/daily/db_<TS>.dump

set -euo pipefail

BACKUP_DIR="/opt/myorbisvoice/backups/daily"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
DUMP_PATH="${BACKUP_DIR}/db_${TIMESTAMP}.dump"
RETENTION_DAYS=30
CONTAINER="myorbisvoice-postgres"
DB_NAME="voiceautomation"
DB_USER="voiceautomation"

mkdir -p "$BACKUP_DIR"

echo "[$(date -u +%FT%TZ)] starting backup → $DUMP_PATH"

# Use pg_dump's custom format (-F c) — gives us parallel-restore support and
# good compression by default. Goes through docker exec because Postgres runs
# inside a container (no host-level pg_dump binary).
docker exec "$CONTAINER" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -F c \
  --no-owner \
  --no-acl \
  > "$DUMP_PATH"

SIZE=$(stat -c%s "$DUMP_PATH")
echo "[$(date -u +%FT%TZ)] wrote ${SIZE} bytes"

# Quick sanity check — empty dumps (size 0 or weirdly small) usually mean
# Postgres returned an error. Fail loudly so cron mails us; alert ourselves
# before retention deletes the only good backup we had.
if [ "$SIZE" -lt 10000 ]; then
  echo "[$(date -u +%FT%TZ)] ERROR: backup is suspiciously small (${SIZE} bytes), refusing to rotate"
  exit 1
fi

# Rotation. Only operate on files matching our exact prefix so we never
# accidentally delete an unrelated dump someone else left in the dir.
DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'db_*.dump' -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)
echo "[$(date -u +%FT%TZ)] rotation: removed ${DELETED} backup(s) older than ${RETENTION_DAYS} days"

# Keep one symlink to "latest" so restore scripts can find it without guessing.
ln -sf "db_${TIMESTAMP}.dump" "${BACKUP_DIR}/latest.dump"

echo "[$(date -u +%FT%TZ)] backup complete"
