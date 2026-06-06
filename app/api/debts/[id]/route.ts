import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json();
  const debt = await prisma.debt.update({ where: { id: params.id }, data });
  return NextResponse.json(debt);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.debt.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
