import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware runs on every request before the page renders.
 * Redirects unauthenticated users away from protected routes.
 *
 * Protected routes: anything under /dashboard
 * Public routes: /auth/*, /api/auth/*
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /dashboard routes for now
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  // Check for SuperTokens session cookie
  const sessionCookie =
    req.cookies.get("sAccessToken") ?? req.cookies.get("st-access-token");

  if (!sessionCookie) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
