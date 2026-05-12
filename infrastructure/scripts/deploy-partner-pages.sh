#!/usr/bin/env bash
# Deploy the partner landing pages + PWA preview from myorbisresults.com/ to
# Spaceship FTP, which publishes them under https://myorbisvoice.com/.
#
# Used for /p/sample/voice-{1,2,3}/ + /preview/ + their required assets.
# Does NOT touch assets/css/style.css (already deployed, identical on disk).
#
# Credentials live in ~/.netrc (mode 600). See deploy-marketing.sh header.
#
# Usage:
#   ./infrastructure/scripts/deploy-partner-pages.sh            # upload
#   ./infrastructure/scripts/deploy-partner-pages.sh dry-run    # list files only
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC_DIR="$REPO_ROOT/myorbisresults.com"
HOST="server43.shared.spaceship.host"
FTP_BASE="ftp://${HOST}"

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }

[[ -f ~/.netrc ]] || { red "❌ ~/.netrc not found"; exit 1; }
[[ "$(stat -c '%a' ~/.netrc)" == "600" ]] || { red "❌ ~/.netrc must be mode 600"; exit 1; }
[[ -d "$SRC_DIR" ]] || { red "❌ Source dir not found: $SRC_DIR"; exit 1; }

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
    exit 0
    ;;
  deploy|"")
    : # fall through
    ;;
  *)
    red "Unknown mode: $1"; echo "Usage: $0 [deploy|dry-run]"; exit 1
    ;;
esac

bold "═══ Deploying partner pages + PWA to $HOST ═══"
echo "  Files to upload: ${#FILES[@]}"
echo

SUCCESS=0
FAILED=0
cd "$SRC_DIR"
for i in "${!FILES[@]}"; do
  REL="${FILES[$i]}"
  N=$((i + 1))
  printf "  [%2d/%2d] %s ... " "$N" "${#FILES[@]}" "$REL"
  if curl --netrc --ssl-reqd -k -s --connect-timeout 15 -m 120 \
       --ftp-create-dirs -T "$REL" "$FTP_BASE/$REL" 2>/dev/null; then
    green "ok"
    SUCCESS=$((SUCCESS + 1))

    # Per-partner URL mirroring: also push partner-page HTML to /p/<slug>/ paths
    # so each active Partner record has working URLs derived from their slug.
    # The page content is identical (the JS reads the slug from the URL); we
    # just need the file present at every <slug>/ path.
    case "$REL" in
      p/sample/voice-*/index.html|es/p/sample/voice-*/index.html)
        for SLUG in alex.rivera; do
          MIRROR="${REL/\/sample\//\/$SLUG\/}"
          printf "        ↳ mirror: %s ... " "$MIRROR"
          if curl --netrc --ssl-reqd -k -s --connect-timeout 15 -m 120 \
               --ftp-create-dirs -T "$REL" "$FTP_BASE/$MIRROR" 2>/dev/null; then
            green "ok"
            SUCCESS=$((SUCCESS + 1))
          else
            red "FAILED"
            FAILED=$((FAILED + 1))
          fi
        done
        ;;
    esac
  else
    red "FAILED"
    FAILED=$((FAILED + 1))
  fi
done

echo
bold "═══ Result ═══"
green "  ✓ uploaded: $SUCCESS"
[[ $FAILED -gt 0 ]] && red "  ✗ failed:   $FAILED"
echo
echo "Live URLs:"
echo "  https://myorbisvoice.com/p/sample/voice-1/"
echo "  https://myorbisvoice.com/p/sample/voice-2/"
echo "  https://myorbisvoice.com/p/sample/voice-3/"
echo "  https://myorbisvoice.com/preview/"

[[ $FAILED -eq 0 ]]
