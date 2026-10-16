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

echo "=== Full clean auth verification (all 4 criteria) ==="
echo

# ---- Criterion 1: unauthenticated /dashboard redirects to /login ----
echo "Criterion 1: unauthenticated /dashboard sub-routes redirect to /login"
R1=$(curl -sS -o /dev/null -w "%{http_code}|%{redirect_url}" "$BASE_URL/dashboard")
R2=$(curl -sS -o /dev/null -w "%{http_code}|%{redirect_url}" "$BASE_URL/dashboard/settings")
echo "  /dashboard: $R1"
echo "  /dashboard/settings: $R2"
S1=${R1%%|*}
L1=${R1#*|}
S2=${R2%%|*}
L2=${R2#*|}
if [[ "$S1" == "302" || "$S1" == "303" || "$S1" == "307" ]] && [[ "$L1" == *"/login"* ]]; then
  echo "  /dashboard: PASS"
  PASS=$((PASS+1))
else
  echo "  /dashboard: FAIL (status=$S1 location=$L1)"
  FAIL=$((FAIL+1))
fi
if [[ "$S2" == "302" || "$S2" == "303" || "$S2" == "307" ]] && [[ "$L2" == *"/login"* ]]; then
  echo "  /dashboard/settings: PASS"
  PASS=$((PASS+1))
else
  echo "  /dashboard/settings: FAIL (status=$S2 location=$L2)"
  FAIL=$((FAIL+1))
fi
echo

# ---- Criterion 2: both seeded admins log in and GET /dashboard returns 200 ----
echo "Criterion 2: both seeded admins login + GET /dashboard"
declare -A ACCOUNTS=(
  ["shantanu.chaturvedi@nstarxinc.com"]="$ADMIN_SHANTANU_PASSWORD"
  ["sujay@nstarxinc.com"]="$ADMIN_SUJAY_PASSWORD"
)
for EMAIL in "shantanu.chaturvedi@nstarxinc.com" "sujay@nstarxinc.com"; do
  PWD=${ACCOUNTS[$EMAIL]}
  JAR=$(mktemp)
  LOGIN=$(curl -sS -b "$JAR" -c "$JAR" -o /dev/null -w "%{http_code}" \
    -X POST -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PWD\"}" \
    "$BASE_URL/api/admin/login")
  DASH=$(curl -sS -b "$JAR" -c "$JAR" -o /dev/null -w "%{http_code}" "$BASE_URL/dashboard")
  FULL_BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/dashboard")
  BODY=$(echo "$FULL_BODY" | head -c 800)
  rm -f "$JAR"
  echo "  $EMAIL: login=$LOGIN dashboard=$DASH"
  if [[ "$LOGIN" == "200" && "$DASH" == "200" && $(echo "$FULL_BODY" | grep -c "NStarX Intake Form") -gt 0 && $(echo "$FULL_BODY" | grep -c "Log out") -gt 0 ]]; then
    echo "    PASS"
    PASS=$((PASS+1))
  else
    echo "    FAIL (body preview: $BODY)"
    FAIL=$((FAIL+1))
  fi
done
echo

# ---- Criterion 3: wrong password vs unknown email are identical ----
echo "Criterion 3: wrong password vs unknown email responses"
set +e
A=$(curl -sS -w "\n__STATUS__%{http_code}" -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"shantanu.chaturvedi@nstarxinc.com\",\"password\":\"wrong-password-12345\"}" \
  "$BASE_URL/api/admin/login")
B=$(curl -sS -w "\n__STATUS__%{http_code}" -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"nobody@example.com\",\"password\":\"wrong-password-12345\"}" \
  "$BASE_URL/api/admin/login")
set -e
A_STATUS=$(echo "$A" | tail -1 | sed 's/__STATUS__//')
B_STATUS=$(echo "$B" | tail -1 | sed 's/__STATUS__//')
A_BODY=$(echo "$A" | sed '$d')
B_BODY=$(echo "$B" | sed '$d')
echo "  wrong-password: status=$A_STATUS body=$A_BODY"
echo "  unknown-email:  status=$B_STATUS body=$B_BODY"
if [[ "$A_STATUS" == "$B_STATUS" && "$A_BODY" == "$B_BODY" && "$A_STATUS" == "401" ]]; then
  echo "  PASS"
  PASS=$((PASS+1))
else
  echo "  FAIL"
  FAIL=$((FAIL+1))
fi
echo

# ---- Criterion 4: after logout, replaying old cookie redirects to /login ----
echo "Criterion 4: logout invalidates session, old cookie replay rejected"
JAR=$(mktemp)
rm -f "$JAR"; touch "$JAR"
curl -sS -o /dev/null -b "$JAR" -c "$JAR" -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"shantanu.chaturvedi@nstarxinc.com\",\"password\":\"$ADMIN_SHANTANU_PASSWORD\"}" \
  "$BASE_URL/api/admin/login"
OLD_TOKEN=$(awk -F'\t' 'NF==7 && $6=="admin_session" {print $7}' "$JAR")
echo "  pre-logout token length: ${#OLD_TOKEN}"
# logout
curl -sS -o /dev/null -b "$JAR" -c "$JAR" -X POST "$BASE_URL/api/admin/logout"
# replay the pre-logout cookie with a fresh jar
REPLAY_JAR=$(mktemp)
R4=$(curl -sS -o /dev/null -w "%{http_code}|%{redirect_url}" -H "Cookie: admin_session=$OLD_TOKEN" -c "$REPLAY_JAR" "$BASE_URL/dashboard")
S4=${R4%%|*}
L4=${R4#*|}
rm -f "$JAR" "$REPLAY_JAR"
echo "  replay /dashboard: status=$S4 location=$L4"
if [[ "$S4" == "302" || "$S4" == "303" || "$S4" == "307" ]] && [[ "$L4" == *"/login"* ]]; then
  echo "  PASS"
  PASS=$((PASS+1))
else
  echo "  FAIL"
  FAIL=$((FAIL+1))
fi
echo

echo "=== Summary ==="
echo "Sub-checks passed: $PASS"
echo "Sub-checks failed: $FAIL"
if [[ $FAIL -eq 0 ]]; then
  echo "All criteria PASS"
  exit 0
else
  echo "Some criteria FAIL"
  exit 1
fi
