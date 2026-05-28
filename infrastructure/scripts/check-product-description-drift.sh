#!/usr/bin/env bash
# check-product-description-drift.sh
#
# Auto-track integrity for docs/MyOrbisVoice-Product-Description.md.
#
# Compares: commits to user-visible feature paths vs commits to the doc.
# If 3+ feature-touching commits land without a matching doc update,
# prints a loud warning. Non-fatal — informational only.
#
# Triggered: (a) Claude Stop hook (session end), (b) optional git pre-commit.
# Exit codes: 0 = clean OR within tolerance. 1 = drift detected (warning printed).

set -u

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DOC_PATH="docs/MyOrbisVoice-Product-Description.md"
DOC_ABS="$REPO_ROOT/$DOC_PATH"
TOLERANCE=3   # how many feature commits since doc update before warning

# Watched paths: user-visible feature surfaces.
WATCHED=(
  "apps/web/src"
  "apps/api/src/routes"
  "apps/api/src/services"
  "apps/voice-gateway/src"
  "prisma/schema.prisma"
  "packages/"
  "site/"
)

cd "$REPO_ROOT" || exit 0

# If doc doesn't exist yet, nothing to track.
[ -f "$DOC_ABS" ] || exit 0

# If not a git repo, skip silently.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# Last commit that touched the doc.
LAST_DOC_COMMIT=$(git log -n 1 --format=%H -- "$DOC_PATH" 2>/dev/null)

# If the doc was never committed, skip — it's a fresh add, no drift possible yet.
if [ -z "$LAST_DOC_COMMIT" ]; then
  exit 0
fi

# Count commits since LAST_DOC_COMMIT that touched any watched path.
FEATURE_COMMITS=$(git log --format=%H "$LAST_DOC_COMMIT"..HEAD -- "${WATCHED[@]}" 2>/dev/null | wc -l | tr -d ' ')

if [ "$FEATURE_COMMITS" -ge "$TOLERANCE" ]; then
  printf '\n' >&2
  printf '\033[1;33m⚠ Product description drift detected\033[0m\n' >&2
  printf '   %s commits to user-visible features since %s last updated.\n' \
    "$FEATURE_COMMITS" "$DOC_PATH" >&2
  printf '   Update the matching section + section 12 (Recent Shipped) before the next ship.\n' >&2
  printf '   Recent feature commits:\n' >&2
  git log --format='     %h  %s' "$LAST_DOC_COMMIT"..HEAD -- "${WATCHED[@]}" 2>/dev/null | head -10 >&2
  printf '\n' >&2
  exit 1
fi

exit 0
