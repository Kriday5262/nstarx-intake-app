-- Round 4: purge test/noise requests from the production database.
-- Deletes requests whose title matches known test patterns OR whose submitter
-- email is from a test domain. Cascading FK constraints remove attachments,
-- activity_log and comments rows automatically.

WITH deleted AS (
  DELETE FROM requests
  WHERE
    -- Known test-title patterns from Round 3 QA scripts and manual smoke tests
    project_title ~* '^(Paging Test|Workflow Pivot Test|Smoke test request|Request Detail Test|Workflow API Test|Deployed intake test|EMAIL-DELIVERY-CHECK|Intake Smoke Test|Status Workflow Test|Assignee Notification Test|Comment Notification Test|Priority Update Test|Due Date Test|Notes Update Test|Drive URL Test|Intake Form Test|Round [0-9]+ Test|Test [0-9]+|QA Test|End-to-End Test|E2E Test)'
    OR project_title ~* 'Test\s+[0-9]|\(Test\)|\[Test\]|test request|smoke test|pivot test|deployed.*test|detail test|workflow.*test'
    -- Test domains. @nstarxinc.com is only used by QA/automation, not real requesters.
    OR lower(email) LIKE '%@example.com'
    OR lower(email) LIKE '%@test.com'
    OR lower(email) LIKE '%@nstarxinc.com'
  RETURNING id, project_title, email
)
SELECT count(*) AS deleted_count FROM deleted;
