import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/schema";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";

const DUMMY_HASH =
  "$2b$10$0000000000000000000000uT2G3g1qQBQw1XxF.YuQ7mIaYQ7mIaYQ";

const UNAUTHORIZED_RESPONSE = { error: "Invalid email or password" };

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 });
  }

  const submittedEmail =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const submittedPassword =
    typeof body.password === "string" ? body.password : "";

  if (!submittedEmail || !submittedPassword) {
    return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 });
  }

  const user = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.email, submittedEmail),
  });

  const passwordHash = user?.passwordHash ?? DUMMY_HASH;
  const passwordMatches = verifyPassword(submittedPassword, passwordHash);

  if (!user || !passwordMatches) {
    return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 });
  }

  await createSession(user.id, user.email, user.name ?? "");

  return NextResponse.json({ ok: true, name: user.name ?? "" }, { status: 200 });
}
