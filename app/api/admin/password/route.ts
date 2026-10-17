import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/schema";
import { verifyPassword, hashPassword } from "@/lib/password";
import { requireCurrentAdmin } from "@/lib/session";
import { z } from "zod";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

export async function PATCH(request: NextRequest) {
  const admin = await requireCurrentAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }

  const user = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.id, admin.adminId),
  });

  if (!user || !verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 401 }
    );
  }

  await db
    .update(adminUsers)
    .set({ passwordHash: hashPassword(parsed.data.newPassword) })
    .where(eq(adminUsers.id, admin.adminId));

  return NextResponse.json({ ok: true });
}
