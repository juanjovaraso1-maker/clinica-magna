import { NextResponse, NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const ALLOWED_ROLES = ["ADMIN", "DENTIST"] as const;

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, title: true, username: true, email: true, rut: true, role: true, specialty: true, commissionRate: true, signatureUrl: true, active: true, createdAt: true },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado — se requiere rol administrador" }, { status: 403 });
  }

  const { name, title, username, password, role } = await req.json();

  if (!name || !username || !password) {
    return NextResponse.json({ error: "Nombre, username y contraseña son requeridos." }, { status: 400 });
  }

  const normalizedRole = (role ?? "DENTIST").toUpperCase();
  if (!ALLOWED_ROLES.includes(normalizedRole as any)) {
    return NextResponse.json({ error: "Rol inválido." }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "El username ya está en uso." }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, title: title || "", username, password: hashed, role: normalizedRole, active: true },
    select: { id: true, name: true, username: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json(user);
}
