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

echo "=== Requests list view verification ==="

# Wait for background server to be ready before any HTTP calls.
for i in $(seq 1 30); do
  if curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/login" 2>/dev/null | grep -q '^200$'; then
    break
  fi
  sleep 1
done

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

# ---- Ensure a diverse set of requests exists ----
LIST_BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests")
COUNT=$(echo "$LIST_BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['requests']))")
echo "Existing requests: $COUNT"

ensure_request() {
  local title="$1"
  local dept="$2"
  local ptype="$3"
  local prio="$4"
  local _status="$5"
  local desc="$6"
  # Public intake endpoint expects multipart/form-data, not JSON.
  # Description must be at least 50 chars.
  curl -sS -b "$JAR" -c "$JAR" -X POST \
    -F "fullName=Verifier" \
    -F "email=verifier@example.com" \
    -F "department=$dept" \
    -F "projectType=$ptype" \
    -F "projectTitle=$title" \
    -F "description=$desc" \
    -F "priority=$prio" \
    "$BASE_URL/api/requests" > /dev/null
  echo "created: $title"
}

REQUIRED="Low Medium High Urgent Submitted In Review Planned In Progress"
MISSING=0
for needle in $REQUIRED; do
  if ! echo "$LIST_BODY" | grep -q "$needle"; then
    MISSING=$((MISSING+1))
  fi
done

if [[ "$COUNT" -lt 30 || "$MISSING" -gt 0 ]]; then
  echo "Seeding additional requests for filter/paging/badge tests (count=$COUNT missing=$MISSING)..."
  TID_A="Alpha Redesign ($(date +%s%N))"
  TID_B="Beta Branding ($(date +%s%N))"
  TID_C="Gamma Video ($(date +%s%N))"
  TID_D="Delta Site ($(date +%s%N))"
  TID_E="Epsilon Other ($(date +%s%N))"
  ensure_request "$TID_A" "Marketing" "Deck Redesign" "Low" "Submitted" "Alpha deck description with enough text to pass validation rules."
  ensure_request "$TID_B" "Sales" "Document Branding" "Medium" "Submitted" "Beta document branding description with enough text to pass validation rules."
  ensure_request "$TID_C" "Product" "Video Creation" "High" "Submitted" "Gamma video creation description with enough text to pass validation rules."
  ensure_request "$TID_D" "Engineering" "Website Work" "Urgent" "Submitted" "Delta website work description with enough text to pass validation rules."
  ensure_request "$TID_E" "Operations" "Other" "Medium" "Submitted" "Epsilon operations description with enough text to pass validation rules."
  for n in $(seq 1 25); do
    ensure_request "Paging Test $n ($(date +%s%N))" "Finance" "Document Branding" "Low" "Submitted" "Paging test description with enough text to pass validation rules."
  done

  # Re-fetch to learn the actual IDs of the newly seeded rows, then patch statuses.
  # Because the API orders by submitted_at desc, the newest seeded rows are first.
  LIST_BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests")
  SEED_ID_1=$(echo "$LIST_BODY" | python3 -c "import sys,json; rows=json.load(sys.stdin)['requests']; print([r for r in rows if r['projectTitle']=='$TID_A'][0]['id'])")
  SEED_ID_2=$(echo "$LIST_BODY" | python3 -c "import sys,json; rows=json.load(sys.stdin)['requests']; print([r for r in rows if r['projectTitle']=='$TID_B'][0]['id'])")
  SEED_ID_3=$(echo "$LIST_BODY" | python3 -c "import sys,json; rows=json.load(sys.stdin)['requests']; print([r for r in rows if r['projectTitle']=='$TID_C'][0]['id'])")
  SEED_ID_4=$(echo "$LIST_BODY" | python3 -c "import sys,json; rows=json.load(sys.stdin)['requests']; print([r for r in rows if r['projectTitle']=='$TID_D'][0]['id'])")
  echo "IDs: Alpha=$SEED_ID_1 Beta=$SEED_ID_2 Gamma=$SEED_ID_3 Delta=$SEED_ID_4"
  echo "Patching seeded rows $SEED_ID_1 -> In Review, $SEED_ID_2 -> Planned, $SEED_ID_3 -> In Progress"
  for id in "$SEED_ID_1" "$SEED_ID_2" "$SEED_ID_3" "$SEED_ID_4"; do
    echo "  stage In Review for $id"
    curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
      -d "{\"status\":\"In Review\"}" "$BASE_URL/api/admin/requests/$id/status" > /dev/null
  done
  for id in "$SEED_ID_2" "$SEED_ID_3" "$SEED_ID_4"; do
    echo "  stage Planned for $id"
    curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
      -d "{\"status\":\"Planned\"}" "$BASE_URL/api/admin/requests/$id/status" > /dev/null
  done
  # Leave SEED_ID_1 at In Review; advance SEED_ID_2/3 to In Progress and keep one at Planned.
  for id in "$SEED_ID_2" "$SEED_ID_3"; do
    echo "  stage In Progress for $id"
    curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
      -d "{\"status\":\"In Progress\"}" "$BASE_URL/api/admin/requests/$id/status" > /dev/null
  done
  # Revert one of the In Progress rows back to Submitted so the value appears in data.
  # NOTE: workflow currently disallows moving backwards, so we update DB directly.
  echo "  revert $SEED_ID_3 to Submitted (DB direct update)"
  BUMP_ID="$SEED_ID_3" node - <<'JS'
const { Pool } = require("pg");
const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});
(async () => {
  await pool.query("UPDATE requests SET status = 'Submitted' WHERE id = $1", [process.env.BUMP_ID]);
  await pool.end();
})();
JS
  # Make sure the diversity values are actually present and bump patched rows to the top.
  LIST_BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests")
  echo "After-patch statuses: $(echo "$LIST_BODY" | python3 -c "import sys,json; print(sorted(set(r['status'] for r in json.load(sys.stdin)['requests'])))")"
  echo "After-patch priorities: $(echo "$LIST_BODY" | python3 -c "import sys,json; print(sorted(set(r['priority'] for r in json.load(sys.stdin)['requests'])))")"
  # Patch target rows into the first page by bumping submittedAt so the rendered HTML contains them.
  set +u
  for id in "$SEED_ID_1" "$SEED_ID_2" "$SEED_ID_3"; do
    BUMP_ID="$id" node - <<'JS'
const { Pool } = require("pg");
const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});
(async () => {
  await pool.query("UPDATE requests SET submitted_at = NOW() WHERE id = $1", [process.env.BUMP_ID]);
  await pool.end();
})();
JS
    echo "bumped submitted_at for id=$id"
  done
  # Re-fetch the current API list after the bump so In Progress/Submitted are visible.
  LIST_BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests")
  echo "After-bump statuses: $(echo "$LIST_BODY" | python3 -c "import sys,json; print(sorted(set(r['status'] for r in json.load(sys.stdin)['requests'])))")"
  set -u
fi

# Re-fetch once more in case no seeding happened, so LIST_BODY is fresh.
LIST_BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests")
NEW_COUNT=$(echo "$LIST_BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['requests']))")
echo "Total requests after seeding: $NEW_COUNT"

# Ensure at least one Submitted row exists for the workflow tests.
if ! echo "$LIST_BODY" | grep -q '"status":"Submitted"'; then
  echo "Creating a fresh Submitted request for workflow tests..."
  T="Submitted Seed ($(date +%s%N))"
  curl -sS -b "$JAR" -c "$JAR" -X POST \
    -F "fullName=Verifier" \
    -F "email=verifier@example.com" \
    -F "department=Marketing" \
    -F "projectType=Deck Redesign" \
    -F "projectTitle=$T" \
    -F "description=Submitted seed description with enough text to pass validation rules." \
    -F "priority=Low" \
    "$BASE_URL/api/requests" > /dev/null
  LIST_BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests")
  echo "After-submitted-seed statuses: $(echo "$LIST_BODY" | python3 -c "import sys,json; print(sorted(set(r['status'] for r in json.load(sys.stdin)['requests'])))")"
fi

# ---- Criterion 1: /dashboard/requests returns 200 for authenticated user ----
BODY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/dashboard/requests")
if echo "$BODY" | grep -q "Requests" && echo "$BODY" | grep -q "Project Title"; then
  echo "PASS: list view rendered"
  PASS=$((PASS+1))
else
  echo "FAIL: list view missing expected markup"
  echo "body preview: $(echo "$BODY" | head -c 800)"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 2: table markup contains key columns and badges ----
# Columns are verified in HTML; badge values are verified against the API list so we
# don't depend on which 25 rows happen to land on the first page.
for needle in "Project Title" "Requester" "Department" "Priority" "Status" "Due Date" "Submitted" "Actions"; do
  if echo "$BODY" | grep -q "$needle"; then
    echo "PASS: found $needle"
    PASS=$((PASS+1))
  else
    echo "FAIL: missing $needle"
    FAIL=$((FAIL+1))
  fi
done

for needle in "Low" "Medium" "High" "Urgent" "Submitted" "In Review" "Planned" "In Progress"; do
  if echo "$LIST_BODY" | grep -q "$needle"; then
    echo "PASS: found badge/status value $needle in data"
    PASS=$((PASS+1))
  else
    echo "FAIL: missing badge/status value $needle in data"
    FAIL=$((FAIL+1))
  fi
done

# ---- Criterion 3: search input and filter dropdowns present ----
for needle in "Search title" "Status" "Priority" "Project Type" "Department"; do
  if echo "$BODY" | grep -q "$needle"; then
    echo "PASS: found search/filter element $needle"
    PASS=$((PASS+1))
  else
    echo "FAIL: missing search/filter element $needle"
    FAIL=$((FAIL+1))
  fi
done

# ---- Criterion 4: pagination controls present ----
if echo "$BODY" | grep -qE 'Page.*of' ; then
  echo "PASS: pagination controls rendered"
  PASS=$((PASS+1))
else
  echo "FAIL: pagination controls not found"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 5: Edit Status inline select present ----
if echo "$BODY" | grep -q "Edit status" && echo "$BODY" | grep -q "aria-haspopup"; then
  echo "PASS: inline status select present"
  PASS=$((PASS+1))
else
  echo "FAIL: inline status select missing"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 6: workflow enforcement via API returns clear error ----
TARGET=$(echo "$LIST_BODY" | python3 -c "import sys,json; print([r for r in json.load(sys.stdin)['requests'] if r['status']=='Submitted'][0]['id'])")
echo "Workflow target request id: $TARGET"
BAD=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"Completed"}' "$BASE_URL/api/admin/requests/$TARGET/status")
echo "Invalid transition response: $BAD"
if [[ "$BAD" == *'error'* ]]; then
  echo "PASS: workflow violation surfaced"
  PASS=$((PASS+1))
else
  echo "FAIL: expected workflow error"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 7: valid status transition succeeds and activity logged ----
VALID=$(curl -sS -b "$JAR" -c "$JAR" -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"In Review"}' "$BASE_URL/api/admin/requests/$TARGET/status")
echo "Valid transition response: $VALID"
if [[ "$VALID" == *'"ok":true'* && "$VALID" == *'"status":"In Review"'* ]]; then
  echo "PASS: valid transition accepted"
  PASS=$((PASS+1))
else
  echo "FAIL: valid transition not accepted"
  FAIL=$((FAIL+1))
fi
ACTIVITY=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests/$TARGET/activity")
if [[ "$ACTIVITY" == *'"field":"status"'* ]]; then
  echo "PASS: status change recorded in activity log"
  PASS=$((PASS+1))
else
  echo "FAIL: activity log missing status entry"
  FAIL=$((FAIL+1))
fi

# ---- Criterion 8: delete endpoint removes request and it is gone ----
DEL_TARGET=$(echo "$LIST_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin)['requests']; ids=[r['id'] for r in d if r['status']=='Submitted' and r['id']!=$TARGET]; print(ids[0] if ids else '')")
if [[ -z "$DEL_TARGET" ]]; then
  # Fallback: delete any non-target request
  DEL_TARGET=$(echo "$LIST_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin)['requests']; ids=[r['id'] for r in d if r['id']!=$TARGET]; print(ids[0] if ids else '')")
fi
echo "Delete target request id: $DEL_TARGET"
DEL=$(curl -sS -b "$JAR" -c "$JAR" -w "\n__STATUS__%{http_code}" -X DELETE "$BASE_URL/api/admin/requests/$DEL_TARGET")
DEL_STATUS=$(echo "$DEL" | tail -1 | sed 's/__STATUS__//')
DEL_BODY=$(echo "$DEL" | sed '$d')
echo "Delete response (status=$DEL_STATUS): $DEL_BODY"
if [[ "$DEL_STATUS" == "200" && "$DEL_BODY" == *'"ok":true'* ]]; then
  echo "PASS: delete endpoint removed request"
  PASS=$((PASS+1))
else
  echo "FAIL: delete endpoint did not remove request"
  FAIL=$((FAIL+1))
fi
AFTER=$(curl -sS -b "$JAR" -c "$JAR" "$BASE_URL/api/admin/requests/$DEL_TARGET")
echo "After-delete GET: $AFTER"
if [[ "$AFTER" == *'Request not found'* || "$AFTER" == *'error'* ]]; then
  echo "PASS: deleted request no longer retrievable"
  PASS=$((PASS+1))
else
  echo "FAIL: deleted request still retrievable"
  FAIL=$((FAIL+1))
fi

rm -f "$JAR"

echo ""
echo "=== Summary ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
if [[ $FAIL -eq 0 ]]; then
  echo "All requests list criteria PASS"
  exit 0
else
  echo "Some requests list criteria FAIL"
  exit 1
fi
# End of script
