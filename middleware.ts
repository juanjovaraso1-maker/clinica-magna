import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes accessible without a user session
const PUBLIC_API = [
  "/api/auth",
  "/api/appointments/confirm",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets, login page, and public patient-facing pages
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/confirmar") ||   // patient appointment confirmation — no auth required
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".jpeg") ||
    pathname.includes(".jpg") ||
    pathname.includes(".png") ||
    pathname.includes(".ico")
  ) {
    return NextResponse.next();
  }

  // Cron jobs: allow if no CRON_SECRET configured (dev) or secret matches
  if (pathname.startsWith("/api/cron/")) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.next();
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Public API endpoints
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    // API routes → JSON 401 (not a redirect)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    // Page routes → redirect to login
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
