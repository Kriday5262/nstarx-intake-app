import crypto from "crypto";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import {
  signSession,
  verifySession,
  SESSION_COOKIE_NAME,
  SessionPayload,
} from "../session-token";

describe("session-token", () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.SESSION_SECRET = "a".repeat(64);
    process.env.NODE_ENV = "test";
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("exports the shared cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("admin_session");
  });

  it("round-trips a signed token", () => {
    const token = signSession({ sub: "admin@example.com" }, 3600);
    const payload = verifySession(token);

    expect(payload).toMatchObject<SessionPayload>({
      sub: "admin@example.com",
    });
    expect(payload?.iat).toBeGreaterThan(0);
    expect(payload?.exp).toBe((payload as SessionPayload).iat + 3600);
  });

  it("rejects a token with a flipped payload character", () => {
    const token = signSession({ sub: "admin@example.com" }, 3600);
    const tampered = token.slice(0, 5) + "X" + token.slice(6);

    expect(verifySession(tampered)).toBeNull();
  });

  it("rejects a token with a flipped signature character", () => {
    const token = signSession({ sub: "admin@example.com" }, 3600);
    const lastChar = token.slice(-1);
    const flipped = lastChar === "A" ? "B" : "A";
    const tampered = token.slice(0, -1) + flipped;

    expect(verifySession(tampered)).toBeNull();
  });

  it("rejects an expired token", () => {
    // Create a token that expires in 1 second, then wait for it to expire.
    const token = signSession({ sub: "admin@example.com" }, 1);

    expect(verifySession(token)).not.toBeNull();

    // Advance time by 2 seconds using a fixed date.
    const now = Date.now();
    jest.useFakeTimers();
    jest.setSystemTime(now + 2000);

    try {
      expect(verifySession(token)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("rejects a malformed token", () => {
    expect(verifySession("not-a-token")).toBeNull();
    expect(verifySession("")).toBeNull();
    expect(verifySession("onlypayload")).toBeNull();
    expect(verifySession(".signature")).toBeNull();
  });

  it("rejects a token with an invalid JSON payload", () => {
    const secret = process.env.SESSION_SECRET!;
    const payloadPart = Buffer.from("not-json").toString("base64url");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payloadPart)
      .digest("base64url");

    expect(verifySession(`${payloadPart}.${signature}`)).toBeNull();
  });

  it("rejects a token with missing required payload fields", () => {
    const secret = process.env.SESSION_SECRET!;
    const payloadPart = Buffer.from(
      JSON.stringify({ sub: "admin@example.com" })
    ).toString("base64url");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payloadPart)
      .digest("base64url");

    expect(verifySession(`${payloadPart}.${signature}`)).toBeNull();
  });

  it("rejects a token with a zero-length subject", () => {
    const token = signSession({ sub: "" }, 3600);
    expect(verifySession(token)).toBeNull();
  });
});
