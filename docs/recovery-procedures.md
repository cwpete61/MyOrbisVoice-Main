# Recovery Procedures

> Incident-time reference. Read this when something is broken — bad deploy, corrupt config, dropped database, rolled-back migration. Linked from CLAUDE.md.

## When to take a backup

Take a named backup before every phase begins and before any destructive or high-risk operation:
- Before running `prisma migrate deploy` or `prisma db push`
- Before any seed script that modifies existing rows
- Before upgrading a major dependency (Prisma, Next.js, Stripe SDK, etc.)
- Before merging a large feature branch into main
- Before Phase N+1 begins (the exit gate must pass first)

### Database backup — local

PostgreSQL runs in the `umoja-postgres` Docker container (shared with other projects). Use docker exec:

```bash
# Dump the voiceautomation database to a timestamped file
docker exec umoja-postgres pg_dump -U voiceautomation -d voiceautomation -F c \
  > backups/db_$(date +%Y%m%d_%H%M%S).dump

# Restore from a dump
docker exec -i umoja-postgres pg_restore \
  -U voiceautomation -d voiceautomation --clean --if-exists \
  < backups/<filename>.dump
```

Store dumps in `backups/` at the repo root (gitignored — see `backups/.gitignore`). Keep at least the last 3 phase snapshots.

### Database backup — production (Contabo)

```bash
# On the Contabo server, run via Docker
docker exec voiceautomation-postgres pg_dump \
  -U voiceautomation -d voiceautomation -F c \
  > /var/backups/va/db_$(date +%Y%m%d_%H%M%S).dump
```

Automate this with a cron job inside the backup service container (see docker-compose). Retain 7 daily dumps minimum.

### Code snapshot before a phase

Before each phase, tag the working state in git:

```bash
git add -A
git commit -m "snapshot: pre-phase-N checkpoint"
git tag phase-N-start
```

This makes rollback trivial: `git checkout phase-N-start`.

### Recovery protocol — database

1. Stop the API and voice-gateway containers to prevent writes.
2. Run `pg_restore` (see above) against the target dump.
3. Verify schema version matches the codebase: `pnpm prisma migrate status`.
4. If migration state is ahead of the dump, run `pnpm prisma migrate resolve --rolled-back <migration_name>` for each rolled-back migration.
5. Restart services and run the E2E suite: `pnpm --filter @voiceautomation/e2e test`.

### Verified backup restore procedure (TESTED 2026-05-02)

**IMPORTANT:** Production runs PostgreSQL 16. The local `umoja-postgres` runs PG 15, which **cannot** read PG 16 custom-format dumps. Restore tests must use a PG 16 instance.

This procedure has been run end-to-end and confirmed working — row counts of every critical table matched exactly between prod and the restored copy.

```bash
# 1. Take a fresh prod dump
DUMP=backups/restore-test/prod_$(date +%Y%m%d_%H%M%S).dump
mkdir -p backups/restore-test
ssh root@147.93.183.4 'docker exec myorbisvoice-postgres pg_dump -U voiceautomation -d voiceautomation -F c' > "$DUMP"

# 2. Spin up a temporary PG 16 container on a non-conflicting port
docker run -d --name pg16-restore-test \
  -e POSTGRES_USER=voiceautomation \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=voiceautomation_restore_test \
  -p 5433:5432 \
  postgres:16-alpine

# 3. Wait for it to be ready
for i in {1..15}; do
  docker exec pg16-restore-test pg_isready -U voiceautomation 2>&1 | grep -q "accepting" && break
  sleep 1
done

# 4. Restore
docker cp "$DUMP" pg16-restore-test:/tmp/restore.dump
docker exec pg16-restore-test pg_restore -U voiceautomation -d voiceautomation_restore_test --no-owner --no-acl /tmp/restore.dump

# 5. Verify row counts match prod
for t in Tenant TenantMember User Plan RoleDefinition Conversation Contact Appointment SystemConfig BusinessProfile; do
  PROD=$(ssh root@147.93.183.4 "docker exec myorbisvoice-postgres psql -U voiceautomation -d voiceautomation -t -c 'SELECT COUNT(*) FROM \"$t\"'" | tr -d ' \r\n')
  RESTORED=$(docker exec pg16-restore-test psql -U voiceautomation -d voiceautomation_restore_test -t -c "SELECT COUNT(*) FROM \"$t\"" | tr -d ' \r\n')
  [ "$PROD" = "$RESTORED" ] && echo "✅ $t: $PROD" || echo "❌ $t: prod=$PROD restored=$RESTORED"
done

# 6. Cleanup
docker rm -f pg16-restore-test
```

**Run this monthly** (or before any major schema change) to confirm backups remain restorable.

### Recovery protocol — bad migration

1. Identify the migration name from `pnpm prisma migrate status`.
2. If the migration is destructive and data is lost, restore from the pre-phase database dump first.
3. Mark the migration as rolled back: `pnpm prisma migrate resolve --rolled-back <migration_name>`.
4. Fix the migration file or create a corrective one.
5. Re-apply: `pnpm prisma migrate deploy`.

### Recovery protocol — dependency upgrade gone wrong

1. `git stash` or `git checkout` to restore `package.json` and lock file.
2. Run `pnpm install` to restore the previous dependency tree.
3. Verify the build passes: `pnpm --filter @voiceautomation/api build` and `pnpm --filter @voiceautomation/web build`.

### Rollback procedure — bad deploy broke production

**Symptoms:** site returns 500/502, login flow broken, blank pages, console errors after a deploy. You need to revert to last-known-good state in <5 minutes.

**Pre-flight (always do this first):**
```bash
# Capture the broken state for later debugging — DO NOT skip
ssh root@147.93.183.4 'docker logs myorbisvoice-api --tail=200' > /tmp/broken_api_$(date +%s).log
ssh root@147.93.183.4 'docker logs myorbisvoice-web --tail=200' > /tmp/broken_web_$(date +%s).log
```

**Step 1 — Identify the last known good commit:**
```bash
git log --oneline -10                                # see recent deploys
git tag -l                                            # see tagged checkpoints
# Permanent rollback anchors (always present):
#   pre-stabilization-20260502  — clean state, post-stabilization sweep
#   disaster-backup-20260501    — pre-hardening snapshot
```

**Step 2 — Roll the working tree back to that commit:**
```bash
LAST_GOOD=pre-stabilization-20260502        # or any commit hash from step 1
git checkout "$LAST_GOOD"
```

**Step 3 — Rebuild and redeploy ONLY the affected services:**
```bash
# Identify which apps changed since the rollback target
git diff --name-only HEAD master | awk -F/ '{print $2}' | sort -u
# Rebuild + deploy only those (saves 5+ minutes vs deploying everything)
pnpm --filter @voiceautomation/api build
./infrastructure/scripts/deploy.sh api "rollback to $LAST_GOOD"
# (repeat for web/gateway as needed)
```

**Step 4 — Verify the rollback worked:**
```bash
curl -s https://api.myorbisvoice.com/health | grep -q '"status":"ok"' && echo OK
curl -s -o /dev/null -w "%{http_code}\n" https://app.myorbisvoice.com/login        # expect 200
ssh root@147.93.183.4 'docker logs myorbisvoice-api --tail=20'    # expect "listening on" with no errors
```

**Step 5 — Return to master and fix forward:**
```bash
git checkout master
# Open a new branch to fix the bug. Do NOT redeploy from master until tests pass.
```

**⚠️ Note on Docker image rollback:** Images are tagged `:latest` only — there is no built-image version history. The procedure above rebuilds from source rather than retagging an old image. If you need image-level rollback (faster, no rebuild), it must be added to `deploy.sh` as a future improvement (tag the previous `:latest` as `:rollback` before overwriting).

### Rollback procedure — config files wiped or corrupted

**Symptoms:** containers won't start, env vars missing, compose syntax error after editing.

**Step 1 — Restore from the most recent DR snapshot:**
```bash
# Find the most recent DR snapshot
LATEST_DR=$(ls -td backups/dr-* | head -1)
echo "Restoring from $LATEST_DR"

# Compose file
ssh root@147.93.183.4 'cp /opt/myorbisvoice/infrastructure/docker/docker-compose.prod.yml{,.broken.bak}'
scp "$LATEST_DR/compose.prod.docker.yml" \
    root@147.93.183.4:/opt/myorbisvoice/infrastructure/docker/docker-compose.prod.yml

# Env file
ssh root@147.93.183.4 'cp /opt/myorbisvoice/infrastructure/docker/.env.prod{,.broken.bak}'
scp "$LATEST_DR/env.prod.docker" \
    root@147.93.183.4:/opt/myorbisvoice/infrastructure/docker/.env.prod
ssh root@147.93.183.4 'chmod 600 /opt/myorbisvoice/infrastructure/docker/.env.prod'
```

**Step 2 — Bring services back up:**
```bash
ssh root@147.93.183.4 'cd /opt/myorbisvoice/infrastructure/docker && \
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d'
```

**Step 3 — Verify:**
```bash
curl -s https://api.myorbisvoice.com/health
ssh root@147.93.183.4 'docker ps --filter name=myorbisvoice --format "{{.Names}} {{.Status}}"'
```

### Rollback procedure — database corrupted or wrong data deployed

Use the verified restore procedure documented above. **Always test the restore in the PG16 sandbox container first**, then if confirmed working, restore to prod:

**Step 1 — Stop write traffic:**
```bash
ssh root@147.93.183.4 'docker stop myorbisvoice-api myorbisvoice-gateway'
```

**Step 2 — Pick a dump (most recent good one):**
```bash
ssh root@147.93.183.4 'docker exec myorbisvoice-db-backup ls -lt /backups/ | head -10'
# Note the filename you want: e.g. db_20260502_084359.dump
```

**Step 3 — Restore in place:**
```bash
DUMP=db_20260502_084359.dump  # ← change to the one you picked
ssh root@147.93.183.4 "docker exec myorbisvoice-db-backup cat /backups/$DUMP" | \
  ssh root@147.93.183.4 'docker exec -i myorbisvoice-postgres pg_restore \
    -U voiceautomation -d voiceautomation --clean --if-exists --no-owner --no-acl'
```

**Step 4 — Verify schema state:**
```bash
ssh root@147.93.183.4 'docker exec myorbisvoice-postgres psql -U voiceautomation -d voiceautomation \
  -c "SELECT count(*) FROM \"Tenant\"; SELECT count(*) FROM \"User\"; SELECT count(*) FROM \"Conversation\";"'
```

**Step 5 — Resume traffic:**
```bash
ssh root@147.93.183.4 'docker start myorbisvoice-api myorbisvoice-gateway'
sleep 6 && curl -s https://api.myorbisvoice.com/health
```

### Quick reference — canonical paths

These are the only files in production that should be edited. Everything else is generated or deprecated:

| Asset | Path |
|---|---|
| Compose file | `/opt/myorbisvoice/infrastructure/docker/docker-compose.prod.yml` |
| Env file | `/opt/myorbisvoice/infrastructure/docker/.env.prod` |
| Caddy reverse proxy | `/opt/myorbisvoice/infrastructure/caddy/Caddyfile` |
| Daily DB backups | volume `myorbisvoice_db_backups` (mounted at `/backups/` inside `myorbisvoice-db-backup`) |
| Local DR snapshots | `backups/dr-YYYYMMDD_HHMMSS/` (gitignored) |
| Last-known-good git tags | `pre-stabilization-20260502`, `disaster-backup-20260501` |

### What to back up beyond the database

| Asset | Location | How |
|---|---|---|
| Database | PostgreSQL | pg_dump before each phase |
| Environment variables | `.env` files | Keep an encrypted copy off-repo (1Password, Bitwarden, etc.) |
| n8n workflows | n8n UI | Export all workflows as JSON before each phase; store in `/n8n/exports/` |
| Uploaded files / media | If applicable | rsync to secondary location |
| Redis data | Only queue state | Redis is ephemeral by design; queued jobs re-enqueue on restart |

### Automated backup service (production)

The production `docker-compose.yml` must include a backup service that:
- Runs `pg_dump` on a schedule (daily minimum, hourly during active development sprints)
- Rotates dumps older than 30 days
- Alerts (via email or webhook) if a backup fails

Add this to the Phase 9 hardening checklist.

