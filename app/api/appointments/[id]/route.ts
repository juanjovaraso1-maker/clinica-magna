import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json();
  const { patient, user, ...rest } = data;
  const appt = await prisma.appointment.update({
    where: { id: params.id },
    data: rest,
    include: { patient: true, user: true },
  });
  return NextResponse.json(appt);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.appointment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
