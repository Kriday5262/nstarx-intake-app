import { NextRequest, NextResponse } from "next/server";

// The middleware runs in the Edge Runtime, where Node's crypto module is
// unavailable. It performs a lightweight presence check for the session
// cookie; the actual HMAC verification and expiry checks happen in the
// dashboard's server components and API routes (Node.js runtime), which reject
// forged or expired cookies and redirect the user to /login.
const SESSION_COOKIE_NAME = "admin_session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
