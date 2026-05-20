import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { name, username, role, password } = await req.json();

  if (username) {
    const conflict = await prisma.user.findFirst({ where: { username, NOT: { id: params.id } } });
    if (conflict) {
      return NextResponse.json({ error: "El username ya está en uso." }, { status: 409 });
    }
  }

  const data: Record<string, unknown> = {};
  if (name)     data.name     = name;
  if (username) data.username = username;
  if (role)     data.role     = role;
  if (password) data.password = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, username: true, role: true, active: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.user.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
