import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/schema";
import { verifyPassword } from "@/lib/password";
import { createSession, clearSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const from = String(formData.get("from") ?? "/dashboard");

    const user = await db.query.adminUsers.findFirst({
      where: eq(adminUsers.email, email),
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "invalid");
      if (from && from !== "/login") {
        loginUrl.searchParams.set("from", from);
      }
      return NextResponse.redirect(loginUrl, { status: 303 });
    }

    await createSession(user.id, user.email, user.name ?? "");

    const target = from.startsWith("/") ? from : "/dashboard";
    return NextResponse.redirect(new URL(target, request.url), {
      status: 303,
    });
  } catch (err) {
    console.error("Login error:", err);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }
}

export async function GET(request: NextRequest) {
  await clearSession();
  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
}
