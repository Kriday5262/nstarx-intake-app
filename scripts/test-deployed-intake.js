/** @format */
const fs = require("fs");
const path = require("path");
const http = require("http");
const FormData = require("form-data");
const { Pool } = require("pg");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2];
    }
  }
}

const HOST = "http://127.0.0.1:8090";
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
      if (Date.now() > deadline) { reject(new Error("Server did not become ready")); return; }
      setTimeout(ping, 300);
    }
    schedule();
  });
}

async function main() {
  await waitForServer(`${HOST}/login`, 30000);

  const tmpFile = path.join("/tmp", `deploy-intake-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, "Deployed app upload test.");

  const form = new FormData();
  form.append("fullName", "Deployed App Test");
  form.append("email", "deployed@test.com");
  form.append("projectType", "Website Work");
  form.append("brandingDirection", "NStarX");
  form.append("projectTitle", "Deployed intake test");
  form.append("description", "This is a test submission sent to the deployed Dockerized NStarX Intake app. It has enough characters to pass validation.");
  form.append("priority", "Medium");
  form.append("driveUrl", "https://drive.google.com/drive/folders/deploy-test");
  form.append("fileCount", "1");
  form.append("fileName_0", "deploy-test.txt");
  form.append("file_0", fs.createReadStream(tmpFile), { filename: "deploy-test.txt", contentType: "text/plain" });

  const response = await new Promise((resolve, reject) => {
    form.submit(`${HOST}/api/requests`, (err, res) => {
      if (err) return reject(err);
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
  });

  fs.rmSync(tmpFile, { force: true });

  if (response.status !== 201) {
    throw new Error(`Submission failed: ${response.status}\n${response.body}`);
  }

  const data = JSON.parse(response.body);
  console.log("Reference:", data.reference);

  const dbResult = await pool.query(
    `SELECT r.*, a.id AS attachment_id, a.original_filename, a.stored_path
     FROM requests r
     LEFT JOIN attachments a ON a.request_id = r.id
     WHERE r.public_reference = $1`,
    [data.reference]
  );

  if (dbResult.rows.length === 0) throw new Error("Request row not found in database");
  const row = dbResult.rows[0];

  if (row.branding_direction !== "NStarX") throw new Error("Wrong branding_direction");
  if (row.assignee !== "Shantanu") throw new Error("Wrong assignee");
  if (row.drive_url !== "https://drive.google.com/drive/folders/deploy-test") throw new Error("Wrong drive_url");
  if (!row.stored_path || !fs.existsSync(row.stored_path)) {
    throw new Error(`Uploaded file missing at ${row.stored_path}`);
  }

  const content = fs.readFileSync(row.stored_path, "utf8");
  if (!content.includes("Deployed app upload test.")) {
    throw new Error("Uploaded file content mismatch");
  }

  console.log("Deployed intake submission and file upload verified.");
  console.log("Stored path:", row.stored_path);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
