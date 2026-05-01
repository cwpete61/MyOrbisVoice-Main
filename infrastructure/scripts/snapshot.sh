#!/usr/bin/env bash
# snapshot.sh — record current working state before making changes
# Usage: ./infrastructure/scripts/snapshot.sh "what you are about to do"
set -euo pipefail

SERVER="root@147.93.183.4"
REMOTE="/opt/myorbisvoice"
LABEL="${1:-manual}"
STAMP="$(date +%Y%m%d_%H%M%S)"
SNAP_DIR="$REMOTE/snapshots/$STAMP"
LOCAL_SNAP="snapshots/$STAMP"

log() { echo ""; echo "── $*"; }

mkdir -p "$LOCAL_SNAP"

log "Recording container state..."
ssh "$SERVER" "
  mkdir -p $SNAP_DIR
  docker inspect myorbisvoice-api myorbisvoice-web myorbisvoice-gateway 2>/dev/null \
    > $SNAP_DIR/containers.json
  docker images --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.CreatedAt}}' \
    | grep myorbisvoice > $SNAP_DIR/images.txt 2>/dev/null || true
  echo '$LABEL' > $SNAP_DIR/label.txt
  echo '$STAMP' > $SNAP_DIR/timestamp.txt
"

log "Backing up database..."
ssh "$SERVER" "docker exec myorbisvoice-postgres pg_dump \
  -U voiceautomation -d voiceautomation -F c \
  > $SNAP_DIR/db.dump"
echo "DB dump saved to server: $SNAP_DIR/db.dump"

log "Pulling DB dump locally..."
scp "$SERVER:$SNAP_DIR/db.dump" "$LOCAL_SNAP/db.dump"

log "Recording working state summary..."
cat > "$LOCAL_SNAP/snapshot.md" << EOF
# Snapshot: $STAMP
**Label:** $LABEL
**Date:** $(date)

## Container Status (at snapshot time)
$(ssh "$SERVER" "docker ps --filter name=myorbisvoice --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" 2>/dev/null)

## What was working before this change
See WORKING_STATE.md for full verified state.

## Rollback instructions
\`\`\`bash
# Restore DB
scp $LOCAL_SNAP/db.dump $SERVER:$SNAP_DIR/db.dump
ssh $SERVER "docker exec -i myorbisvoice-postgres pg_restore \\
  -U voiceautomation -d voiceautomation --clean --if-exists \\
  < $SNAP_DIR/db.dump"

# Restart all containers
ssh $SERVER "docker restart myorbisvoice-api myorbisvoice-web myorbisvoice-gateway"
\`\`\`
EOF

echo ""
echo "=== Snapshot complete: $STAMP ==="
echo "  Label:  $LABEL"
echo "  Local:  $LOCAL_SNAP/"
echo "  Server: $SNAP_DIR/"
echo ""
echo "You may now make your changes."
echo "If anything breaks: cat $LOCAL_SNAP/snapshot.md for rollback steps."
