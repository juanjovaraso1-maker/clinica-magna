import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, username: true, email: true, role: true, specialty: true, active: true, createdAt: true },
  });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const { name, username, password, role } = await req.json();

  if (!name || !username || !password) {
    return NextResponse.json({ error: "Nombre, username y contraseña son requeridos." }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "El username ya está en uso." }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, username, password: hashed, role: role || "DENTIST", active: true },
    select: { id: true, name: true, username: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json(user);
}
