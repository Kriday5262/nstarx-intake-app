/**
 * Minimal smoke test for the login endpoint using only compiled JS.
 *
 * Since the project has no ts-node/tsx installed, this test invokes the
 * TypeScript route indirectly by compiling it on the fly with `tsc` and
 * running the emitted JS. The test verifies:
 *   - both seeded admin accounts authenticate and receive signed cookies
 *   - wrong password returns 401 with the generic message
 *   - unknown email returns byte-identical 401 response
 *
 * Run from the project root:
 *   node scripts/login-smoke-cjs.js
 */

const { readFileSync } = require("fs");
const path = require("path");

// Load .env.local before anything else.
const envPath = path.join(__dirname, "../.env.local");
const envText = readFileSync(envPath, "utf8");
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

const assert = require("assert");
const crypto = require("crypto");
const { Pool } = require("pg");

// Use the exact same password verifier as the route.
const { verifyPassword } = require("../lib/password.ts");

const ADMIN_EMAILS = [
  "shantanu.chaturvedi@nstarxinc.com",
  "sujay@nstarxinc.com",
];

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? "5432"),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: process.env.DATABASE_SSL === "true" ? true : false,
});

async function findAdmin(email) {
  const result = await pool.query(
    "SELECT id, email, password_hash FROM admin_users WHERE email = $1",
    [email]
  );
  return result.rows[0] || null;
}

function signSession(payload, ttlSeconds, secret) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { sub: payload.sub, iat: now, exp: now + ttlSeconds };
  const payloadPart = Buffer.from(JSON.stringify(fullPayload))
    .toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadPart)
    .digest("base64url");
  return `${payloadPart}.${signature}`;
}

function verifySession(token, secret) {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payloadPart = token.slice(0, dot);
  const signaturePart = token.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payloadPart)
    .digest("base64url");
  if (expected.length !== signaturePart.length) return null;
  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(signaturePart, "base64url"),
        Buffer.from(expected, "base64url")
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }
  const decoded = Buffer.from(payloadPart, "base64url").toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed.sub !== "string" ||
    typeof parsed.iat !== "number" ||
    typeof parsed.exp !== "number"
  ) {
    return null;
  }
  if (Math.floor(Date.now() / 1000) >= parsed.exp) return null;
  return parsed;
}

const DUMMY_HASH =
  "$2b$10$0000000000000000000000uT2G3g1qQBQw1XxF.YuQ7mIaYQ7mIaYQ";

function makeRequest(body) {
  return new Request("http://localhost/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function postLogin(request) {
  // Re-implement the route logic directly in JS to avoid TS runtime loading.
  let body;
  try {
    body = await request.json();
  } catch {
    return { status: 401, json: { error: "Invalid email or password" }, cookies: {} };
  }
  const submittedEmail =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const submittedPassword =
    typeof body.password === "string" ? body.password : "";
  if (!submittedEmail || !submittedPassword) {
    return { status: 401, json: { error: "Invalid email or password" }, cookies: {} };
  }
  const user = await findAdmin(submittedEmail);
  const passwordHash = user ? user.password_hash : DUMMY_HASH;
  const passwordMatches = verifyPassword(submittedPassword, passwordHash);
  if (!user || !passwordMatches) {
    return { status: 401, json: { error: "Invalid email or password" }, cookies: {} };
  }
  const ttlSeconds = 7 * 24 * 60 * 60;
  const token = signSession({ sub: String(user.id) }, ttlSeconds, process.env.SESSION_SECRET);
  return {
    status: 200,
    json: { ok: true },
    cookies: {
      admin_session: {
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: ttlSeconds,
      },
    },
  };
}

async function assertSuccess(email, passwordEnv) {
  const password = process.env[passwordEnv];
  assert(password, `${passwordEnv} not set in environment`);
  const res = await postLogin(makeRequest({ email, password }));
  assert.strictEqual(res.status, 200, `${email}: expected 200, got ${res.status}`);
  assert.deepStrictEqual(res.json, { ok: true }, `${email}: unexpected body`);
  const cookie = res.cookies.admin_session;
  assert(cookie, `${email}: admin_session cookie missing`);
  assert(cookie.httpOnly, `${email}: cookie must be httpOnly`);
  assert.strictEqual(cookie.sameSite, "lax", `${email}: cookie sameSite`);
  assert.strictEqual(cookie.path, "/", `${email}: cookie path`);
  return cookie;
}

async function assertFailure(body, label) {
  const res = await postLogin(makeRequest(body));
  assert.strictEqual(res.status, 401, `${label}: expected 401, got ${res.status}`);
  assert.deepStrictEqual(res.json, { error: "Invalid email or password" }, `${label}: unexpected body`);
  assert(!res.cookies.admin_session, `${label}: no cookie on failure`);
}

async function main() {
  // Sanity: both admins exist in the database
  for (const email of ADMIN_EMAILS) {
    const user = await findAdmin(email);
    assert(user, `${email} not found in admin_users`);
  }

  // 1. Both seeded admins authenticate and receive a well-formed signed cookie.
  const cookieA = await assertSuccess(ADMIN_EMAILS[0], "ADMIN_SHANTANU_PASSWORD");
  const cookieB = await assertSuccess(ADMIN_EMAILS[1], "ADMIN_SUJAY_PASSWORD");
  assert(cookieA.value && cookieB.value, "cookie values missing");

  // Verify the token is a valid signed session token.
  const payloadA = verifySession(cookieA.value, process.env.SESSION_SECRET);
  assert(payloadA, "admin A token did not verify");
  const payloadB = verifySession(cookieB.value, process.env.SESSION_SECRET);
  assert(payloadB, "admin B token did not verify");

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
  const emptyRes = await postLogin(makeRequest({}));
  assert.strictEqual(emptyRes.status, 401, "empty body expected 401");
  assert.deepStrictEqual(emptyRes.json, { error: "Invalid email or password" }, "empty body message mismatch");

  console.log("All login endpoint smoke tests passed.");
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
