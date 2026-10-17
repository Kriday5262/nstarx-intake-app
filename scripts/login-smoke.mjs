/**
 * Standalone smoke test for the login endpoint.
 *
 * This is a pure Node test that loads the route handler via the Next.js
 * Request/Response polyfills from `next/server`. It needs a database with
 * seeded admin_users, so it reads the same .env.local used by the app.
 *
 * Run from the project root:
 *   node --experimental-vm-modules scripts/login-smoke.mjs
 *
 * Or with environment explicit:
 *   ADMIN_SHANTANU_PASSWORD=testpass1 ADMIN_SUJAY_PASSWORD=testpass2 \
 *   DATABASE_HOST=127.0.0.1 DATABASE_PORT=5434 DATABASE_NAME=nstarx_intake \
 *   DATABASE_USER=nstarx_app DATABASE_PASSWORD=nstarx_intake_dev SESSION_SECRET=... \
 *   node --experimental-vm-modules scripts/login-smoke.mjs
 */

import assert from "assert";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(path.join(__dirname, "../.env.local"), "utf8");
for (const line of envText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const value = trimmed.slice(eqIdx + 1);
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

import { db } from "../lib/db.ts";
import { adminUsers } from "../lib/schema.ts";
import { eq } from "drizzle-orm";
import { POST } from "../app/api/admin/login/route.ts";
import { verifySession } from "../lib/session-token.ts";

const ADMIN_EMAILS = [
  "shantanu.chaturvedi@nstarxinc.com",
  "shantanu@kamkazi.com",
];

function makeRequest(body) {
  return new Request("http://localhost/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function assertSuccess(email, passwordEnv) {
  const password = process.env[passwordEnv];
  assert(password, `${passwordEnv} not set in environment`);
  const req = makeRequest({ email, password });
  const res = await POST(req);
  assert.strictEqual(res.status, 200, `${email}: expected 200, got ${res.status}`);
  const json = await res.json();
  assert.deepStrictEqual(json, { ok: true }, `${email}: unexpected body`);
  const cookie = res.cookies.get("admin_session");
  assert(cookie, `${email}: admin_session cookie missing`);
  assert(cookie.httpOnly, `${email}: cookie must be httpOnly`);
  assert.strictEqual(cookie.sameSite, "lax", `${email}: cookie sameSite`);
  assert.strictEqual(cookie.path, "/", `${email}: cookie path`);
  return cookie;
}

async function assertFailure(body, label) {
  const res = await POST(makeRequest(body));
  assert.strictEqual(res.status, 401, `${label}: expected 401, got ${res.status}`);
  const json = await res.json();
  assert.deepStrictEqual(json, { error: "Invalid email or password" }, `${label}: unexpected body`);
  assert.strictEqual(res.cookies.get("admin_session")?.value, undefined, `${label}: no cookie on failure`);
}

async function main() {
  // Sanity: both admins exist in the database
  for (const email of ADMIN_EMAILS) {
    const user = await db.query.adminUsers.findFirst({
      where: eq(adminUsers.email, email),
    });
    assert(user, `${email} not found in admin_users`);
  }

  // 1. Both seeded admins authenticate and receive a well-formed signed cookie.
  const cookieA = await assertSuccess(ADMIN_EMAILS[0], "ADMIN_SHANTANU_PASSWORD");
  const cookieB = await assertSuccess(ADMIN_EMAILS[1], "ADMIN_SUJAY_PASSWORD");
  assert(cookieA.value && cookieB.value, "cookie values missing");

  // Also verify the token is a valid signed session token.
  const payloadA = verifySession(cookieA.value);
  assert(payloadA, "admin A token did not verify");
  assert.strictEqual(payloadA.sub, "1", "admin A token sub should be id 1");

  const payloadB = verifySession(cookieB.value);
  assert(payloadB, "admin B token did not verify");
  assert.strictEqual(payloadB.sub, "2", "admin B token sub should be id 2");

  // Expiry roughly 7 days out.
  const now = Math.floor(Date.now() / 1000);
  assert(payloadA.exp > now + 6 * 24 * 60 * 60, "token expiry too short");
  assert(payloadA.exp < now + 8 * 24 * 60 * 60, "token expiry too long");

  // 2. Wrong password yields 401 with the generic message.
  await assertFailure({ email: ADMIN_EMAILS[0], password: "wrong" }, "wrong password");

  // 3. Unknown email yields byte-identical 401 response.
  await assertFailure({ email: "nope@example.com", password: "wrong" }, "unknown email");

  // 4. Missing body / fields yields 401.
  await assertFailure({ email: ADMIN_EMAILS[0] }, "missing password");
  await assertFailure({ password: "x" }, "missing email");
  const emptyRes = await POST(makeRequest({}));
  assert.strictEqual(emptyRes.status, 401, "empty body expected 401");
  const emptyJson = await emptyRes.json();
  assert.deepStrictEqual(emptyJson, { error: "Invalid email or password" }, "empty body message mismatch");

  console.log("All login endpoint smoke tests passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
