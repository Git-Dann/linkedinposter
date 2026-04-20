import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "./lib/auth";

const COOKIE_NAME = "lp_session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let these through without auth
  const publicPaths = ["/login", "/api/login"];
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, {
    password: process.env.SESSION_PASSWORD as string,
    cookieName: COOKIE_NAME,
  });

  if (!session.loggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
