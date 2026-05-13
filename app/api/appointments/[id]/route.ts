import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  let appt = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: { patient: true, user: true },
  });
  if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!appt.confirmationToken) {
    appt = await prisma.appointment.update({
      where: { id: params.id },
      data: { confirmationToken: randomUUID() },
      include: { patient: true, user: true },
    });
  }
  return NextResponse.json(appt);
}

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
