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
