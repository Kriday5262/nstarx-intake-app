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

JAR=$(mktemp)
rm -f "$JAR"; touch "$JAR"

echo "=== Admin request workflow API verification ==="

# ---- Login ----
LOGIN_STATUS=$(curl -sS -b "$JAR" -c "$JAR" -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"shantanu.chaturvedi@nstarxinc.com\",\"password\":\"$ADMIN_SHANTANU_PASSWORD\"}" \
  "$BASE_URL/api/admin/login")
echo "Login: $LOGIN_STATUS"
if [[ "$LOGIN_STATUS" == "200" ]]; then
  PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

# ---- Criterion 1: GET /api/admin/requests unauthenticated should redirect ----
UNAUTH_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/api/admin/requests")
echo "Unauthenticated list status: $UNAUTH_STATUS"
if [[ "$UNAUTH_STATUS" == "307" || "$UNAUTH_STATUS" == "302" || "$UNAUTH_STATUS" == "303" ]]; then
  PASS=$((PASS+1))
else
  echo "  Expected redirect (307) but got $UNAUTH_STATUS"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 2: list authenticated returns JSON array ----
LIST_BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests")
echo "Authenticated list: ${LIST_BODY:0:120}..."
if [[ "$LIST_BODY" == *'"requests":'* ]]; then
  PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

# ---- Create a fresh Submitted request for deterministic workflow tests ----
FRESH_TITLE="Workflow API Test ($(date +%s%N))"
curl -sS -b "$JAR" -c "$JAR" -X POST \
  -F "fullName=Workflow Verifier" \
  -F "email=workflow@example.com" \
  -F "projectType=Other" \
  -F "brandingDirection=NStarX" \
  -F "projectTitle=$FRESH_TITLE" \
  -F "description=Workflow test description with enough text to satisfy the minimum length validation rule for the intake form." \
  -F "priority=Medium" \
  "$BASE_URL/api/requests" > /dev/null
LIST_BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests")
REQUEST_ID=$(echo "$LIST_BODY" | python3 -c "import sys,json; rows=json.load(sys.stdin)['requests']; print([r for r in rows if r['projectTitle']=='$FRESH_TITLE'][0]['id'])")
echo "Target request id: $REQUEST_ID"

# ---- Criterion 3: freeform status - any transition succeeds ----
for NEXT in "In Review" "Not Started" "In Progress" "Completed" "Rejected" "Submitted"; do
  R=$(curl -sS -b "$JAR" -c "$JAR" -w "\n__STATUS__%{http_code}" -X PATCH -H "Content-Type: application/json" \
    -d "{\"status\":\"$NEXT\"}" "$BASE_URL/api/admin/requests/$REQUEST_ID/status")
  R_STATUS=$(echo "$R" | tail -1 | sed 's/__STATUS__//')
  R_BODY=$(echo "$R" | sed '$d')
  echo "  -> $NEXT (status=$R_STATUS): $R_BODY"
  if [[ "$R_STATUS" == "200" && "$R_BODY" == *'"ok":true'* && "$R_BODY" == *"\"status\":\"$NEXT\""* ]]; then
    PASS=$((PASS+1))
  else
    echo "    FAIL"
    FAIL=$((FAIL+1))
  fi
  sleep 0.15
done

# ---- Criterion 4: freeform backwards from Completed to any open status ----
BACK=$(curl -sS -b "$JAR" -c "$JAR" -w "\n__STATUS__%{http_code}" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"Submitted"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/status")
BACK_STATUS=$(echo "$BACK" | tail -1 | sed 's/__STATUS__//')
BACK_BODY=$(echo "$BACK" | sed '$d')
echo "Backwards from Completed -> Submitted (status=$BACK_STATUS): $BACK_BODY"
if [[ "$BACK_STATUS" == "200" && "$BACK_BODY" == *'"ok":true'* && "$BACK_BODY" == *'"status":"Submitted"'* ]]; then
  PASS=$((PASS+1))
else
  echo "  FAIL"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 5: Rejected from any state and back to any state ----
REJ=$(curl -sS -b "$JAR" -c "$JAR" -w "\n__STATUS__%{http_code}" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"Rejected"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/status")
REJ_STATUS=$(echo "$REJ" | tail -1 | sed 's/__STATUS__//')
REJ_BODY=$(echo "$REJ" | sed '$d')
echo "Rejected from Submitted (status=$REJ_STATUS): $REJ_BODY"
if [[ "$REJ_STATUS" == "200" && "$REJ_BODY" == *'"ok":true'* && "$REJ_BODY" == *'"status":"Rejected"'* ]]; then
  PASS=$((PASS+1))
else
  echo "  FAIL"
  FAIL=$((FAIL+1))
fi
BACK_REJ=$(curl -sS -b "$JAR" -c "$JAR" -w "\n__STATUS__%{http_code}" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"In Progress"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/status")
BACK_REJ_STATUS=$(echo "$BACK_REJ" | tail -1 | sed 's/__STATUS__//')
BACK_REJ_BODY=$(echo "$BACK_REJ" | sed '$d')
echo "Rejected -> In Progress (status=$BACK_REJ_STATUS): $BACK_REJ_BODY"
if [[ "$BACK_REJ_STATUS" == "200" && "$BACK_REJ_BODY" == *'"ok":true'* && "$BACK_REJ_BODY" == *'"status":"In Progress"'* ]]; then
  PASS=$((PASS+1))
else
  echo "  FAIL"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 6: update priority writes activity ----
PRIO=$(curl -sS -b "$JAR" -c "$JAR" -w "\n__STATUS__%{http_code}" -X PATCH -H "Content-Type: application/json" \
  -d '{"priority":"High"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/priority")
PRIO_STATUS=$(echo "$PRIO" | tail -1 | sed 's/__STATUS__//')
PRIO_BODY=$(echo "$PRIO" | sed '$d')
echo "Priority update ($PRIO_STATUS): $PRIO_BODY"
if [[ "$PRIO_BODY" == *'"ok":true'* && "$PRIO_BODY" == *'"priority":"High"'* && "$PRIO_STATUS" == "200" ]]; then
  PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

# ---- Criterion 7: update due date writes activity ----
DUE=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"dueDate":"2026-12-25"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/due-date")
echo "Due date update: $DUE"
if [[ "$DUE" == *'"ok":true'* && "$DUE" == *'"dueDate":"2026-12-25"'* ]]; then
  PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

# ---- Criterion 8: save notes and round-trip ----
NOTES=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"notes":"Sample internal note"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/notes")
echo "Notes update: $NOTES"
NOTES_GET=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests/$REQUEST_ID/notes")
echo "Notes GET: $NOTES_GET"
if [[ "$NOTES" == *'"ok":true'* && "$NOTES_GET" == *'"notes":"Sample internal note"'* ]]; then
  PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

# ---- Criterion 9: activity log contains all expected entries ----
ACTIVITY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests/$REQUEST_ID/activity")
echo "Activity log: ${ACTIVITY:0:1200}"
EXPECTED_FIELDS=("status" "priority" "due_date" "internal_notes")
for FIELD in "${EXPECTED_FIELDS[@]}"; do
  if [[ "$ACTIVITY" == *"\"field\":\"$FIELD\""* ]]; then
    PASS=$((PASS+1))
  else
    echo "  Missing activity entry for field=$FIELD"
    FAIL=$((FAIL+1))
  fi
done

rm -f "$JAR"

echo ""
echo "=== Summary ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
if [[ $FAIL -eq 0 ]]; then
  echo "All workflow API criteria PASS"
  exit 0
else
  echo "Some workflow API criteria FAIL"
  exit 1
fi
# End of script
