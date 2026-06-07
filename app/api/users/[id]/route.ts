import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { name, username, role, password, active, commissionRate, email, rut, specialty } = await req.json();

  if (username) {
    const conflict = await prisma.user.findFirst({ where: { username, NOT: { id: params.id } } });
    if (conflict) {
      return NextResponse.json({ error: "El username ya está en uso." }, { status: 409 });
    }
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined)            data.name           = name;
  if (username !== undefined)        data.username       = username;
  if (role !== undefined)            data.role           = role;
  if (password)                      data.password       = await bcrypt.hash(password, 12);
  if (active !== undefined)          data.active         = active;
  if (commissionRate !== undefined)  data.commissionRate = commissionRate;
  if (email !== undefined)           data.email          = email || null;
  if (rut !== undefined)             data.rut            = rut || null;
  if (specialty !== undefined)       data.specialty      = specialty || null;

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, username: true, email: true, rut: true, role: true, specialty: true, commissionRate: true, active: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.user.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
