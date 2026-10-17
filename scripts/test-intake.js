#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const FormData = require("form-data");
const { Pool } = require("pg");

const PORT = 9999;
const HOST = `http://127.0.0.1:${PORT}`;
const TIMEOUT_MS = 60000;
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/mnt/hikvision/Shantanu/Work/NStarX-Intake-Uploads";

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? "5432"),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: process.env.DATABASE_SSL === "true" ? true : false,
});

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function ping() {
      http.get(url, (res) => {
        if (res.statusCode < 500) resolve(); else schedule();
      }).on("error", schedule);
    }
    function schedule() {
      if (Date.now() > deadline) { reject(new Error("Server did not become ready in time")); return; }
      setTimeout(ping, 300);
    }
    schedule();
  });
}

function cleanTestRows() {
  return pool.query("DELETE FROM attachments WHERE stored_path LIKE $1", [`${UPLOAD_DIR}%`]);
}

async function main() {
  const testStart = Date.now();
  console.log("Starting Next.js dev server for intake test...");

  const server = spawn("node", ["./node_modules/next/dist/bin/next", "dev", "--port", String(PORT), "--hostname", "127.0.0.1"], {
    cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (d) => console.log(`[server] ${d.toString().trim()}`));
  server.stderr.on("data", (d) => console.error(`[server err] ${d.toString().trim()}`));

  let tmpFile = "";

  try {
    await waitForServer(`${HOST}/`, TIMEOUT_MS);
    console.log("Server ready.");

    await cleanTestRows();

    tmpFile = path.join(process.env.TMPDIR || "/tmp", `intake-test-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, "Hello from intake e2e test.");

    const form = new FormData();
    form.append("fullName", "E2E Test User");
    form.append("email", "e2e@nstarxinc.com");
    form.append("projectType", "Presentation");
    form.append("brandingDirection", "NStarX");
    form.append("projectTitle", "E2E Test Deck");
    form.append("description", "This is an end-to-end test submission for the NStarX intake form. It includes enough characters to pass validation.");
    form.append("priority", "High");
    form.append("desiredDeadline", "");
    form.append("driveUrl", "https://drive.google.com/drive/folders/e2e-test");
    form.append("fileCount", "1");
    form.append("fileName_0", "intake-test.txt");
    form.append("file_0", fs.createReadStream(tmpFile), { filename: "intake-test.txt", contentType: "text/plain" });

    const response = await new Promise((resolve, reject) => {
      form.submit(`${HOST}/api/requests`, (err, res) => {
        if (err) return reject(err);
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      });
    });

    console.log("Submission response status:", response.status);
    const data = typeof response.body === "string" ? JSON.parse(response.body) : response.body;

    if (response.status !== 201 || !data.success) {
      throw new Error(`Submission failed: ${response.status}\n${JSON.stringify(data, null, 2).slice(0, 500)}`);
    }

    const reference = data.reference;
    console.log("Generated reference:", reference);

    const dbResult = await pool.query(
      `SELECT r.*, a.id AS attachment_id, a.original_filename, a.stored_path
       FROM requests r
       LEFT JOIN attachments a ON a.request_id = r.id
       WHERE r.public_reference = $1`,
      [reference]
    );

    if (dbResult.rows.length === 0) throw new Error("Request row not found in database");
    const row = dbResult.rows[0];
    console.log("DB row:", JSON.stringify(row, null, 2));

    if (row.full_name !== "E2E Test User") throw new Error("Wrong full_name");
    if (row.email !== "e2e@nstarxinc.com") throw new Error("Wrong email");
    if (row.project_type !== "Presentation") throw new Error("Wrong project_type");
    if (row.branding_direction !== "NStarX") throw new Error("Wrong branding_direction");
    if (row.project_title !== "E2E Test Deck") throw new Error("Wrong project_title");
    if (row.priority !== "High") throw new Error("Wrong priority");
    if (row.status !== "Submitted") throw new Error("Wrong status");
    if (row.assignee !== "Shantanu") throw new Error("Wrong assignee");
    if (row.drive_url !== "https://drive.google.com/drive/folders/e2e-test") throw new Error("Wrong drive_url");

    if (!row.stored_path || !fs.existsSync(row.stored_path)) throw new Error(`Uploaded file missing at ${row.stored_path}`);
    const uploadedContent = fs.readFileSync(row.stored_path, "utf8");
    if (!uploadedContent.includes("Hello from intake e2e test.")) throw new Error("Uploaded file content mismatch");
    console.log("Uploaded file verified at:", row.stored_path);

    const logResult = await pool.query(`SELECT * FROM activity_log WHERE request_id = $1 AND field = 'status'`, [row.id]);
    if (logResult.rows.length === 0) throw new Error("Activity log entry missing");
    console.log("Activity log:", JSON.stringify(logResult.rows[0], null, 2));

    console.log(`\nAll intake e2e assertions passed in ${Date.now() - testStart}ms.`);
  } finally {
    try { server.kill("SIGTERM"); } catch {}
    try { await pool.end(); } catch {}
    if (typeof tmpFile === "string" && tmpFile) {
      try { fs.rmSync(tmpFile, { force: true }); } catch {}
    }
  }
}

main().catch((err) => {
  console.error("Intake e2e test failed:", err);
  process.exit(1);
});
