/**
 * Standalone smoke test for lib/session-token.ts.
 *
 * Run with:
 *   SESSION_SECRET=$(openssl rand -base64 32) NODE_ENV=test npx tsx lib/__tests__/session-token.smoke.ts
 */

import assert from "assert";
import crypto from "crypto";
import { signSession, verifySession, SESSION_COOKIE_NAME } from "../session-token";

function run() {
  // 1. Cookie name is exported and stable.
  assert.strictEqual(SESSION_COOKIE_NAME, "admin_session", "cookie name mismatch");

  // 2. Round-trip.
  const token = signSession({ sub: "admin@example.com" }, 3600);
  const payload = verifySession(token);
  assert(payload, "round-trip verify failed");
  assert.strictEqual(payload.sub, "admin@example.com", "sub mismatch");
  assert.strictEqual(payload.exp, payload.iat + 3600, "exp mismatch");

  // 3. Payload tamper.
  const tamperedPayload = token.slice(0, 5) + "X" + token.slice(6);
  assert.strictEqual(verifySession(tamperedPayload), null, "payload tamper accepted");

  // 4. Signature tamper.
  const lastChar = token.slice(-1);
  const flipped = lastChar === "A" ? "B" : "A";
  const tamperedSig = token.slice(0, -1) + flipped;
  assert.strictEqual(verifySession(tamperedSig), null, "signature tamper accepted");

  // 5. Expired token.
  const shortToken = signSession({ sub: "admin@example.com" }, 1);
  assert(verifySession(shortToken), "short token not accepted immediately");

  const now = Date.now();
  const originalNow = Date.now;
  try {
    Date.now = () => now + 2000;
    assert.strictEqual(verifySession(shortToken), null, "expired token accepted");
  } finally {
    Date.now = originalNow;
  }

  // 6. Malformed / missing signature.
  assert.strictEqual(verifySession("not-a-token"), null, "malformed token accepted");
  assert.strictEqual(verifySession("onlypayload"), null, "missing signature accepted");

  // 7. Invalid JSON payload with valid signature.
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "";
  const badPayloadPart = Buffer.from("not-json").toString("base64url");
  const badSig = crypto.createHmac("sha256", secret).update(badPayloadPart).digest("base64url");
  assert.strictEqual(verifySession(`${badPayloadPart}.${badSig}`), null, "bad JSON accepted");

  // 8. Missing required fields with valid signature.
  const missingFieldsPart = Buffer.from(JSON.stringify({ sub: "admin@example.com" })).toString("base64url");
  const missingFieldsSig = crypto
    .createHmac("sha256", secret)
    .update(missingFieldsPart)
    .digest("base64url");
  assert.strictEqual(
    verifySession(`${missingFieldsPart}.${missingFieldsSig}`),
    null,
    "missing fields accepted"
  );

  console.log("All session-token smoke tests passed.");
}

run();
