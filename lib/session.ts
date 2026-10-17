/**
 * Server-side cookie helpers for the HMAC-signed session token.
 *
 * Delegates signing/verification to lib/session-token.ts so the middleware,
 * login endpoint, and logout endpoint all agree on the token format and
 * cookie name.
 */

import { cookies } from "next/headers";
import { eq, gt, and } from "drizzle-orm";
import {
  signSession,
  verifySession,
  getTokenSignature,
  SESSION_COOKIE_NAME,
} from "@/lib/session-token";
import { db } from "@/lib/db";
import { adminUsers, adminSessions } from "@/lib/schema";
import { redirect } from "next/navigation";

const DEFAULT_TTL_SECONDS = 86400;
const isSecure = () => process.env.NODE_ENV === "production";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: isSecure(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function createSession(adminId: number, _email: string, name: string) {
  const ttlSeconds = Number(process.env.SESSION_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  const token = signSession({ sub: String(adminId), name }, ttlSeconds);
  const signature = getTokenSignature(token);

  if (signature) {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await db
      .insert(adminSessions)
      .values({ adminId, tokenSignature: signature, expiresAt })
      .onConflictDoUpdate({
        target: adminSessions.tokenSignature,
        set: { adminId, expiresAt },
      });
  }

  cookies().set(SESSION_COOKIE_NAME, token, cookieOptions(ttlSeconds));
}

export async function revokeSession(token?: string) {
  const cookieValue = token ?? cookies().get(SESSION_COOKIE_NAME)?.value;
  const signature = cookieValue ? getTokenSignature(cookieValue) : null;

  if (signature) {
    try {
      await db.delete(adminSessions).where(eq(adminSessions.tokenSignature, signature));
    } catch {
      // Best-effort deletion; the cookie is still cleared below.
    }
  }

  cookies().set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function clearSession() {
  // Backward-compatible alias: full server-side revocation.
  await revokeSession();
}

export type AdminSession = {
  adminId: number;
  name: string;
};

export async function getSession(): Promise<AdminSession | null> {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;

  const payload = verifySession(cookie);
  if (!payload) return null;

  const signature = getTokenSignature(cookie);
  if (!signature) return null;

  // Server-side revocation check: if the token signature is not in the
  // allow-list, the session has been logged out.
  const sessionRow = await db.query.adminSessions.findFirst({
    where: and(
      eq(adminSessions.tokenSignature, signature),
      gt(adminSessions.expiresAt, new Date())
    ),
    columns: { adminId: true },
  });
  if (!sessionRow) return null;

  const adminId = Number(payload.sub);
  if (!Number.isFinite(adminId) || adminId <= 0) return null;

  return { adminId, name: payload.name ?? "" };
}

export async function requireSession(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export type CurrentAdmin = AdminSession & { email: string };

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.id, session.adminId),
    columns: { email: true, name: true },
  });

  if (!user) return null;

  return {
    adminId: session.adminId,
    email: user.email,
    name: user.name || session.name || emailToName(user.email),
  };
}

export async function requireCurrentAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/login");
  }
  return admin;
}

function emailToName(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
