#!/usr/bin/env bash
# Deploy the partner landing pages + PWA preview from myorbisresults.com/
# (the local source dir) to one or more Spaceship FTP destinations.
#
# The primary destination is the myorbisvoice.com hosting docroot (always on).
# An optional secondary destination mirrors the same files to the
# myorbisresults.com docroot, so partner pages are reachable at BOTH brand URLs.
#
# Secondary destination is opt-in via env vars (no Spaceship setup yet ==
# secondary upload is silently skipped, deploys stay green):
#
#   MOR_FTP_HOST       — FTP host for myorbisresults.com docroot
#                        (typically same Spaceship shared host, e.g.
#                        server43.shared.spaceship.host)
#   MOR_FTP_NETRC_HOST — host key under which the FTP user is stored in
#                        ~/.netrc (if different from MOR_FTP_HOST — most
#                        users will leave this unset so it defaults to
#                        MOR_FTP_HOST)
#
# Both vars must be set for the secondary upload to fire. The corresponding
# ~/.netrc entry must exist; curl --netrc will read user/password from there.
#
# Used for /p/sample/voice-{1,2,3}/ + /preview/ + their required assets.
# Does NOT touch assets/css/style.css (already deployed, identical on disk).
#
# Credentials live in ~/.netrc (mode 600). See deploy-marketing.sh header.
#
# Usage:
#   ./infrastructure/scripts/deploy-partner-pages.sh            # upload
#   ./infrastructure/scripts/deploy-partner-pages.sh dry-run    # list files only
#   MOR_FTP_HOST=server43.shared.spaceship.host \
#     ./infrastructure/scripts/deploy-partner-pages.sh          # mirror to both
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC_DIR="$REPO_ROOT/myorbisresults.com"

# Primary destination — myorbisvoice.com hosting (always on)
PRIMARY_HOST="server43.shared.spaceship.host"
PRIMARY_LABEL="myorbisvoice.com"

# Secondary destination — myorbisresults.com hosting (opt-in)
SECONDARY_HOST="${MOR_FTP_HOST:-}"
SECONDARY_NETRC_HOST="${MOR_FTP_NETRC_HOST:-$SECONDARY_HOST}"
SECONDARY_LABEL="myorbisresults.com"

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$*"; }

[[ -f ~/.netrc ]] || { red "❌ ~/.netrc not found"; exit 1; }
[[ "$(stat -c '%a' ~/.netrc)" == "600" ]] || { red "❌ ~/.netrc must be mode 600"; exit 1; }
[[ -d "$SRC_DIR" ]] || { red "❌ Source dir not found: $SRC_DIR"; exit 1; }

# If secondary is requested, verify a matching ~/.netrc entry exists.
# `grep -q` on `machine $SECONDARY_NETRC_HOST` — if missing, fail fast with
# a clear message rather than silently no-op'ing the secondary upload.
if [[ -n "$SECONDARY_HOST" ]]; then
  if ! grep -qE "^machine[[:space:]]+${SECONDARY_NETRC_HOST}([[:space:]]|$)" ~/.netrc; then
    red "❌ MOR_FTP_HOST is set ($SECONDARY_HOST) but no matching"
    red "    'machine $SECONDARY_NETRC_HOST ...' entry found in ~/.netrc."
    red "    Add an entry for the myorbisresults.com FTP user, or unset"
    red "    MOR_FTP_HOST to skip secondary upload."
    exit 1
  fi
fi

# Curated upload list (paths relative to $SRC_DIR; same paths on FTP root)
FILES=(
  # Shared partner-page hydration script — fetches live partner data from API
  # + overlays the bootstrap content. Same script used by all 6 partner pages.
  "p/_assets/partner-hydrate.js"
  # Partner landing pages — English
  "p/sample/voice-1/index.html"
  "p/sample/voice-2/index.html"
  "p/sample/voice-3/index.html"
  # Partner landing pages — Spanish mirrors
  "es/p/sample/voice-1/index.html"
  "es/p/sample/voice-2/index.html"
  "es/p/sample/voice-3/index.html"
  # PWA preview (single install, bilingual via i18n toggle)
  "preview/index.html"
  "preview/manifest.json"
  "preview/sw.js"
  "preview/assets/css/preview.css"
  "preview/assets/js/app.js"
  "preview/data/beauty.json"
  "preview/data/coaching.json"
  "preview/data/dental.json"
  "preview/data/fitness.json"
  "preview/data/home-services.json"
  "preview/data/legal.json"
  "preview/data/medical.json"
  "preview/data/real-estate.json"
  # Images referenced by the partner pages
  "assets/images/case-studies/bright-smile-dental.jpg"
  "assets/images/case-studies/queen-umoja-studio.jpg"
  "assets/images/case-studies/valley-hvac.jpg"
  "assets/images/partners/sample-partner.jpg"
)

# Verify every file exists locally before any upload starts
for REL in "${FILES[@]}"; do
  [[ -f "$SRC_DIR/$REL" ]] || { red "❌ Missing: $SRC_DIR/$REL"; exit 1; }
done

case "${1:-deploy}" in
  dry-run)
    bold "═══ Would upload these ${#FILES[@]} files ═══"
    for REL in "${FILES[@]}"; do
      size=$(stat -c '%s' "$SRC_DIR/$REL")
      printf "  %8d  %s\n" "$size" "$REL"
    done
    echo
    bold "═══ Destinations ═══"
    echo "  ✓ $PRIMARY_LABEL → $PRIMARY_HOST"
    if [[ -n "$SECONDARY_HOST" ]]; then
      echo "  ✓ $SECONDARY_LABEL → $SECONDARY_HOST (via netrc host: $SECONDARY_NETRC_HOST)"
    else
      yellow "  · $SECONDARY_LABEL → SKIPPED (set MOR_FTP_HOST to enable mirror)"
    fi
    exit 0
    ;;
  deploy|"")
    : # fall through
    ;;
  *)
    red "Unknown mode: $1"; echo "Usage: $0 [deploy|dry-run]"; exit 1
    ;;
esac

# Build the list of (label, host, netrc-host) tuples we'll upload to.
# Bash 3 has no associative arrays, so we keep parallel arrays.
DEST_LABELS=("$PRIMARY_LABEL")
DEST_HOSTS=("$PRIMARY_HOST")
DEST_NETRC_HOSTS=("$PRIMARY_HOST")
if [[ -n "$SECONDARY_HOST" ]]; then
  DEST_LABELS+=("$SECONDARY_LABEL")
  DEST_HOSTS+=("$SECONDARY_HOST")
  DEST_NETRC_HOSTS+=("$SECONDARY_NETRC_HOST")
fi

bold "═══ Deploying partner pages + PWA to ${#DEST_HOSTS[@]} destination(s) ═══"
for i in "${!DEST_HOSTS[@]}"; do
  echo "  → ${DEST_LABELS[$i]}: ${DEST_HOSTS[$i]}"
done
echo "  Files per destination: ${#FILES[@]}"
echo

SUCCESS=0
FAILED=0
cd "$SRC_DIR"

# upload_to <netrc-host> <ftp-host> <local-rel-path> <remote-rel-path>
# Returns 0 on success, non-zero on failure. Uses --netrc to look up
# credentials under the netrc-host key (which may differ from the ftp-host).
upload_to() {
  local NETRC_HOST="$1"
  local FTP_HOST="$2"
  local LOCAL_REL="$3"
  local REMOTE_REL="$4"
  curl --netrc \
       --connect-to "${NETRC_HOST}:21:${FTP_HOST}:21" \
       --ssl-reqd -k -s --connect-timeout 15 -m 120 \
       --ftp-create-dirs -T "$LOCAL_REL" "ftp://${NETRC_HOST}/${REMOTE_REL}" 2>/dev/null
}

for i in "${!FILES[@]}"; do
  REL="${FILES[$i]}"
  N=$((i + 1))
  printf "  [%2d/%2d] %s\n" "$N" "${#FILES[@]}" "$REL"

  for d in "${!DEST_HOSTS[@]}"; do
    LABEL="${DEST_LABELS[$d]}"
    HOST="${DEST_HOSTS[$d]}"
    NETRC_HOST="${DEST_NETRC_HOSTS[$d]}"
    printf "          → %-22s ... " "$LABEL"
    if upload_to "$NETRC_HOST" "$HOST" "$REL" "$REL"; then
      green "ok"
      SUCCESS=$((SUCCESS + 1))
    else
      red "FAILED"
      FAILED=$((FAILED + 1))
    fi

    # Per-partner URL mirroring: also push partner-page HTML to /p/<slug>/ paths
    # so each active Partner record has working URLs derived from their slug.
    # The page content is identical (the JS reads the slug from the URL); we
    # just need the file present at every <slug>/ path.
    case "$REL" in
      p/sample/voice-*/index.html|es/p/sample/voice-*/index.html)
        for SLUG in alex.rivera; do
          MIRROR="${REL/\/sample\//\/$SLUG\/}"
          printf "            ↳ slug mirror: %-50s → %s ... " "$MIRROR" "$LABEL"
          if upload_to "$NETRC_HOST" "$HOST" "$REL" "$MIRROR"; then
            green "ok"
            SUCCESS=$((SUCCESS + 1))
          else
            red "FAILED"
            FAILED=$((FAILED + 1))
          fi
        done
        ;;
    esac
  done
done

echo
bold "═══ Result ═══"
green "  ✓ uploaded: $SUCCESS"
[[ $FAILED -gt 0 ]] && red "  ✗ failed:   $FAILED"
echo
echo "Live URLs (primary):"
echo "  https://myorbisvoice.com/p/sample/voice-1/"
echo "  https://myorbisvoice.com/p/sample/voice-2/"
echo "  https://myorbisvoice.com/p/sample/voice-3/"
echo "  https://myorbisvoice.com/preview/"
if [[ -n "$SECONDARY_HOST" ]]; then
  echo
  echo "Live URLs (secondary — once Cloudflare DNS apex A record is added):"
  echo "  https://myorbisresults.com/p/sample/voice-1/"
  echo "  https://myorbisresults.com/p/sample/voice-2/"
  echo "  https://myorbisresults.com/p/sample/voice-3/"
  echo "  https://myorbisresults.com/preview/"
fi

[[ $FAILED -eq 0 ]]
