#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/mnt/hikvision/Shantanu/Work/NStarX-Intake-App"
BASE_URL="http://127.0.0.1:8090"

cd "$APP_DIR"
set -a
source .env
set +a

PASS=0
FAIL=0

echo "=== Dashboard shell verification ==="
echo

# ---- Helpers ----
login_jar() {
  local email="$1"
  local password="$2"
  local jar="$3"
  curl -sS -o /dev/null -b "$jar" -c "$jar" -X POST -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    "$BASE_URL/api/admin/login"
}

echo "Criterion: logged-in user sees top nav and sidebar on /dashboard/requests"
JAR=$(mktemp)
login_jar "shantanu.chaturvedi@nstarxinc.com" "$ADMIN_SHANTANU_PASSWORD" "$JAR"
BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/dashboard/requests")
if echo "$BODY" | grep -q "NStarX Intake Form" && \
   echo "$BODY" | grep -q "Requests" && \
   echo "$BODY" | grep -q "Settings" && \
   echo "$BODY" | grep -q "Log out"; then
  echo "  PASS: top nav + sidebar rendered"
  PASS=$((PASS+1))
else
  echo "  FAIL: missing expected shell elements"
  echo "  body preview: $(echo "$BODY" | head -c 600)"
  FAIL=$((FAIL+1))
fi
rm -f "$JAR"
echo

echo "Criterion: user dropdown shows session user name/email"
JAR=$(mktemp)
login_jar "sujay@nstarxinc.com" "$ADMIN_SUJAY_PASSWORD" "$JAR"
BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/dashboard/settings")
if echo "$BODY" | grep -qi "sujay" && echo "$BODY" | grep -q "sujay@nstarxinc.com"; then
  echo "  PASS: dropdown shows name/email for sujay"
  PASS=$((PASS+1))
else
  echo "  FAIL: dropdown did not include expected user details"
  echo "  body preview: $(echo "$BODY" | head -c 600)"
  FAIL=$((FAIL+1))
fi
rm -f "$JAR"
echo

echo "Criterion: logout from nav ends the session"
JAR=$(mktemp)
login_jar "shantanu.chaturvedi@nstarxinc.com" "$ADMIN_SHANTANU_PASSWORD" "$JAR"
OLD_TOKEN=$(awk -F'\t' 'NF==7 && $6=="admin_session" {print $7}' "$JAR")
# Logout via the API endpoint used by the nav logout control
curl -sS -o /dev/null -b "$JAR" -c "$JAR" -X POST "$BASE_URL/api/admin/logout"
REPLAY_JAR=$(mktemp)
R=$(curl -sS -o /dev/null -w "%{http_code}|%{redirect_url}" -H "Cookie: admin_session=$OLD_TOKEN" -c "$REPLAY_JAR" "$BASE_URL/dashboard")
S=${R%%|*}
L=${R#*|}
rm -f "$JAR" "$REPLAY_JAR"
if [[ "$S" == "302" || "$S" == "303" || "$S" == "307" ]] && [[ "$L" == *"/login"* ]]; then
  echo "  PASS: logout invalidated session, replay redirected to /login"
  PASS=$((PASS+1))
else
  echo "  FAIL: replay status=$S location=$L"
  FAIL=$((FAIL+1))
fi
echo

echo "Criterion: mobile hamburger toggle present in shell markup"
JAR=$(mktemp)
login_jar "shantanu.chaturvedi@nstarxinc.com" "$ADMIN_SHANTANU_PASSWORD" "$JAR"
BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/dashboard")
if echo "$BODY" | grep -q "Open navigation" && echo "$BODY" | grep -q "aria-expanded"; then
  echo "  PASS: hamburger toggle present"
  PASS=$((PASS+1))
else
  echo "  FAIL: mobile toggle missing"
  FAIL=$((FAIL+1))
fi
rm -f "$JAR"
echo

echo "Criterion: active sidebar link highlighted on /dashboard/requests and /dashboard/settings"
for path in /dashboard/requests /dashboard/settings; do
  JAR=$(mktemp)
  login_jar "shantanu.chaturvedi@nstarxinc.com" "$ADMIN_SHANTANU_PASSWORD" "$JAR"
  B=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL$path")
  label=$(basename "$path" | sed 's/.*/\u&/')
  # The active link carries the bg-brand-purple/10 class; check both label and active class
  if echo "$B" | grep -q "bg-brand-purple/10" && echo "$B" | grep -q "$label"; then
    echo "  $path: PASS (active link highlighted)"
    PASS=$((PASS+1))
  else
    echo "  $path: FAIL"
    FAIL=$((FAIL+1))
  fi
  rm -f "$JAR"
done
echo

echo "=== Summary ==="
echo "Sub-checks passed: $PASS"
echo "Sub-checks failed: $FAIL"
if [[ $FAIL -eq 0 ]]; then
  echo "All dashboard shell criteria PASS"
  exit 0
else
  echo "Some dashboard shell criteria FAIL"
  exit 1
fi
