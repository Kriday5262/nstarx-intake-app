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

echo "=== Request detail page verification ==="

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

# ---- Create a fresh Submitted request for deterministic detail tests ----
FRESH_TITLE="Request Detail Test ($(date +%s%N))"
curl -sS -b "$JAR" -c "$JAR" -X POST \
  -F "fullName=Detail Verifier" \
  -F "email=detail@example.com" \
  -F "department=Marketing" \
  -F "projectType=Other" \
  -F "projectTitle=$FRESH_TITLE" \
  -F "description=Detail page verification description with enough text to satisfy the minimum length validation rule for the intake form." \
  -F "priority=Medium" \
  "$BASE_URL/api/requests" > /dev/null
LIST_BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests")
REQUEST_ID=$(echo "$LIST_BODY" | python3 -c "import sys,json; rows=json.load(sys.stdin)['requests']; print([r for r in rows if r['projectTitle']=='$FRESH_TITLE'][0]['id'])")
echo "Target request id: $REQUEST_ID"

# ---- Criterion 1: detail page renders every submitted field and has back link ----
DETAIL_HTML=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/dashboard/requests/$REQUEST_ID")
echo "Detail page length: ${#DETAIL_HTML}"
if [[ "$DETAIL_HTML" == *"Request details"* \
   && "$DETAIL_HTML" == *"Back to requests"* \
   && "$DETAIL_HTML" == *"Description"* \
   && "$DETAIL_HTML" == *"Requester"* \
   && "$DETAIL_HTML" == *"Email"* \
   && "$DETAIL_HTML" == *"Department"* \
   && "$DETAIL_HTML" == *"Project type"* \
   && "$DETAIL_HTML" == *"Desired deadline"* \
   && "$DETAIL_HTML" == *"Submitted"* ]]; then
  echo "Detail page renders submitted fields: PASS"
  PASS=$((PASS+1))
else
  echo "Detail page renders submitted fields: FAIL"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 2: unauthenticated detail page redirects to /login ----
UNAUTH=$(curl -sS -o /dev/null -w "%{http_code}|%{redirect_url}" "$BASE_URL/dashboard/requests/$REQUEST_ID")
S=${UNAUTH%%|*}
L=${UNAUTH#*|}
echo "Unauthenticated detail: status=$S location=$L"
if [[ "$S" == "307" || "$S" == "302" || "$S" == "303" ]] && [[ "$L" == *"/login"* ]]; then
  echo "Unauthenticated redirect: PASS"
  PASS=$((PASS+1))
else
  echo "Unauthenticated redirect: FAIL"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 3: invalid transition is blocked server-side and shows error ----
INVALID=$(curl -sS -b "$JAR" -c "$JAR" -w "\n__STATUS__%{http_code}" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"Completed"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/status")
INVALID_STATUS=$(echo "$INVALID" | tail -1 | sed 's/__STATUS__//')
INVALID_BODY=$(echo "$INVALID" | sed '$d')
echo "Invalid transition (status=$INVALID_STATUS): ${INVALID_BODY:0:200}"
if [[ "$INVALID_STATUS" == "400" && "$INVALID_BODY" == *'error'* ]]; then
  echo "Invalid transition blocked: PASS"
  PASS=$((PASS+1))
else
  echo "Invalid transition blocked: FAIL"
  FAIL=$((FAIL+1))
fi

# Verify request still Submitted after invalid attempt
CURRENT_STATUS=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests/$REQUEST_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['request']['status'])")
if [[ "$CURRENT_STATUS" == "Submitted" ]]; then
  echo "No state change after invalid transition: PASS"
  PASS=$((PASS+1))
else
  echo "No state change after invalid transition: FAIL (status=$CURRENT_STATUS)"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 4: valid status update persists and writes activity ----
R=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"In Review"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/status")
echo "Status update: $R"
if [[ "$R" == *'"ok":true'* && "$R" == *'"status":"In Review"'* ]]; then
  echo "Status update persisted: PASS"
  PASS=$((PASS+1))
else
  echo "Status update persisted: FAIL"
  FAIL=$((FAIL+1))
fi

ACTIVITY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests/$REQUEST_ID/activity")
if [[ "$ACTIVITY" == *'"field":"status"'* && "$ACTIVITY" == *'"newValue":"In Review"'* ]]; then
  echo "Activity log updated for status: PASS"
  PASS=$((PASS+1))
else
  echo "Activity log updated for status: FAIL"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 5: priority update persists and writes activity ----
PRIO=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"priority":"High"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/priority")
echo "Priority update: $PRIO"
if [[ "$PRIO" == *'"ok":true'* && "$PRIO" == *'"priority":"High"'* ]]; then
  echo "Priority update persisted: PASS"
  PASS=$((PASS+1))
else
  echo "Priority update persisted: FAIL"
  FAIL=$((FAIL+1))
fi

ACTIVITY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests/$REQUEST_ID/activity")
if [[ "$ACTIVITY" == *'"field":"priority"'* && "$ACTIVITY" == *'"newValue":"High"'* ]]; then
  echo "Activity log updated for priority: PASS"
  PASS=$((PASS+1))
else
  echo "Activity log updated for priority: FAIL"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 6: due date update persists and writes activity ----
DUE=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"dueDate":"2026-12-25"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/due-date")
echo "Due date update: $DUE"
if [[ "$DUE" == *'"ok":true'* && "$DUE" == *'"dueDate":"2026-12-25"'* ]]; then
  echo "Due date update persisted: PASS"
  PASS=$((PASS+1))
else
  echo "Due date update persisted: FAIL"
  FAIL=$((FAIL+1))
fi

ACTIVITY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests/$REQUEST_ID/activity")
if [[ "$ACTIVITY" == *'"field":"due_date"'* && "$ACTIVITY" == *'"newValue":"2026-12-25"'* ]]; then
  echo "Activity log updated for due date: PASS"
  PASS=$((PASS+1))
else
  echo "Activity log updated for due date: FAIL"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 7: notes save and round-trip ----
NOTES=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"notes":"Detail page test note"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/notes")
echo "Notes update: $NOTES"
NOTES_GET=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests/$REQUEST_ID/notes")
echo "Notes GET: $NOTES_GET"
if [[ "$NOTES" == *'"ok":true'* && "$NOTES_GET" == *'"notes":"Detail page test note"'* ]]; then
  echo "Notes save and display: PASS"
  PASS=$((PASS+1))
else
  echo "Notes save and display: FAIL"
  FAIL=$((FAIL+1))
fi

ACTIVITY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests/$REQUEST_ID/activity")
if [[ "$ACTIVITY" == *'"field":"internal_notes"'* ]]; then
  echo "Activity log updated for notes: PASS"
  PASS=$((PASS+1))
else
  echo "Activity log updated for notes: FAIL"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 8: Rejected selectable from any state ----
REJECT=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"Rejected"}' "$BASE_URL/api/admin/requests/$REQUEST_ID/status")
echo "Reject from In Review: $REJECT"
if [[ "$REJECT" == *'"ok":true'* && "$REJECT" == *'"status":"Rejected"'* ]]; then
  echo "Rejected selectable from any state: PASS"
  PASS=$((PASS+1))
else
  echo "Rejected selectable from any state: FAIL"
  FAIL=$((FAIL+1))
fi

rm -f "$JAR"

echo ""
echo "=== Summary ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
if [[ $FAIL -eq 0 ]]; then
  echo "All request detail criteria PASS"
  exit 0
else
  echo "Some request detail criteria FAIL"
  exit 1
fi
# End of script
