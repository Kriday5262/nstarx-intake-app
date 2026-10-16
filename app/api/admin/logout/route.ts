import { NextRequest, NextResponse } from "next/server";
import { revokeSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  await revokeSession();

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl, { status: 303 });
}
