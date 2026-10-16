/**
 * HMAC-signed session token utilities.
 *
 * Shared by the login endpoint, dashboard middleware, and logout flow.
 *
 * Token format:
 *   base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))
 *
 * Payload shape:
 *   { sub: string, iat: number, exp: number }
 *
 * Environment:
 *   SESSION_SECRET - required in production; must be at least 32 bytes.
 */

import crypto from "crypto";

export const SESSION_COOKIE_NAME = "admin_session";

export type SessionPayload = {
  sub: string;
  iat: number;
  exp: number;
};

type SessionInput = {
  sub: string;
};

const ALGORITHM = "sha256";
const SECRET_MIN_LENGTH = 32;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET ?? process.env.ADMIN_SESSION_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing required environment variable: SESSION_SECRET or ADMIN_SESSION_SECRET"
    );
  }

  if (!secret || secret.length < SECRET_MIN_LENGTH) {
    throw new Error(
      "SESSION_SECRET / ADMIN_SESSION_SECRET must be set and at least 32 characters long"
    );
  }

  return secret;
}

function base64urlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64url");
}

function base64urlDecode(input: string): string | null {
  try {
    return Buffer.from(input, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Sign a session payload and return the session token string.
 *
 * @param payload - the session subject (sub) and any optional fields
 * @param ttlSeconds - lifetime of the token in seconds
 * @returns the signed token string
 */
export function signSession(
  payload: SessionInput,
  ttlSeconds: number
): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;

  const fullPayload: SessionPayload = {
    sub: payload.sub,
    iat: now,
    exp,
  };

  const payloadPart = base64urlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac(ALGORITHM, getSecret())
    .update(payloadPart)
    .digest("base64url");

  return `${payloadPart}.${signature}`;
}

/**
 * Extract the signature part of a session token.
 *
 * The signature is the server-side revocation key: clearing the browser
 * cookie is not enough to invalidate a stateless HMAC token, so the logout
 * flow records the signature in a blocklist until the token's natural expiry.
 *
 * @param token - the signed token string
 * @returns the base64url signature, or null if the token is malformed
 */
export function getTokenSignature(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const signature = token.slice(dot + 1);
  return signature.length > 0 ? signature : null;
}

/**
 * Verify a session token and return its payload, or null if invalid/expired.
 *
 * @param token - the signed token string
 * @returns the decoded payload, or null if the token is invalid/expired
 */
export function verifySession(token: string): SessionPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;

  const payloadPart = token.slice(0, dot);
  const signaturePart = token.slice(dot + 1);

  const expectedSignature = crypto
    .createHmac(ALGORITHM, getSecret())
    .update(payloadPart)
    .digest("base64url");

  if (expectedSignature.length !== signaturePart.length) return null;

  try {
    const signatureBuf = Buffer.from(signaturePart, "base64url");
    const expectedBuf = Buffer.from(expectedSignature, "base64url");

    if (!crypto.timingSafeEqual(signatureBuf, expectedBuf)) {
      return null;
    }
  } catch {
    return null;
  }

  const decoded = base64urlDecode(payloadPart);
  if (!decoded) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }

  if (!isSessionPayload(parsed)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (now >= parsed.exp) {
    return null;
  }

  return parsed;
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.sub === "string" &&
    obj.sub.length > 0 &&
    typeof obj.iat === "number" &&
    Number.isInteger(obj.iat) &&
    obj.iat > 0 &&
    typeof obj.exp === "number" &&
    Number.isInteger(obj.exp) &&
    obj.exp > 0
  );
}
