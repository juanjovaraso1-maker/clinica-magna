import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const data = await req.json();
  const evolution = await prisma.evolution.create({
    data,
    include: { user: true },
  });
  return NextResponse.json(evolution, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json();
  const { user, patient, ...rest } = data;
  const evolution = await prisma.evolution.update({ where: { id }, data: rest });
  return NextResponse.json(evolution);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await prisma.evolution.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
