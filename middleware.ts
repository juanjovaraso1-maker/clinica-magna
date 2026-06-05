import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas públicas — nunca verificar sesión
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
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

  // Cron jobs de Vercel — autenticados con CRON_SECRET, no con sesión de usuario
  if (pathname.startsWith("/api/cron/")) {
    const auth = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    if (secret && auth === `Bearer ${secret}`) return NextResponse.next();
    // En desarrollo local (sin secret configurado) permitir paso libre
    if (!secret) return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verificar JWT directamente — funciona en Edge Runtime
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Sin sesión → redirigir a login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Aplica a todas las rutas excepto archivos estáticos de _next
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
