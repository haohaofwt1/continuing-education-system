import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPrefixes = ["/login", "/api/auth", "/api/health", "/verify/certificate"];
const sessionCookieNames = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token"
];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = publicPrefixes.some((prefix) => pathname.startsWith(prefix));
  const hasSessionCookie = sessionCookieNames.some((name) => request.cookies.has(name));

  if (!hasSessionCookie && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSessionCookie && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"]
};
