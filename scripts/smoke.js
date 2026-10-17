/**
 * Database smoke test: insert a request, attachment, activity log entry,
 * and comment, then read them back. Uses the real Drizzle schema so it
 * stays in sync with code changes.
 *
 * Run with: node ./scripts/smoke.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2];
    }
  }
}

require("esbuild-register/dist/node").register({
  target: "node20",
  format: "cjs",
  platform: "node",
});

const { db, pool } = require("../lib/db");
const { requests, attachments, activityLog, comments } = require("../lib/schema");
const { eq } = require("drizzle-orm");

async function main() {
  const year = new Date().getFullYear();
  const suffix = `${Date.now()}`.slice(-4);
  const [request] = await db
    .insert(requests)
    .values({
      publicReference: `NS-${year}-${suffix}`,
      fullName: "Test User",
      email: "test@example.com",
      projectType: "Website",
      brandingDirection: "NStarX",
      projectTitle: "Smoke test request",
      description: "Round-trip Drizzle query verification with current schema.",
      priority: "Medium",
      status: "Submitted",
      assignee: "Shantanu",
      driveUrl: "https://drive.google.com/drive/folders/smoke",
    })
    .returning();

  console.log("Inserted request:", request.id, request.publicReference);

  const [attachment] = await db
    .insert(attachments)
    .values({
      requestId: request.id,
      originalFilename: "smoke.txt",
      storedPath: "/uploads/smoke.txt",
      mimeType: "text/plain",
      sizeBytes: 12,
    })
    .returning();

  console.log("Inserted attachment:", attachment.id);

  await db.insert(activityLog).values({
    requestId: request.id,
    actorEmail: "admin@nstarxinc.com",
    actorName: "Shantanu",
    field: "status",
    oldValue: null,
    newValue: "Submitted",
  });

  await db.insert(comments).values({
    requestId: request.id,
    authorEmail: "admin@nstarxinc.com",
    authorName: "Shantanu",
    content: "Smoke test comment.",
  });

  const roundTrip = await db.query.requests.findFirst({
    where: eq(requests.id, request.id),
  });

  const attachmentRows = await db.query.attachments.findMany({
    where: eq(attachments.requestId, request.id),
  });

  const activityRows = await db.query.activityLog.findMany({
    where: eq(activityLog.requestId, request.id),
  });

  const commentRows = await db.query.comments.findMany({
    where: eq(comments.requestId, request.id),
  });

  console.log("Round-trip request:", JSON.stringify(roundTrip, null, 2));
  console.log("Round-trip attachments:", JSON.stringify(attachmentRows, null, 2));
  console.log("Round-trip activity:", JSON.stringify(activityRows, null, 2));
  console.log("Round-trip comments:", JSON.stringify(commentRows, null, 2));

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
