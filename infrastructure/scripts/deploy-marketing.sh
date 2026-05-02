#!/usr/bin/env bash
# Deploy the marketing site (site/) to Spaceship via FTPS.
#
# Credentials live in ~/.netrc (mode 600), NOT in the repo. Format:
#   machine server43.shared.spaceship.host
#   login MyOrbisVoice@377ee9cb-...spacecharged.site
#   password <FTP_PASSWORD>
#
# Usage:
#   ./infrastructure/scripts/deploy-marketing.sh           # upload everything
#   ./infrastructure/scripts/deploy-marketing.sh dry-run   # list local files only
#   ./infrastructure/scripts/deploy-marketing.sh remote    # show remote tree
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="$REPO_ROOT/site"
HOST="server43.shared.spaceship.host"
FTP_BASE="ftp://${HOST}"

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }

# Sanity checks
[[ -f ~/.netrc ]] || { red "❌ ~/.netrc not found. See script header for format."; exit 1; }
[[ "$(stat -c '%a' ~/.netrc)" == "600" ]] || { red "❌ ~/.netrc must be mode 600 (run: chmod 600 ~/.netrc)"; exit 1; }
[[ -d "$SITE_DIR" ]] || { red "❌ Site directory not found: $SITE_DIR"; exit 1; }

curl_ftp() { curl --netrc --ssl-reqd -k -s --connect-timeout 15 -m 60 "$@"; }

case "${1:-deploy}" in
  remote)
    bold "═══ Remote tree ═══"
    curl_ftp "$FTP_BASE/"
    exit 0
    ;;
  dry-run)
    bold "═══ Files that WOULD be uploaded ═══"
    cd "$SITE_DIR"
    find . -type f ! -name "*.zip" -printf '%P\n' | sort
    exit 0
    ;;
  deploy|"")
    : # fall through
    ;;
  *)
    red "Unknown mode: $1"
    echo "Usage: $0 [deploy|dry-run|remote]"
    exit 1
    ;;
esac

bold "═══ Deploying marketing site to $HOST ═══"
cd "$SITE_DIR"

# Build a list of files to upload (skip zip archives + hidden files)
mapfile -t FILES < <(find . -type f ! -name "*.zip" ! -name ".*" -printf '%P\n' | sort)
TOTAL=${#FILES[@]}
echo "  Files to upload: $TOTAL"
echo

# Pre-create any directories the upload needs (curl --ftp-create-dirs handles this for us,
# but listing is faster than blindly retrying for each file).
SUCCESS=0
FAILED=0
for i in "${!FILES[@]}"; do
  REL="${FILES[$i]}"
  N=$((i + 1))
  printf "  [%2d/%2d] %s ... " "$N" "$TOTAL" "$REL"
  if curl --netrc --ssl-reqd -k -s --connect-timeout 15 -m 60 \
       --ftp-create-dirs -T "$REL" "$FTP_BASE/$REL" 2>/dev/null; then
    green "ok"
    SUCCESS=$((SUCCESS + 1))
  else
    red "FAILED"
    FAILED=$((FAILED + 1))
  fi
done

echo
bold "═══ Summary ═══"
echo "  Uploaded: $SUCCESS / $TOTAL"
[[ $FAILED -eq 0 ]] && green "  All files uploaded successfully" || red "  $FAILED file(s) failed — check output above"
echo
echo "  Verify at https://myorbisvoice.com (may take a minute for CDN to update)"

[[ $FAILED -eq 0 ]] || exit 1
