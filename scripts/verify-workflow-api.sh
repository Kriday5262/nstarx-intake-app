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
  -F "projectTitle=$FRESH_TITLE" \
  -F "description=Workflow test description with enough text to satisfy the minimum length validation rule for the intake form." \
  -F "priority=Medium" \
  "$BASE_URL/api/requests" > /dev/null
LIST_BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests")
REQUEST_ID=$(echo "$LIST_BODY" | python3 -c "import sys,json; rows=json.load(sys.stdin)['requests']; print([r for r in rows if r['projectTitle']=='$FRESH_TITLE'][0]['id'])")
echo "Target request id: $REQUEST_ID"

# ---- Criterion 3: invalid transition Submitted -> Completed rejected ----
INVALID=$(curl -sS -b "$JAR" -c "$JAR" -w "\n__STATUS__%{http_code}" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"Completed"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/status")
INVALID_STATUS=$(echo "$INVALID" | tail -1 | sed 's/__STATUS__//')
INVALID_BODY=$(echo "$INVALID" | sed '$d')
echo "Invalid transition response (status=$INVALID_STATUS): $INVALID_BODY"
if [[ "$INVALID_BODY" == *'error'* && "$INVALID_STATUS" == "400" ]]; then
  PASS=$((PASS+1))
else
  echo "  Expected error for invalid transition"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 4: valid linear flow with activity log ----
for NEXT in "In Review" "Planned" "In Progress"; do
  R=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
    -d "{\"status\":\"$NEXT\"}" "$BASE_URL/api/admin/requests/$REQUEST_ID/status")
  echo "  -> $NEXT: $R"
  if [[ "$R" == *'"ok":true'* && "$R" == *"\"status\":\"$NEXT\""* ]]; then
    PASS=$((PASS+1))
  else
    echo "    FAIL"
    FAIL=$((FAIL+1))
  fi
  sleep 0.15
done

# Move to Completed as a separate step and verify it is terminal
R=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"Completed"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/status")
echo "  -> Completed: $R"
if [[ "$R" == *'"ok":true'* && "$R" == *'"status":"Completed"'* ]]; then
  PASS=$((PASS+1))
else
  echo "    FAIL"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 5: terminal state Completed cannot be changed ----
TERMINAL=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"In Review"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/status")
echo "Terminal reject: $TERMINAL"
if [[ "$TERMINAL" == *'error'* && "$TERMINAL" != *'"ok":true'* ]]; then
  PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

# ---- Criterion 5b: Rejected from any non-terminal state is valid, and Rejected can move back to Submitted ----
REJECTED=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"Rejected"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/status")
echo "Rejected after Completed (should error): $REJECTED"
if [[ "$REJECTED" == *'error'* ]]; then
  PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

# Use a fresh request for the Rejected pivot test so the rest of the checks run on a Submitted request
PIVOT_TITLE="Workflow Pivot Test ($(date +%s%N))"
curl -sS -b "$JAR" -c "$JAR" -X POST \
  -F "fullName=Workflow Pivot" \
  -F "email=pivot@example.com" \
  -F "projectType=Other" \
  -F "projectTitle=$PIVOT_TITLE" \
  -F "description=Workflow pivot test description with enough text to satisfy the minimum length validation rule for the intake form." \
  -F "priority=Low" \
  "$BASE_URL/api/requests" > /dev/null
PIVOT_ID=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests" | python3 -c "import sys,json; d=json.load(sys.stdin); print([r['id'] for r in d['requests'] if r['projectTitle']=='$PIVOT_TITLE'][0])")
echo "Pivot test request id: $PIVOT_ID"
REJECT_EARLY=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"Rejected"}' "$BASE_URL/api/admin/requests/$PIVOT_ID/status")
echo "Reject from Submitted: $REJECT_EARLY"
if [[ "$REJECT_EARLY" == *'"ok":true'* && "$REJECT_EARLY" == *'"status":"Rejected"'* ]]; then
  PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi
RESET_SUB=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"Submitted"}' "$BASE_URL/api/admin/requests/$PIVOT_ID/status")
echo "Rejected->Submitted: $RESET_SUB"
if [[ "$RESET_SUB" == *'"ok":true'* && "$RESET_SUB" == *'"status":"Submitted"'* ]]; then
  PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi
# Continue priority/due-date/notes tests on the pivot request (now Submitted)
REQUEST_ID=$PIVOT_ID

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
