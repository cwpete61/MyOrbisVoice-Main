#!/usr/bin/env bash
# verify.sh — smoke-test the live site and print pass/fail for each check
# Usage: ./infrastructure/scripts/verify.sh
set -uo pipefail

PASS=0
FAIL=0
WARN=0

green() { echo "  ✅  $*"; ((PASS++)); }
red()   { echo "  ❌  $*"; ((FAIL++)); }
warn()  { echo "  ⚠️   $*"; ((WARN++)); }

check_http() {
  local label="$1" url="$2" expect="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$url")
  if echo "$code" | grep -qE "^($expect)$"; then green "$label ($code)"; else red "$label — got $code, want $expect"; fi
}

check_body() {
  local label="$1" url="$2" pattern="$3"
  local body
  body=$(curl -s --max-time 8 "$url")
  if echo "$body" | grep -q "$pattern"; then green "$label"; else red "$label — pattern '$pattern' not found in response"; fi
}

echo ""
echo "=== MyOrbisVoice Live Verification ==="
echo "$(date)"
echo ""

echo "── API"
check_body  "GET /health → ok"                "https://api.myorbisvoice.com/health"       '"status":"ok"'
check_body  "GET /health → database ok"       "https://api.myorbisvoice.com/health"       '"database":"ok"'
check_body  "GET /health → redis ok"          "https://api.myorbisvoice.com/health"       '"redis":"ok"'
check_http  "GET /api/billing/plans → 200"    "https://api.myorbisvoice.com/api/billing/plans"

echo ""
echo "── Web"
check_http  "Login page loads"                "https://app.myorbisvoice.com/login"
check_http  "Root redirects to login (307)"    "https://app.myorbisvoice.com"              "307"

echo ""
echo "── Gateway"
check_body  "GET /health → ok"                "https://gateway.myorbisvoice.com/health"   '"status":"ok"'
check_http  "Widget JS served"                "https://gateway.myorbisvoice.com/widget/orbisvoice-widget.js"

echo ""
echo "── API URL in web bundle (must NOT be localhost)"
BUNDLE_CHECK=$(curl -s --max-time 10 "https://app.myorbisvoice.com" | grep -o 'localhost:4000' | head -1)
if [[ -z "$BUNDLE_CHECK" ]]; then
  green "No localhost:4000 in HTML response"
else
  red "localhost:4000 found in HTML — web is pointing to local API"
fi

echo ""
echo "────────────────────────────────────"
echo "  Passed: $PASS  Failed: $FAIL  Warnings: $WARN"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo "  ACTION REQUIRED: $FAIL check(s) failed. Do not deploy until resolved."
  exit 1
else
  echo "  All checks passed. Safe to proceed."
fi
