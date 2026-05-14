import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { name, email, role, specialty, active, rut } = body;
  const user = await prisma.user.update({
    where: { id: params.id },
    data: { name, email, role, specialty: specialty || null, active: active ?? true, rut: rut || null },
  });
  return NextResponse.json(user);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.user.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
