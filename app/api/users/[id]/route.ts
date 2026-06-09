import { NextResponse, NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const ALLOWED_ROLES = ["ADMIN", "DENTIST"] as const;

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado — se requiere rol administrador" }, { status: 403 });
  }

  const { name, title, username, role, password, active, commissionRate, email, rut, specialty } = await req.json();

  if (username) {
    const conflict = await prisma.user.findFirst({ where: { username, NOT: { id: params.id } } });
    if (conflict) {
      return NextResponse.json({ error: "El username ya está en uso." }, { status: 409 });
    }
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined)           data.name           = name;
  if (title !== undefined)          data.title          = title ?? "";
  if (username !== undefined)       data.username       = username;
  if (role !== undefined)           data.role           = (role as string).toUpperCase();
  if (password)                     data.password       = await bcrypt.hash(password, 12);
  if (active !== undefined)         data.active         = active;
  if (commissionRate !== undefined) data.commissionRate = commissionRate;
  if (email !== undefined)          data.email          = email || null;
  if (rut !== undefined)            data.rut            = rut || null;
  if (specialty !== undefined)      data.specialty      = specialty || null;

  if (data.role && !ALLOWED_ROLES.includes(data.role as any)) {
    return NextResponse.json({ error: "Rol inválido." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, title: true, username: true, email: true, rut: true, role: true, specialty: true, commissionRate: true, active: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  await prisma.user.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
