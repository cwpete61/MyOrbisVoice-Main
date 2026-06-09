#!/usr/bin/env bash
# Deploy the MyOrbisResults marketing site (the new design-system pages under
# myorbisresults.com/) to the myorbisresults.com Spaceship docroot ONLY.
#
# IMPORTANT: unlike deploy-partner-pages.sh (which mirrors a curated /p/ +
# /preview/ subset to BOTH brand docroots), this script uploads ROOT pages
# (index.html, problem/, system/, ...). Those must NOT land on the
# myorbisvoice.com docroot or they'd clobber that site's homepage — so this
# script has a SINGLE destination: the myorbisresults.com FTP user.
#
# Credentials: ~/.netrc (mode 600), alias `myorbisresults.ftp` routed to the
# real Spaceship host via curl --connect-to. See deploy-partner-pages.sh header.
#
# Usage:
#   ./infrastructure/scripts/deploy-mor-site.sh dry-run   # list, no upload
#   ./infrastructure/scripts/deploy-mor-site.sh           # upload
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC_DIR="$REPO_ROOT/myorbisresults.com"

NETRC_HOST="${MOR_FTP_NETRC_HOST:-myorbisresults.ftp}"
FTP_HOST="${MOR_FTP_HOST:-server43.shared.spaceship.host}"
LABEL="myorbisresults.com"

red()    { printf '\033[31m%s\033[0m\n' "$1"; }
green()  { printf '\033[32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }
bold()   { printf '\033[1m%s\033[0m\n' "$1"; }

FILES=(
  # English pages
  "index.html"
  "problem/index.html"
  "system/index.html"
  "industries/index.html"
  "solutions/index.html"
  "pricing/index.html"
  "partners/index.html"
  # Spanish pages
  "es/index.html"
  "es/problem/index.html"
  "es/system/index.html"
  "es/industries/index.html"
  "es/solutions/index.html"
  "es/pricing/index.html"
  "es/partners/index.html"
  # Styles + widget loader
  "assets/css/orbis.css"
  "assets/css/mor.css"
  "assets/js/orby.js"
  # Favicons / icons / logo / social / hero
  "assets/favicon.ico"
  "assets/favicon-16x16.png"
  "assets/favicon-32x32.png"
  "assets/apple-touch-icon.png"
  "assets/icon-192.png"
  "assets/icon-512.png"
  "assets/logo-mark.png"
  "assets/logo.png"
  "assets/og-image.png"
  "assets/hero-bg.jpg"
  # Hero video + poster (added 2026-05-29)
  "assets/videos/orby-explainer.mp4"
  "assets/videos/orby-poster.jpg"
  # Spanish hero video + poster (added 2026-05-30)
  "assets/videos/orby-explainer-es.mp4"
  "assets/videos/orby-poster-es.jpg"
  # PWA manifest
  "site.webmanifest"
  "privacy/index.html"
  "terms/index.html"
  "cookies/index.html"
  "es/privacy/index.html"
  "es/terms/index.html"
  "es/cookies/index.html"
)

[[ -f ~/.netrc ]] || { red "❌ ~/.netrc not found"; exit 1; }
[[ "$(stat -c '%a' ~/.netrc)" == "600" ]] || { red "❌ ~/.netrc must be mode 600"; exit 1; }
grep -qE "^machine[[:space:]]+${NETRC_HOST}([[:space:]]|$)" ~/.netrc \
  || { red "❌ No 'machine ${NETRC_HOST}' entry in ~/.netrc"; exit 1; }

for REL in "${FILES[@]}"; do
  [[ -f "$SRC_DIR/$REL" ]] || { red "❌ Missing: $SRC_DIR/$REL"; exit 1; }
done

if [[ "${1:-deploy}" == "dry-run" ]]; then
  bold "═══ Would upload ${#FILES[@]} files → $LABEL ($FTP_HOST) ═══"
  for REL in "${FILES[@]}"; do
    printf "  %8d  %s\n" "$(stat -c '%s' "$SRC_DIR/$REL")" "$REL"
  done
  exit 0
fi

upload_to() {
  curl --netrc \
       --connect-to "${NETRC_HOST}:21:${FTP_HOST}:21" \
       --ssl-reqd -k -s --connect-timeout 15 -m 120 \
       --ftp-create-dirs -T "$1" "ftp://${NETRC_HOST}/$2"
}

bold "═══ Deploying MyOrbisResults site → $LABEL ($FTP_HOST) ═══"
echo "  Files: ${#FILES[@]}"
echo
cd "$SRC_DIR"
SUCCESS=0; FAILED=0
for i in "${!FILES[@]}"; do
  REL="${FILES[$i]}"
  printf "  [%2d/%2d] %-34s ... " "$((i+1))" "${#FILES[@]}" "$REL"
  if upload_to "$REL" "$REL"; then green "ok"; SUCCESS=$((SUCCESS+1)); else red "FAIL"; FAILED=$((FAILED+1)); fi
done
echo
bold "═══ Done: $SUCCESS ok, $FAILED failed ═══"
[[ "$FAILED" -eq 0 ]] || exit 1

echo
bold "═══ Verify ═══"
title="$(curl -s "https://$LABEL/" | grep -oiE '<title>[^<]*</title>' | head -1)"
echo "  homepage title: ${title:-<none>}"
for p in / /problem/ /system/ /industries/ /solutions/ /pricing/ /partners/ /es/ /es/problem/ /es/system/ /es/industries/ /es/solutions/ /es/pricing/ /es/partners/; do
  printf "  %-22s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' "https://$LABEL$p")"
done
